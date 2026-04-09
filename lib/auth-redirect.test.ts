import assert from "node:assert/strict"
import test from "node:test"

import {
  getAuthRedirectQuery,
  resolveSafeAuthRedirectPath,
} from "@/lib/auth-redirect"

test("resolveSafeAuthRedirectPath keeps internal relative paths", () => {
  assert.equal(
    resolveSafeAuthRedirectPath("/dashboard/trackables?id=1#activity"),
    "/dashboard/trackables?id=1#activity"
  )
})

test("resolveSafeAuthRedirectPath rejects protocol-relative redirects", () => {
  assert.equal(resolveSafeAuthRedirectPath("//evil.example"), "/dashboard")
})

test("resolveSafeAuthRedirectPath rejects cross-origin absolute redirects", () => {
  assert.equal(
    resolveSafeAuthRedirectPath("https://evil.example/steal", {
      origin: "https://trackables.test",
    }),
    "/dashboard"
  )
})

test("resolveSafeAuthRedirectPath converts same-origin absolute redirects to paths", () => {
  assert.equal(
    resolveSafeAuthRedirectPath("https://trackables.test/dashboard?tab=team", {
      origin: "https://trackables.test",
    }),
    "/dashboard?tab=team"
  )
})

test("resolveSafeAuthRedirectPath rejects bare relative redirects", () => {
  assert.equal(
    resolveSafeAuthRedirectPath("dashboard/settings"),
    "/dashboard"
  )
})

test("resolveSafeAuthRedirectPath falls back for non-string or empty values", () => {
  assert.equal(resolveSafeAuthRedirectPath(undefined), "/dashboard")
  assert.equal(resolveSafeAuthRedirectPath(["/dashboard"]), "/dashboard")
  assert.equal(resolveSafeAuthRedirectPath("   "), "/dashboard")
})

test("getAuthRedirectQuery omits the default dashboard redirect", () => {
  assert.equal(getAuthRedirectQuery("/dashboard"), "")
})

test("getAuthRedirectQuery includes safe custom redirect targets", () => {
  assert.equal(
    getAuthRedirectQuery("/dashboard/trackables/123"),
    "?redirect_url=%2Fdashboard%2Ftrackables%2F123"
  )
})
