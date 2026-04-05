import assert from "node:assert/strict"
import test, { before, mock } from "node:test"

import { TRPCError } from "@trpc/server"

import type { db as DbType } from "@/db"
import type { AccessControlService as AccessControlServiceType } from "@/server/services/access-control.service"
import type { accessControlService as AccessControlServiceSingletonType } from "@/server/services/access-control.service"
import type {
  TrackableMutationService as TrackableMutationServiceType,
  assertTrackableArchiveConfirmation as AssertFnType,
} from "@/server/services/trackable-mutation.service"
import type { TrackableQueryService as TrackableQueryServiceType } from "@/server/services/trackable-query.service"
import { registerServerOnlyMock } from "@/support/module-mocks/register-module-mocks"

registerServerOnlyMock()

let db: typeof DbType
let accessControlService: typeof AccessControlServiceSingletonType
let AccessControlService: typeof AccessControlServiceType
let TrackableMutationService: typeof TrackableMutationServiceType
let assertTrackableArchiveConfirmation: typeof AssertFnType
let TrackableQueryService: typeof TrackableQueryServiceType

before(async () => {
  ;({ db } = await import("@/db"))
  ;({ accessControlService, AccessControlService } =
    await import("@/server/services/access-control.service"))
  ;({ TrackableMutationService, assertTrackableArchiveConfirmation } =
    await import("@/server/services/trackable-mutation.service"))
  ;({ TrackableQueryService } =
    await import("@/server/services/trackable-query.service"))
})

test("assertTrackableArchiveConfirmation rejects a mismatched confirmation name", () => {
  assert.throws(
    () =>
      assertTrackableArchiveConfirmation(
        {
          name: "Customer Feedback",
          archivedAt: null,
        },
        "customer feedback"
      ),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "BAD_REQUEST" &&
      error.message === "Trackable name does not match."
  )
})

test("TrackableMutationService.archive archives a trackable for a manager", async (t) => {
  t.after(() => mock.restoreAll())

  mock.method(accessControlService, "assertTrackableAccess", async () => ({
    id: "trackable-1",
    kind: "survey",
    workspaceId: "workspace-1",
  }))
  mock.method(db.query.trackableItems, "findFirst", async () => ({
    id: "trackable-1",
    name: "Customer Feedback",
    archivedAt: null,
  }))

  let archivedAtValue: Date | null = null

  mock.method(
    db,
    "update",
    () =>
      ({
        set(values: { archivedAt: Date }) {
          archivedAtValue = values.archivedAt

          return {
            where() {
              return {
                returning: async () => [
                  {
                    id: "trackable-1",
                    name: "Customer Feedback",
                    archivedAt: values.archivedAt,
                  },
                ],
              }
            },
          }
        },
      }) as never
  )

  const service = new TrackableMutationService()
  const archived = await service.archive({
    trackableId: "trackable-1",
    userId: "user-1",
    confirmationName: "Customer Feedback",
  })

  assert.equal(archived.id, "trackable-1")
  assert.equal(archived.name, "Customer Feedback")
  assert.ok(archived.archivedAt instanceof Date)
  assert.notEqual(archivedAtValue, null)
})

test("TrackableMutationService.archive rejects a mismatched confirmation name", async (t) => {
  t.after(() => mock.restoreAll())

  mock.method(accessControlService, "assertTrackableAccess", async () => ({
    id: "trackable-1",
    kind: "survey",
    workspaceId: "workspace-1",
  }))
  mock.method(db.query.trackableItems, "findFirst", async () => ({
    id: "trackable-1",
    name: "Customer Feedback",
    archivedAt: null,
  }))

  const updateMock = mock.method(
    db,
    "update",
    () =>
      ({
        set() {
          return {
            where() {
              return {
                returning: async () => [],
              }
            },
          }
        },
      }) as never
  )

  const service = new TrackableMutationService()

  await assert.rejects(
    () =>
      service.archive({
        trackableId: "trackable-1",
        userId: "user-1",
        confirmationName: "Wrong Name",
      }),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "BAD_REQUEST" &&
      error.message === "Trackable name does not match."
  )

  assert.equal(updateMock.mock.calls.length, 0)
})

