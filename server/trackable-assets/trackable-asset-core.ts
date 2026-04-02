import { randomBytes, randomUUID } from "node:crypto"
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"
import { TRPCError } from "@trpc/server"

import type {
  NewTrackableAsset,
  TrackableAsset,
  TrackableShareLink,
} from "@/db/schema"
import type { TrackableAssetRecord } from "@/db/schema/types"
import { buildTrackableAssetUrl } from "@/lib/trackable-assets"
import { logger } from "@/lib/logger"
import {
  getTrackableAssetMaxUploadBytes,
  getTrackableAssetStorageRoot,
} from "@/server/trackable-assets/trackable-asset-config"

const maxImageDimension = 2400
const webpQuality = 82
const supportedImageMimeTypes = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/tiff",
  "image/webp",
])

export type TrackableAssetRepository = {
  create(input: NewTrackableAsset): Promise<TrackableAsset>
  deleteById(assetId: string): Promise<void>
  findById(assetId: string): Promise<TrackableAsset | null>
  findByPublicToken(publicToken: string): Promise<TrackableAsset | null>
  listByTrackableId(trackableId: string): Promise<TrackableAsset[]>
}

export type TrackableAccessAuthorizer = {
  assertManageAccess(trackableId: string, userId: string): Promise<void>
}

export type TrackableAssetStorage = {
  mkdir: typeof mkdir
  readFile: typeof readFile
  rename: typeof rename
  rm: typeof rm
  stat: typeof stat
  unlink: typeof unlink
  writeFile: typeof writeFile
}

export type SharedLinkLoader = {
  getActiveShareLink(token: string): Promise<
    | (Pick<TrackableShareLink, "id" | "trackableId"> & {
        trackable: {
          id: string
        }
      })
    | null
  >
}

type SharpLike = typeof sharp

export type SaveTrackableAssetInput = {
  fileBuffer: Buffer
  mimeType: string
  originalFileName: string
  trackableId: string
  userId: string
}

export type AuthorizedTrackableAssetReadInput = {
  publicToken: string
  shareToken?: string | null
  userId?: string | null
}

type DeletionStaging = {
  originalDirectory: string
  trashDirectory: string
}

function createPublicToken() {
  return randomBytes(18).toString("base64url")
}

function normalizeMimeType(value: string) {
  const normalizedValue = value.trim().toLowerCase()

  if (
    !normalizedValue ||
    !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalizedValue)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unsupported file type.",
    })
  }

  return normalizedValue
}

function sanitizeFileName(fileName: string) {
  const normalizedValue = path.basename(fileName.trim()) || "upload"
  const safeValue = normalizedValue
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\.+/g, ".")

  const trimmedValue = safeValue.slice(0, 120)

  return trimmedValue || "upload"
}

function getBaseName(fileName: string) {
  const extension = path.extname(fileName)
  const baseName = extension
    ? fileName.slice(0, Math.max(1, fileName.length - extension.length))
    : fileName

  return baseName.slice(0, 100) || "upload"
}

function normalizeExtension(extension: string) {
  return extension.replace(/^\.+/, "").toLowerCase()
}

function buildStoredFileName(baseName: string, extension: string) {
  const safeBaseName = sanitizeFileName(baseName).replace(/\.[^.]+$/, "")
  const normalizedExtension = normalizeExtension(extension)

  if (!normalizedExtension) {
    return safeBaseName || "upload"
  }

  return `${safeBaseName || "upload"}.${normalizedExtension}`
}

export function buildTrackableAssetContentDisposition(
  fileName: string,
  disposition: "attachment" | "inline"
) {
  const fallbackName = fileName.replace(/[^\x20-\x7e]+/g, "_")
  const encodedName = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )

  return `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`
}

function isImageMimeType(mimeType: string) {
  return mimeType.startsWith("image/")
}

function isSupportedImageMimeType(mimeType: string) {
  return supportedImageMimeTypes.has(mimeType)
}

function ensureUploadWithinLimit(fileBuffer: Buffer, maxUploadBytes: number) {
  if (fileBuffer.byteLength > maxUploadBytes) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: `File uploads must not exceed ${maxUploadBytes} bytes.`,
    })
  }
}

async function fileExists(filePath: string, storage: TrackableAssetStorage) {
  try {
    await storage.stat(filePath)
    return true
  } catch {
    return false
  }
}

export function toTrackableAssetRecord(
  asset: TrackableAsset
): TrackableAssetRecord {
  return {
    id: asset.id,
    trackableId: asset.trackableId,
    publicToken: asset.publicToken,
    kind: asset.kind,
    originalFileName: asset.originalFileName,
    mimeType: asset.mimeType,
    extension: asset.extension,
    originalBytes: asset.originalBytes,
    storedBytes: asset.storedBytes,
    storageKey: asset.storageKey,
    imageWidth: asset.imageWidth,
    imageHeight: asset.imageHeight,
    imageFormat: asset.imageFormat,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    url: buildTrackableAssetUrl(asset.publicToken),
  }
}

