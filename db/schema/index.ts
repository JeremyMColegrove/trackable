export * from "@/db/schema/_shared"
export * from "@/db/schema/api-usage"
export * from "@/db/schema/batch"
export * from "@/db/schema/enums"
export * from "@/db/schema/team"
export * from "@/db/schema/trackables"
export * from "@/db/schema/types"
export * from "@/db/schema/users"

import { InferInsertModel, InferSelectModel } from "drizzle-orm"

import { apiKeys, trackableApiUsageEvents } from "@/db/schema/api-usage"
import { batchJobLeases, batchJobs, batchJobRuns } from "@/db/schema/batch"
import { workspaceMembers, workspaces } from "@/db/schema/team"
import {
  trackableAccessGrants,
  trackableFormAnswers,
  trackableFormFields,
  trackableFormSubmissions,
  trackableForms,
  trackableItems,
  trackableShareLinks,
} from "@/db/schema/trackables"
import { users } from "@/db/schema/users"

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>

export type Workspace = InferSelectModel<typeof workspaces>
export type NewWorkspace = InferInsertModel<typeof workspaces>

export type WorkspaceMember = InferSelectModel<typeof workspaceMembers>
export type NewWorkspaceMember = InferInsertModel<typeof workspaceMembers>

export type TrackableItem = InferSelectModel<typeof trackableItems>
export type NewTrackableItem = InferInsertModel<typeof trackableItems>

export type TrackableAccessGrant = InferSelectModel<
  typeof trackableAccessGrants
>
export type NewTrackableAccessGrant = InferInsertModel<
  typeof trackableAccessGrants
>

export type TrackableShareLink = InferSelectModel<typeof trackableShareLinks>
export type NewTrackableShareLink = InferInsertModel<typeof trackableShareLinks>

export type TrackableForm = InferSelectModel<typeof trackableForms>
export type NewTrackableForm = InferInsertModel<typeof trackableForms>

export type TrackableFormField = InferSelectModel<typeof trackableFormFields>
export type NewTrackableFormField = InferInsertModel<typeof trackableFormFields>

export type TrackableFormSubmission = InferSelectModel<
  typeof trackableFormSubmissions
>
export type NewTrackableFormSubmission = InferInsertModel<
  typeof trackableFormSubmissions
>

export type TrackableFormAnswer = InferSelectModel<typeof trackableFormAnswers>
export type NewTrackableFormAnswer = InferInsertModel<
  typeof trackableFormAnswers
>

export type ApiKey = InferSelectModel<typeof apiKeys>
export type NewApiKey = InferInsertModel<typeof apiKeys>

export type TrackableApiUsageEvent = InferSelectModel<
  typeof trackableApiUsageEvents
>
export type NewTrackableApiUsageEvent = InferInsertModel<
  typeof trackableApiUsageEvents
>

export type BatchJob = InferSelectModel<typeof batchJobs>
export type NewBatchJob = InferInsertModel<typeof batchJobs>

export type BatchJobRun = InferSelectModel<typeof batchJobRuns>
export type NewBatchJobRun = InferInsertModel<typeof batchJobRuns>

export type BatchJobLease = InferSelectModel<typeof batchJobLeases>
export type NewBatchJobLease = InferInsertModel<typeof batchJobLeases>
