import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import sharp from "sharp"
import { TRPCError } from "@trpc/server"

import type { NewTrackableAsset, TrackableAsset } from "@/db/schema"
import { TrackableAssetService } from "@/server/trackable-assets/trackable-asset-core"

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
  maxUploadBytes?: number
  sharedLinks?: Array<{ token: string; trackableId: string }>
}) {
  const storageRoot = await mkdtemp(
    path.join(os.tmpdir(), "trackable-asset-service-")
  )
  const repository = new InMemoryTrackableAssetRepository()
  const service = new TrackableAssetService({
    authorizer: createAuthorizer(
      options?.allowedTrackableIds ?? ["trackable-1"]
    ),
    maxUploadBytes: options?.maxUploadBytes,
    repository,
    sharedLinkLoader: createSharedLinkLoader(options?.sharedLinks ?? []),
    sharp,
    storageRoot,
  })

  return {
    repository,
    service,
    storageRoot,
  }
}

async function createPngBuffer(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: {
        r: 32,
        g: 96,
        b: 192,
      },
    },
  })
    .png()
    .toBuffer()
}

test("image upload compresses and records normalized metadata", async () => {
  const { repository, service, storageRoot } = await createService()
  const imageBuffer = await createPngBuffer(3200, 1600)

  const asset = await service.saveUploadedAsset({
    fileBuffer: imageBuffer,
    mimeType: "image/png",
    originalFileName: "Hero Banner.png",
    trackableId: "trackable-1",
    userId: "user-1",
  })

  assert.equal(asset.kind, "image")
  assert.equal(asset.mimeType, "image/webp")
  assert.equal(asset.extension, "webp")
  assert.equal(asset.originalFileName, "Hero-Banner.png")
  assert.equal(asset.imageWidth, 2400)
  assert.equal(asset.imageHeight, 1200)
  assert.equal(asset.imageFormat, "webp")

  const storedAsset = repository.assets.get(asset.id)
  assert.ok(storedAsset)

  const storedFilePath = path.join(storageRoot, ...asset.storageKey.split("/"))
  const storedFile = await stat(storedFilePath)
  assert.equal(storedFile.size, asset.storedBytes)
  assert.ok(asset.storedBytes > 0)
})

test("non-image upload stores raw bytes without transforming the content", async () => {
  const { service, storageRoot } = await createService()
  const fileBuffer = Buffer.from("plain text payload", "utf8")

  const asset = await service.saveUploadedAsset({
    fileBuffer,
    mimeType: "text/plain",
    originalFileName: "notes.txt",
    trackableId: "trackable-1",
    userId: "user-1",
  })

  assert.equal(asset.kind, "file")
  assert.equal(asset.mimeType, "text/plain")
  assert.equal(asset.extension, "txt")
  assert.equal(asset.originalBytes, fileBuffer.byteLength)
  assert.equal(asset.storedBytes, fileBuffer.byteLength)

  const storedFilePath = path.join(storageRoot, ...asset.storageKey.split("/"))
  assert.equal(
    (await readFile(storedFilePath)).toString("utf8"),
    "plain text payload"
  )
})

test("oversized uploads are rejected before files are written", async () => {
  const { service } = await createService({
    maxUploadBytes: 4,
  })

  await assert.rejects(
    () =>
      service.saveUploadedAsset({
        fileBuffer: Buffer.from("12345", "utf8"),
        mimeType: "text/plain",
        originalFileName: "notes.txt",
        trackableId: "trackable-1",
        userId: "user-1",
      }),
    (error: unknown) =>
      error instanceof TRPCError && error.code === "PAYLOAD_TOO_LARGE"
  )
})

test("unsupported image mime types are rejected", async () => {
  const { service } = await createService()

  await assert.rejects(
    () =>
      service.saveUploadedAsset({
        fileBuffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
        ),
        mimeType: "image/svg+xml",
        originalFileName: "vector.svg",
        trackableId: "trackable-1",
        userId: "user-1",
      }),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "BAD_REQUEST" &&
      error.message === "Unsupported image type."
  )
})

test("unauthorized upload, delete, and read requests are rejected", async () => {
  const { repository, service } = await createService({
    allowedTrackableIds: [],
  })

  await assert.rejects(
    () =>
      service.saveUploadedAsset({
        fileBuffer: Buffer.from("hello", "utf8"),
        mimeType: "text/plain",
        originalFileName: "notes.txt",
        trackableId: "trackable-1",
        userId: "user-1",
      }),
    (error: unknown) => error instanceof TRPCError && error.code === "NOT_FOUND"
  )

  const seededAsset = await repository.create({
    id: "asset-1",
    trackableId: "trackable-1",
    uploadedByUserId: "user-1",
    publicToken: "public-token",
    kind: "file",
    originalFileName: "notes.txt",
    mimeType: "text/plain",
    extension: "txt",
    originalBytes: 5,
    storedBytes: 5,
    storageKey: "trackable-1/asset-1/notes.txt",
    imageWidth: null,
    imageHeight: null,
    imageFormat: null,
  })

  await assert.rejects(
    () => service.deleteAsset(seededAsset.id, "user-1"),
    (error: unknown) => error instanceof TRPCError && error.code === "NOT_FOUND"
  )

  await assert.rejects(
    () =>
      service.getAuthorizedAssetDownload({
        publicToken: seededAsset.publicToken,
        userId: "user-1",
      }),
    (error: unknown) => error instanceof TRPCError && error.code === "NOT_FOUND"
  )
})

test("deleting an asset removes both metadata and stored files", async () => {
  const { repository, service, storageRoot } = await createService()
  const asset = await service.saveUploadedAsset({
    fileBuffer: Buffer.from("delete me", "utf8"),
    mimeType: "text/plain",
    originalFileName: "deleteme.txt",
    trackableId: "trackable-1",
    userId: "user-1",
  })

  const storedDirectory = path.dirname(
    path.join(storageRoot, ...asset.storageKey.split("/"))
  )
  await service.deleteAsset(asset.id, "user-1")

  assert.equal(repository.assets.has(asset.id), false)
  await assert.rejects(() => stat(storedDirectory))
})
