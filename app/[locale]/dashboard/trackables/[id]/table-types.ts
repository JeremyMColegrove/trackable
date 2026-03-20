import type {
  SubmissionMetadata,
  TrackableFormSnapshot,
  TrackableKind,
  TrackableSubmissionSnapshot,
  TrackableSettings,
} from "@/db/schema/types"
import type {
  UsageEventFreshness,
  UsageEventSourceSnapshot,
  UsageEventTableColumn,
  UsageEventTableRow,
} from "@/lib/usage-event-search"

export type TrackableDetails = {
  id: string
  kind: TrackableKind
  name: string
  description: string | null
  settings: TrackableSettings | null
  createdAt: string
  submissionCount: number
  apiUsageCount: number
  lastSubmissionAt: string | null
  lastApiUsageAt: string | null
  activeForm: {
    id: string
    version: number
    title: string
    description: string | null
    status: "draft" | "published" | "archived"
    submitLabel: string | null
    successMessage: string | null
    fields: TrackableFormSnapshot["fields"]
  } | null
  recentSubmissions: SubmissionRow[]
  apiKeys: ApiKeyRow[]
  shareSettings: ShareSettings
}

export type SubmissionRow = {
  id: string
  createdAt: string
  source: "public_link" | "user_grant" | "email_grant"
  submitterLabel: string
  metadata: SubmissionMetadata | null
  submissionSnapshot: TrackableSubmissionSnapshot
}

export type UsageEventRow = UsageEventTableRow
export type UsageHitRow = UsageEventRow["hits"][number]
export type UsageEventColumn = UsageEventTableColumn
export type UsageEventTableData = {
  columns: UsageEventColumn[]
  rows: UsageEventRow[]
  totalMatchedEvents: number
  totalGroupedRows: number
  availableAggregateFields: string[]
  sourceSnapshot: UsageEventSourceSnapshot
}
export type UsageEventFreshnessState = UsageEventFreshness

export type ApiKeyRow = {
  id: string
  name: string
  maskedKey: string
  status: "active" | "revoked"
  expiresAt: string | null
  trackableUsageCount: number
  lastUsedAt: string | null
}

export type AccessRole = "submit" | "view" | "manage"

export type ShareAccessGrantRow = {
  id: string
  subjectType: "user" | "email"
  subjectLabel: string
  subjectEmail: string | null
  role: AccessRole
  acceptedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export type ShareLinkRow = {
  id: string
  token: string
  role: AccessRole
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
  usageCount: number
}

export type ShareSettings = {
  accessGrants: ShareAccessGrantRow[]
  shareLinks: ShareLinkRow[]
}

export type SubmissionFieldRow = {
  fieldId: string
  label: string
  kind: string
  required: boolean
  description: string | null
  answer: TrackableSubmissionSnapshot["answers"][number] | undefined
}

export type SubmissionMetadataEntry = {
  label: string
  value: string
}

export type SubmissionDetails = {
  form: TrackableFormSnapshot
  fields: SubmissionFieldRow[]
  metadata: SubmissionMetadata | null
}
