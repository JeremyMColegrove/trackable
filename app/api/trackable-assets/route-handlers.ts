import { TRPCError } from "@trpc/server"
import { z } from "zod"

import type { TrackableAsset } from "@/db/schema"
import type { TrackableAssetRecord } from "@/db/schema/types"
import { getTrackableAssetMaxUploadBytes } from "@/server/trackable-assets/trackable-asset-config"

const uploadInputSchema = z.object({
  trackableId: z.string().uuid(),
})

function getErrorStatus(error: TRPCError) {
  return error.code === "BAD_REQUEST"
    ? 400
    : error.code === "PAYLOAD_TOO_LARGE"
      ? 413
      : error.code === "UNAUTHORIZED"
        ? 401
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "PRECONDITION_FAILED"
              ? 412
              : 500
}

type AuthResult = {
  userId: string | null
}

export function createUploadTrackableAssetHandler(dependencies: {
  auth: () => Promise<AuthResult>
  ensureUserProvisioned: (userId: string) => Promise<void>
  getMaxUploadBytes?: () => number
  saveUploadedAsset: (input: {
    fileBuffer: Buffer
    mimeType: string
    originalFileName: string
    trackableId: string
    userId: string
  }) => Promise<TrackableAssetRecord>
}) {
  const getMaxUploadBytes =
    dependencies.getMaxUploadBytes ?? getTrackableAssetMaxUploadBytes

  return async function handleUpload(request: Request) {
    const { userId } = await dependencies.auth()

    if (!userId) {
      return Response.json(
        { error: "You must be signed in to upload trackable assets." },
        { status: 401 }
      )
    }

    const contentLength = Number(request.headers.get("content-length") ?? "")
    const maxUploadBytes = getMaxUploadBytes()

    if (Number.isFinite(contentLength) && contentLength > maxUploadBytes * 2) {
      return Response.json(
        { error: `File uploads must not exceed ${maxUploadBytes} bytes.` },
        { status: 413 }
      )
    }

    try {
      await dependencies.ensureUserProvisioned(userId)

      const formData = await request.formData()
      const fileEntries = formData.getAll("file")

      if (fileEntries.length !== 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provide exactly one file upload.",
        })
      }

      const file = fileEntries[0]

      if (!(file instanceof File)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A file upload is required.",
        })
      }

      const parsedInput = uploadInputSchema.safeParse({
        trackableId: formData.get("trackableId"),
      })

      if (!parsedInput.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A valid trackableId is required.",
        })
      }

      const asset = await dependencies.saveUploadedAsset({
        fileBuffer: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type,
        originalFileName: file.name,
        trackableId: parsedInput.data.trackableId,
        userId,
      })

      return Response.json(asset, {
        headers: {
          "Cache-Control": "no-store",
        },
      })
    } catch (error) {
      if (error instanceof TRPCError) {
        return Response.json(
          { error: error.message },
          {
            status: getErrorStatus(error),
            headers: {
              "Cache-Control": "no-store",
            },
          }
        )
      }

      throw error
    }
  }
}

export function createGetTrackableAssetHandler(dependencies: {
  auth: () => Promise<AuthResult>
  ensureUserProvisioned: (userId: string) => Promise<void>
  getAuthorizedAssetDownload: (input: {
    publicToken: string
    shareToken?: string | null
    userId?: string | null
  }) => Promise<{
    asset: TrackableAsset
    body: Buffer
    contentDisposition: string
  }>
}) {
  return async function handleGetTrackableAsset(
    request: Request,
    context: {
      params: Promise<{
        publicToken: string
      }>
    }
  ) {
    const { publicToken } = await context.params
    const { userId } = await dependencies.auth()

    try {
      if (userId) {
        await dependencies.ensureUserProvisioned(userId)
      }

      const shareToken = new URL(request.url).searchParams.get("shareToken")
      const asset = await dependencies.getAuthorizedAssetDownload({
        publicToken,
        shareToken,
        userId,
      })

      return new Response(new Uint8Array(asset.body), {
        headers: {
          "Cache-Control": "private, max-age=60, must-revalidate",
          "Content-Disposition": asset.contentDisposition,
          "Content-Length": asset.body.byteLength.toString(),
          "Content-Type": asset.asset.mimeType,
          "X-Content-Type-Options": "nosniff",
        },
      })
    } catch (error) {
      if (error instanceof TRPCError) {
        return Response.json(
          { error: error.message },
          {
            status: getErrorStatus(error),
            headers: {
              "Cache-Control": "no-store",
            },
          }
        )
      }

      throw error
    }
  }
}
