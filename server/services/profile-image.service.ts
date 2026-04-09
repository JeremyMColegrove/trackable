import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"
import { TRPCError } from "@trpc/server"

const PROFILE_IMAGE_ROOT = path.resolve("/data/uploads/profile-images")
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024
const PROFILE_IMAGE_DIMENSION = 256
const PROFILE_IMAGE_WEBP_QUALITY = 80
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

function normalizeMimeType(value: string) {
  return value.trim().toLowerCase()
}

function ensureValidImageUpload(fileBuffer: Buffer, mimeType: string) {
  if (!supportedImageMimeTypes.has(mimeType)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Please upload a supported image file.",
    })
  }

  if (fileBuffer.byteLength > MAX_PROFILE_IMAGE_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Profile images must be 5 MB or smaller.",
    })
  }
}

function buildProfileImagePath(userId: string, fileName: string) {
  return path.join(PROFILE_IMAGE_ROOT, userId, fileName)
}

export function buildProfileImageUrl(userId: string, fileName: string) {
  return `/api/account-images/${encodeURIComponent(userId)}/${encodeURIComponent(fileName)}`
}

export function parseProfileImageUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return null
  }

  const match = imageUrl.match(
    /^\/api\/account-images\/([^/]+)\/([a-f0-9-]+\.webp)$/i
  )

  if (!match) {
    return null
  }

  return {
    userId: decodeURIComponent(match[1]),
    fileName: decodeURIComponent(match[2]),
  }
}

export async function saveProfileImage(input: {
  fileBuffer: Buffer
  mimeType: string
  userId: string
}) {
  const mimeType = normalizeMimeType(input.mimeType)
  ensureValidImageUpload(input.fileBuffer, mimeType)

  const fileName = `${randomUUID()}.webp`
  const directory = path.join(PROFILE_IMAGE_ROOT, input.userId)
  const outputPath = buildProfileImagePath(input.userId, fileName)

  const normalizedImage = await sharp(input.fileBuffer)
    .rotate()
    .resize(PROFILE_IMAGE_DIMENSION, PROFILE_IMAGE_DIMENSION, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    })
    .webp({
      quality: PROFILE_IMAGE_WEBP_QUALITY,
    })
    .toBuffer()

  await mkdir(directory, { recursive: true })
  await writeFile(outputPath, normalizedImage)

  return {
    fileName,
    imageUrl: buildProfileImageUrl(input.userId, fileName),
  }
}

export async function readProfileImage(input: {
  fileName: string
  userId: string
}) {
  if (!/^[a-f0-9-]+\.webp$/i.test(input.fileName)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Profile image not found.",
    })
  }

  const filePath = buildProfileImagePath(input.userId, input.fileName)

  try {
    return await readFile(filePath)
  } catch {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Profile image not found.",
    })
  }
}

export async function deleteProfileImageByUrl(imageUrl: string | null | undefined) {
  const parsedValue = parseProfileImageUrl(imageUrl)

  if (!parsedValue) {
    return
  }

  try {
    await unlink(buildProfileImagePath(parsedValue.userId, parsedValue.fileName))
  } catch {
    // Ignore missing files so profile updates remain non-blocking.
  }
}
