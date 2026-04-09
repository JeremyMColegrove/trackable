import { getAuth } from "@/server/get-auth"

import { createGetTrackableAssetHandler } from "@/app/api/trackable-assets/route-handlers"
import { trackableAssetService } from "@/server/trackable-assets/trackable-asset.service"
import { ensureUserProvisioned } from "@/server/user-provisioning"

export const GET = createGetTrackableAssetHandler({
  auth: getAuth,
  ensureUserProvisioned,
  getAuthorizedAssetDownload: (input) =>
    trackableAssetService.getAuthorizedAssetDownload(input),
})