export class TrackableAssetService {
  constructor(
    private readonly dependencies: {
      authorizer: TrackableAccessAuthorizer
      repository: TrackableAssetRepository
      sharedLinkLoader: SharedLinkLoader
      maxUploadBytes?: number
      sharp?: SharpLike
      storage?: TrackableAssetStorage
      storageRoot?: string
    }
  ) {}

  async listAssets(trackableId: string, userId: string) {
    await this.authorizer.assertManageAccess(trackableId, userId)
    const assets = await this.repository.listByTrackableId(trackableId)
    return assets.map((asset) => toTrackableAssetRecord(asset))
  }

  async saveUploadedAsset(input: SaveTrackableAssetInput) {
    await this.authorizer.assertManageAccess(input.trackableId, input.userId)

    const mimeType = normalizeMimeType(input.mimeType)
    ensureUploadWithinLimit(input.fileBuffer, this.maxUploadBytes)

    const sanitizedOriginalFileName = sanitizeFileName(input.originalFileName)
    const assetId = randomUUID()
    const publicToken = createPublicToken()
    const storedAsset = isImageMimeType(mimeType)
      ? await this.prepareImageAsset(
          input.fileBuffer,
          sanitizedOriginalFileName,
          mimeType
        )
      : this.prepareFileAsset(
          input.fileBuffer,
          sanitizedOriginalFileName,
          mimeType
        )

    const storageKey = path.posix.join(
      input.trackableId,
      assetId,
      storedAsset.fileName
    )
    const filePath = path.join(this.storageRoot, ...storageKey.split("/"))

    await this.writeAssetAtomically(filePath, storedAsset.buffer)

    try {
      const createdAsset = await this.repository.create({
        id: assetId,
        trackableId: input.trackableId,
        uploadedByUserId: input.userId,
        publicToken,
        kind: storedAsset.kind,
        originalFileName: sanitizedOriginalFileName,
        mimeType: storedAsset.mimeType,
        extension: storedAsset.extension,
        originalBytes: input.fileBuffer.byteLength,
        storedBytes: storedAsset.buffer.byteLength,
        storageKey,
        imageWidth: storedAsset.imageWidth,
        imageHeight: storedAsset.imageHeight,
        imageFormat: storedAsset.imageFormat,
      })

      return toTrackableAssetRecord(createdAsset)
    } catch (error) {
      await this.cleanupAfterFailedWrite(filePath)
      throw error
    }
  }

  async deleteAsset(assetId: string, userId: string) {
    const asset = await this.requireAssetById(assetId)
    await this.authorizer.assertManageAccess(asset.trackableId, userId)

    const deletionStaging = await this.stageAssetForDeletion(asset)

    try {
      await this.repository.deleteById(asset.id)
    } catch (error) {
      await this.restoreStagedDeletion(deletionStaging)
      throw error
    }

    if (deletionStaging) {
      try {
        await this.storage.rm(deletionStaging.trashDirectory, {
          force: true,
          recursive: true,
        })
      } catch (error) {
        logger.warn(
          {
            assetId: asset.id,
            trashDirectory: deletionStaging.trashDirectory,
            err: error,
          },
          "Failed to remove staged trackable asset directory after deleting metadata."
        )
      }
    }

    return toTrackableAssetRecord(asset)
  }

  async getAuthorizedAssetDownload(input: AuthorizedTrackableAssetReadInput) {
    const asset = await this.requireAssetByPublicToken(input.publicToken)

    const hasPublicShareAccess =
      typeof input.shareToken === "string" &&
      input.shareToken.trim().length > 0 &&
      (await this.canReadAssetViaShareToken(
        asset.trackableId,
        input.shareToken
      ))

    if (!hasPublicShareAccess) {
      if (!input.userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trackable asset not found.",
        })
      }