test("TrackableMutationService.archive rejects non-managers", async (t) => {
  t.after(() => mock.restoreAll())

  mock.method(accessControlService, "assertTrackableAccess", async () => {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Trackable not found.",
    })
  })

  const service = new TrackableMutationService()

  await assert.rejects(
    () =>
      service.archive({
        trackableId: "trackable-1",
        userId: "user-2",
        confirmationName: "Customer Feedback",
      }),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "NOT_FOUND" &&
      error.message === "Trackable not found."
  )
})

test("TrackableMutationService.archive rejects an already archived trackable", async (t) => {
  t.after(() => mock.restoreAll())

  mock.method(accessControlService, "assertTrackableAccess", async () => ({
    id: "trackable-1",
    kind: "survey",
    workspaceId: "workspace-1",
  }))
  mock.method(db.query.trackableItems, "findFirst", async () => ({
    id: "trackable-1",
    name: "Customer Feedback",
    archivedAt: new Date("2026-01-01T00:00:00.000Z"),
  }))

  const updateMock = mock.method(
    db,
    "update",
    () =>
      ({
        set() {
          return {
            where() {
              return {
                returning: async () => [],
              }
            },
          }
        },
      }) as never
  )

  const service = new TrackableMutationService()

  await assert.rejects(
    () =>
      service.archive({
        trackableId: "trackable-1",
        userId: "user-1",
        confirmationName: "Customer Feedback",
      }),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "BAD_REQUEST" &&
      error.message === "Trackable is already archived."
  )

  assert.equal(updateMock.mock.calls.length, 0)
})

test("AccessControlService.assertTrackableAccess treats archived trackables as not found", async (t) => {
  t.after(() => mock.restoreAll())

  mock.method(db.query.trackableItems, "findFirst", async () => ({
    id: "trackable-1",
    kind: "survey",
    workspaceId: "workspace-1",
    archivedAt: new Date("2026-01-01T00:00:00.000Z"),
  }))

  const service = new AccessControlService()

  await assert.rejects(
    () => service.assertTrackableAccess("trackable-1", "user-1", "view"),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "NOT_FOUND" &&
      error.message === "Trackable not found."
  )
})

test("TrackableQueryService.getShellById does not surface archived trackables", async (t) => {
  t.after(() => mock.restoreAll())

  mock.method(accessControlService, "assertTrackableAccess", async () => ({
    id: "trackable-1",
    kind: "survey",
    workspaceId: "workspace-1",
  }))
  mock.method(db.query.trackableItems, "findFirst", async () => ({
    id: "trackable-1",
    kind: "survey",
    name: "Customer Feedback",
    description: null,
    workspaceId: "workspace-1",
    archivedAt: new Date("2026-01-01T00:00:00.000Z"),
    settings: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    submissionCount: 0,
    apiUsageCount: 0,
    lastSubmissionAt: null,
    lastApiUsageAt: null,
    activeFormId: null,
  }))

  const service = new TrackableQueryService()

  await assert.rejects(
    () => service.getShellById("trackable-1", "user-1"),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "NOT_FOUND" &&
      error.message === "Trackable not found."
  )
})

test("TrackableQueryService.getById does not surface archived trackables", async (t) => {
  t.after(() => mock.restoreAll())

  mock.method(accessControlService, "assertTrackableAccess", async () => ({
    id: "trackable-1",
    kind: "survey",
    workspaceId: "workspace-1",
  }))
  mock.method(db.query.trackableItems, "findFirst", async () => ({
    id: "trackable-1",
    kind: "survey",
    name: "Customer Feedback",
    description: null,
    workspaceId: "workspace-1",
    archivedAt: new Date("2026-01-01T00:00:00.000Z"),
    settings: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    submissionCount: 0,
    apiUsageCount: 0,
    lastSubmissionAt: null,
    lastApiUsageAt: null,
    activeFormId: null,
  }))

  const service = new TrackableQueryService()

  await assert.rejects(
    () => service.getById("trackable-1", "user-1"),
    (error: unknown) =>
      error instanceof TRPCError &&
      error.code === "NOT_FOUND" &&
      error.message === "Trackable not found."
  )
})
