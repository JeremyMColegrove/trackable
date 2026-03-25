import { getActiveShareLink } from "@/lib/trackable-share-links"
import { buildLocalizedUrl } from "@/lib/discovery-files"

const maxDescriptionLength = 160
const maxFormTitleLength = 80
const maxProjectNameLength = 48
const maxCreatorNameLength = 48

function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

export async function getShareMetadataContent(token: string, locale?: string) {
  const shareLink = await getActiveShareLink(token)

  if (!shareLink?.trackable) {
    return null
  }

  const projectName = trimText(
    shareLink.trackable.name.trim(),
    maxProjectNameLength
  )
  const formTitle = trimText(
    shareLink.trackable.activeForm?.title?.trim() || projectName,
    maxFormTitleLength
  )
  const creatorName = trimText(
    shareLink.trackable.workspace.name.trim() || "Trackables",
    maxCreatorNameLength
  )
  const projectDescription =
    shareLink.trackable.activeForm?.description?.trim() ||
    shareLink.trackable.description?.trim() ||
    null
  const description = trimText(
    projectDescription ??
      `Complete the ${formTitle} survey shared from ${projectName} on Trackables.`,
    maxDescriptionLength
  )

  return {
    creatorName,
    description,
    formTitle,
    projectName,
    shareUrl: buildLocalizedUrl(`/share/${token}`, locale).toString(),
  }
}
