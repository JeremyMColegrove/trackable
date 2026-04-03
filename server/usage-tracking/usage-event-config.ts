import { getRuntimeConfig } from "@/lib/runtime-config"

export function getUsageEventPageSize() {
  return getRuntimeConfig().usage.pageSize
}

export const USAGE_EVENT_PAGE_SIZE = getUsageEventPageSize()
