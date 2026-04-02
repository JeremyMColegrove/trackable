import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import sharp from "sharp"

import type { NewTrackableAsset, TrackableAsset } from "@/db/schema"
import { TRPCError } from "@trpc/server"

import {
  createGetTrackableAssetHandler,
  createUploadTrackableAssetHandler,
} from "@/app/api/trackable-assets/route-handlers"
import { TrackableAssetService } from "@/server/trackable-assets/trackable-asset-core"

const trackableId = "11111111-1111-4111-8111-111111111111"

class InMemoryTrackableAssetRepository {
  readonly assets = new Map<string, TrackableAsset>()

  async create(input: NewTrackableAsset) {
    const asset: TrackableAsset = {
      extension: input.extension ?? "",
      id: input.id ?? randomUUID(),
      imageFormat: input.imageFormat ?? null,
      imageHeight: input.imageHeight ?? null,
      imageWidth: input.imageWidth ?? null,
      kind: input.kind ?? "file",
      mimeType: input.mimeType ?? "application/octet-stream",
      originalBytes: input.originalBytes ?? 0,
      originalFileName: input.originalFileName ?? "upload",
      publicToken: input.publicToken ?? randomUUID(),
      storageKey: input.storageKey ?? "",
      storedBytes: input.storedBytes ?? 0,
      trackableId: input.trackableId ?? "",
      uploadedByUserId: input.uploadedByUserId ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.assets.set(asset.id, asset)
    return asset
  }

  async deleteById(assetId: string) {
    this.assets.delete(assetId)
  }

  async findById(assetId: string) {
    return this.assets.get(assetId) ?? null
  }

  async findByPublicToken(publicToken: string) {
    return (
      [...this.assets.values()].find(
        (asset) => asset.publicToken === publicToken
      ) ?? null
    )
  }

  async listByTrackableId(trackableId: string) {
    return [...this.assets.values()].filter(
      (asset) => asset.trackableId === trackableId
    )
  }
}

function createAuthorizer(allowedTrackableIds: string[] = []) {
  const allowedTrackableIdSet = new Set(allowedTrackableIds)

  return {
    async assertManageAccess(trackableId: string) {
      if (!allowedTrackableIdSet.has(trackableId)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trackable not found.",
        })
      }
    },
  }
}

function createSharedLinkLoader(
  validLinks: Array<{ token: string; trackableId: string }>
) {
  return {
    async getActiveShareLink(token: string) {
      const shareLink = validLinks.find((entry) => entry.token === token)
      return shareLink
        ? {
            id: `share-${shareLink.token}`,
            trackableId: shareLink.trackableId,
            trackable: {
              id: shareLink.trackableId,
            },
          }
        : null
    },
  }
}

async function createService(options?: {
  allowedTrackableIds?: string[]
  sharedLinks?: Array<{ token: string; trackableId: string }>
}) {
  const storageRoot = await mkdtemp(
    path.join(os.tmpdir(), "trackable-asset-route-")
  )
  const repository = new InMemoryTrackableAssetRepository()
  const service = new TrackableAssetService({
    authorizer: createAuthorizer(options?.allowedTrackableIds ?? [trackableId]),
    repository,
    sharedLinkLoader: createSharedLinkLoader(options?.sharedLinks ?? []),
    sharp,
    storageRoot,
  })

  return {
    repository,
    service,
  }
}

async function createUploadRequest(file: File, nextTrackableId = trackableId) {
  const formData = new FormData()
  formData.set("trackableId", nextTrackableId)
  formData.set("file", file)

  return new Request("https://example.com/api/trackable-assets", {
    method: "POST",
    body: formData,
  })
}

test("upload route requires authentication", async () => {
  const handler = createUploadTrackableAssetHandler({
    auth: async () => ({ userId: null }),
    ensureUserProvisioned: async () => {},
    saveUploadedAsset: async () => {
      throw new Error("Unexpected upload call.")
    },
  })

  const response = await handler(
    await createUploadRequest(
      new File(["hello"], "notes.txt", { type: "text/plain" })
    )
  )

  assert.equal(response.status, 401)
})