      await this.authorizer.assertManageAccess(asset.trackableId, input.userId)
    }

    const filePath = path.join(this.storageRoot, ...asset.storageKey.split("/"))

    if (!(await fileExists(filePath, this.storage))) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable asset file not found.",
      })
    }

    return {
      asset,
      body: await this.storage.readFile(filePath),
      contentDisposition: buildTrackableAssetContentDisposition(
        asset.originalFileName,
        asset.kind === "image" ? "inline" : "attachment"
      ),
    }
  }

  private get authorizer() {
    return this.dependencies.authorizer
  }

  private get maxUploadBytes() {
    return this.dependencies.maxUploadBytes ?? getTrackableAssetMaxUploadBytes()
  }

  private get repository() {
    return this.dependencies.repository
  }

  private get sharedLinkLoader() {
    return this.dependencies.sharedLinkLoader
  }

  private get sharp() {
    return this.dependencies.sharp ?? sharp
  }

  private get storage() {
    return (
      this.dependencies.storage ?? {
        mkdir,
        readFile,
        rename,
        rm,
        stat,
        unlink,
        writeFile,
      }
    )
  }

  private get storageRoot() {
    return this.dependencies.storageRoot ?? getTrackableAssetStorageRoot()
  }

  private async canReadAssetViaShareToken(
    trackableId: string,
    shareToken: string
  ) {
    const shareLink = await this.sharedLinkLoader.getActiveShareLink(
      shareToken.trim()
    )
    return shareLink?.trackableId === trackableId
  }

  private async cleanupAfterFailedWrite(filePath: string) {
    try {
      await this.storage.unlink(filePath)
    } catch {
      // Ignore cleanup failures after a failed create and remove the directory instead.
    }

    try {
      await this.storage.rm(path.dirname(filePath), {
        force: true,
        recursive: true,
      })
    } catch (error) {
      logger.warn(
        {
          filePath,
          err: error,
        },
        "Failed to clean up trackable asset files after a failed metadata write."
      )
    }
  }

  private async prepareImageAsset(
    fileBuffer: Buffer,
    originalFileName: string,
    mimeType: string
  ) {
    if (!isSupportedImageMimeType(mimeType)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unsupported image type.",
      })
    }

    try {
      const transformedImage = await this.sharp(fileBuffer)
        .rotate()
        .resize({
          width: maxImageDimension,
          height: maxImageDimension,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: webpQuality })
        .toBuffer({ resolveWithObject: true })

      return {
        kind: "image" as const,
        buffer: transformedImage.data,
        extension: "webp",
        fileName: buildStoredFileName(getBaseName(originalFileName), "webp"),
        imageFormat: transformedImage.info.format ?? "webp",
        imageHeight: transformedImage.info.height ?? null,
        imageWidth: transformedImage.info.width ?? null,
        mimeType: "image/webp",
      }
    } catch (error) {
      logger.warn(
        {
          mimeType,
          fileName: originalFileName,
          err: error,
        },
        "Failed to transform uploaded image."
      )

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unable to process the uploaded image.",
      })
    }
  }

  private prepareFileAsset(
    fileBuffer: Buffer,
    originalFileName: string,
    mimeType: string
  ) {
    const extension = normalizeExtension(path.extname(originalFileName))

    return {
      kind: "file" as const,
      buffer: fileBuffer,
      extension,
      fileName: buildStoredFileName(getBaseName(originalFileName), extension),
      imageFormat: null,
      imageHeight: null,
      imageWidth: null,
      mimeType,
    }
  }

  private async requireAssetById(assetId: string) {
    const asset = await this.repository.findById(assetId)

    if (!asset) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable asset not found.",
      })
    }

    return asset
  }

  private async requireAssetByPublicToken(publicToken: string) {
    const asset = await this.repository.findByPublicToken(publicToken)

    if (!asset) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Trackable asset not found.",
      })
    }

    return asset
  }

  private async restoreStagedDeletion(deletionStaging: DeletionStaging | null) {
    if (!deletionStaging) {
      return
    }

    try {
      await this.storage.rename(
        deletionStaging.trashDirectory,
        deletionStaging.originalDirectory
      )
    } catch (error) {
      logger.error(
        {
          originalDirectory: deletionStaging.originalDirectory,
          trashDirectory: deletionStaging.trashDirectory,
          err: error,
        },
        "Failed to restore a staged trackable asset directory after metadata delete failed."
      )
    }
  }

  private async stageAssetForDeletion(asset: TrackableAsset) {
    const filePath = path.join(this.storageRoot, ...asset.storageKey.split("/"))
    const assetDirectory = path.dirname(filePath)

    if (!(await fileExists(assetDirectory, this.storage))) {
      return null
    }

    const trashDirectory = path.join(
      this.storageRoot,
      ".trash",
      `${asset.id}-${Date.now()}`
    )

    await this.storage.mkdir(path.dirname(trashDirectory), { recursive: true })
    await this.storage.rename(assetDirectory, trashDirectory)

    return {
      originalDirectory: assetDirectory,
      trashDirectory,
    }
  }

  private async writeAssetAtomically(filePath: string, fileBuffer: Buffer) {
    const directory = path.dirname(filePath)
    const tempFilePath = path.join(
      directory,
      `.${path.basename(filePath)}.${randomUUID()}.tmp`
    )

    await this.storage.mkdir(directory, { recursive: true })
    await this.storage.writeFile(tempFilePath, fileBuffer)
    await this.storage.rename(tempFilePath, filePath)
  }
}
