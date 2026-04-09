import { getAuth } from "@/server/get-auth"

import { createUploadTrackableAssetHandler } from "@/app/api/trackable-assets/route-handlers"
import { trackableAssetService } from "@/server/trackable-assets/trackable-asset.service"
import { ensureUserProvisioned } from "@/server/user-provisioning"

export const POST = createUploadTrackableAssetHandler({
  auth: getAuth,
  ensureUserProvisioned,
  saveUploadedAsset: (input) => trackableAssetService.saveUploadedAsset(input),
})