test("upload route requires valid manage access and returns the created asset", async () => {
  const { service } = await createService({
    allowedTrackableIds: [trackableId],
  })
  const allowedHandler = createUploadTrackableAssetHandler({
    auth: async () => ({ userId: "user-1" }),
    ensureUserProvisioned: async () => {},
    saveUploadedAsset: (input) => service.saveUploadedAsset(input),
  })

  const allowedResponse = await allowedHandler(
    await createUploadRequest(
      new File(["hello"], "notes.txt", { type: "text/plain" })
    )
  )

  assert.equal(allowedResponse.status, 200)
  assert.equal((await allowedResponse.json()).kind, "file")

  const { service: deniedService } = await createService({
    allowedTrackableIds: [],
  })
  const deniedHandler = createUploadTrackableAssetHandler({
    auth: async () => ({ userId: "user-1" }),
    ensureUserProvisioned: async () => {},
    saveUploadedAsset: (input) => deniedService.saveUploadedAsset(input),
  })

  const deniedResponse = await deniedHandler(
    await createUploadRequest(
      new File(["hello"], "notes.txt", { type: "text/plain" })
    )
  )

  assert.equal(deniedResponse.status, 404)
})

test("manager read succeeds without a share token and includes download headers", async () => {
  const { service } = await createService({
    allowedTrackableIds: [trackableId],
  })
  const asset = await service.saveUploadedAsset({
    fileBuffer: Buffer.from("manager read", "utf8"),
    mimeType: "text/plain",
    originalFileName: "manager.txt",
    trackableId,
    userId: "user-1",
  })
  const handler = createGetTrackableAssetHandler({
    auth: async () => ({ userId: "user-1" }),
    ensureUserProvisioned: async () => {},
    getAuthorizedAssetDownload: (input) =>
      service.getAuthorizedAssetDownload(input),
  })

  const response = await handler(
    new Request(
      `https://example.com/api/trackable-assets/${asset.publicToken}`
    ),
    {
      params: Promise.resolve({
        publicToken: asset.publicToken,
      }),
    }
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Content-Type"), "text/plain")
  assert.match(
    response.headers.get("Content-Disposition") ?? "",
    /^attachment;/
  )
  assert.equal(await response.text(), "manager read")
})

test("public read succeeds with a valid share token for the same trackable", async () => {
  const { service } = await createService({
    allowedTrackableIds: [trackableId],
    sharedLinks: [{ token: "share-token", trackableId }],
  })
  const imageBuffer = await sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 200, g: 120, b: 40 },
    },
  })
    .png()
    .toBuffer()
  const asset = await service.saveUploadedAsset({
    fileBuffer: imageBuffer,
    mimeType: "image/png",
    originalFileName: "preview.png",
    trackableId,
    userId: "user-1",
  })
  const handler = createGetTrackableAssetHandler({
    auth: async () => ({ userId: null }),
    ensureUserProvisioned: async () => {},
    getAuthorizedAssetDownload: (input) =>
      service.getAuthorizedAssetDownload(input),
  })

  const response = await handler(
    new Request(
      `https://example.com/api/trackable-assets/${asset.publicToken}?shareToken=share-token`
    ),
    {
      params: Promise.resolve({
        publicToken: asset.publicToken,
      }),
    }
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Content-Type"), "image/webp")
  assert.match(response.headers.get("Content-Disposition") ?? "", /^inline;/)
})

test("public read fails for missing, revoked, or mismatched share tokens", async () => {
  const { service } = await createService({
    allowedTrackableIds: [trackableId],
    sharedLinks: [{ token: "share-token", trackableId }],
  })
  const asset = await service.saveUploadedAsset({
    fileBuffer: Buffer.from("share read", "utf8"),
    mimeType: "text/plain",
    originalFileName: "share.txt",
    trackableId,
    userId: "user-1",
  })
  const handler = createGetTrackableAssetHandler({
    auth: async () => ({ userId: null }),
    ensureUserProvisioned: async () => {},
    getAuthorizedAssetDownload: (input) =>
      service.getAuthorizedAssetDownload(input),
  })

  for (const url of [
    `https://example.com/api/trackable-assets/${asset.publicToken}`,
    `https://example.com/api/trackable-assets/${asset.publicToken}?shareToken=revoked-token`,
    `https://example.com/api/trackable-assets/${asset.publicToken}?shareToken=share-token-mismatch`,
  ]) {
    const response = await handler(new Request(url), {
      params: Promise.resolve({
        publicToken: asset.publicToken,
      }),
    })

    assert.equal(response.status, 404)
  }
})
