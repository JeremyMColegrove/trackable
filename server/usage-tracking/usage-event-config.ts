const defaultUsageEventPageSize = 101

function parseUsageEventPageSize(value: string | undefined) {
  const configuredPageSize = Number.parseInt(value ?? "", 10)

  if (Number.isFinite(configuredPageSize) && configuredPageSize > 0) {
    return configuredPageSize
  }

  return defaultUsageEventPageSize
}

export function getUsageEventPageSize() {
  return parseUsageEventPageSize(process.env.USAGE_EVENT_PAGE_SIZE)
}

export const USAGE_EVENT_PAGE_SIZE = getUsageEventPageSize()
