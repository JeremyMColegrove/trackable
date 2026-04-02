import "server-only"

import { desc, eq } from "drizzle-orm"

import { db } from "@/db"
import type { NewTrackableAsset } from "@/db/schema"
import { trackableAssets } from "@/db/schema"
import { getActiveShareLink } from "@/lib/trackable-share-links"
import {
  TrackableAssetService,
  type TrackableAccessAuthorizer,
  type TrackableAssetRepository,
  type SharedLinkLoader,
} from "@/server/trackable-assets/trackable-asset-core"
import { accessControlService } from "@/server/services/access-control.service"

const repository: TrackableAssetRepository = {
  async create(input: NewTrackableAsset) {
    const [createdAsset] = await db
      .insert(trackableAssets)
      .values(input)
      .returning()

    return createdAsset
  },
  async deleteById(assetId) {
    await db.delete(trackableAssets).where(eq(trackableAssets.id, assetId))
  },
  async findById(assetId) {
    return (
      (await db.query.trackableAssets.findFirst({
        where: eq(trackableAssets.id, assetId),
      })) ?? null
    )
  },
  async findByPublicToken(publicToken) {
    return (
      (await db.query.trackableAssets.findFirst({
        where: eq(trackableAssets.publicToken, publicToken),
      })) ?? null
    )
  },
  async listByTrackableId(trackableId) {
    return db.query.trackableAssets.findMany({
      where: eq(trackableAssets.trackableId, trackableId),
      orderBy: [desc(trackableAssets.createdAt)],
    })
  },
}

const authorizer: TrackableAccessAuthorizer = {
  async assertManageAccess(trackableId, userId) {
    await accessControlService.assertTrackableAccess(
      trackableId,
      userId,
      "manage"
    )
  },
}

const sharedLinkLoader: SharedLinkLoader = {
  async getActiveShareLink(token) {
    return (await getActiveShareLink(token)) ?? null
  },
}

export { TrackableAssetService } from "@/server/trackable-assets/trackable-asset-core"

export const trackableAssetService = new TrackableAssetService({
  authorizer,
  repository,
  sharedLinkLoader,
})
