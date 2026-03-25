export function getTrackableLimitMessage(limit: number) {
  return `You have reached the maximum of ${limit} trackable items for your plan. Please upgrade to create more.`
}

export function getSurveyResponseLimitMessage(limit: number) {
  return `This survey has received the maximum of ${limit} responses allowed on the current plan. The workspace owner needs to upgrade to collect more.`
}

export function isSurveyResponseLimitMessage(message: string) {
  return message.startsWith("This survey has received the maximum of ")
}

export function getWorkspaceMemberLimitMessage(limit: number) {
  return `This workspace has reached the maximum of ${limit} members for its plan. Please upgrade to invite more.`
}

export function isWorkspaceMemberLimitMessage(message: string) {
  return message.startsWith("This workspace has reached the maximum of ")
}

export function getApiLogRateLimitMessage(limit: number) {
  return `You have exceeded the maximum of ${limit} API log attempts per second for your plan. Please upgrade for a higher logging rate.`
}

export function isApiLogRateLimitMessage(message: string) {
  return (
    message.startsWith("You have exceeded the maximum of ") &&
    message.includes("API log attempts per second")
  )
}
