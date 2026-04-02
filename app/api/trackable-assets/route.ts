import { auth } from "@clerk/nextjs/server"

import { createUploadTrackableAssetHandler } from "@/app/api/trackable-assets/route-handlers"
import { trackableAssetService } from "@/server/trackable-assets/trackable-asset.service"
import { ensureUserProvisioned } from "@/server/user-provisioning"

export const runtime = "nodejs"

export const POST = createUploadTrackableAssetHandler({
  auth,
  ensureUserProvisioned,
  saveUploadedAsset: (input) => trackableAssetService.saveUploadedAsset(input),
})
