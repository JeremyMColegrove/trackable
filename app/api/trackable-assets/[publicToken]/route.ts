import { auth } from "@clerk/nextjs/server"

import { createGetTrackableAssetHandler } from "@/app/api/trackable-assets/route-handlers"
import { trackableAssetService } from "@/server/trackable-assets/trackable-asset.service"
import { ensureUserProvisioned } from "@/server/user-provisioning"

export const runtime = "nodejs"

export const GET = createGetTrackableAssetHandler({
  auth,
  ensureUserProvisioned,
  getAuthorizedAssetDownload: (input) =>
    trackableAssetService.getAuthorizedAssetDownload(input),
})
