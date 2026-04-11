import assert from "node:assert/strict"
import { mock } from "node:test"
import test from "node:test"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { setupTestDom } from "@/components/date-range-input/__tests__/test-dom"
import { authClient } from "@/lib/auth-client"

import { RecoveryPageClient } from "./recovery-page-client"

type LinkSocialInput = Parameters<typeof authClient.linkSocial>[0]

test("linking conflicts render the account-link form", () => {
  const teardown = setupTestDom()

  try {
    const view = render(
      <RecoveryPageClient
        error="account_not_linked"
        errorDescription={null}
        initialIsSignedIn={false}
        provider="microsoft"
        redirectUrl="/dashboard"
        shouldOfferAccountLink
        signInHref="/sign-in"
      />
    )

    assert.equal(
      view.getByRole("heading", { name: "Link your Microsoft account" })
        .textContent,
      "Link your Microsoft account"
    )
    assert.ok(view.getByLabelText("Email"))
    assert.ok(view.getByLabelText("Password"))
  } finally {
    teardown()
  }
})

test("generic auth errors render the fallback card", () => {
  const teardown = setupTestDom()

  try {
    const view = render(
      <RecoveryPageClient
        error="account_already_linked_to_different_user"
        errorDescription={null}
        initialIsSignedIn={false}
        provider={null}
        redirectUrl="/dashboard"
        shouldOfferAccountLink={false}
        signInHref="/sign-in"
      />
    )

    assert.equal(
      view.getByRole("heading", { name: "Sign-in issue" }).textContent,
      "Sign-in issue"
    )
    assert.equal(
      view.getByRole("link", { name: "Continue with email" }).getAttribute(
        "href"
      ),
      "/sign-in"
    )
  } finally {
    teardown()
  }
})

test("missing provider context keeps account collisions on the generic error state", () => {
  const teardown = setupTestDom()

  try {
    const view = render(
      <RecoveryPageClient
        error="account_not_linked"
        errorDescription={null}
        initialIsSignedIn={false}
        provider={null}
        redirectUrl="/dashboard"
        shouldOfferAccountLink={false}
        signInHref="/sign-in"
      />
    )

    assert.equal(view.queryByLabelText("Password"), null)
    assert.ok(view.getByRole("link", { name: "Continue with email" }))
  } finally {
    teardown()
  }
})

test("invalid credentials keep the user on the link form with an inline error", async () => {
  const teardown = setupTestDom()

  try {
    const restoreSignIn = mock.method(authClient.signIn, "email", async () => ({
      error: {
        message: "Invalid email or password",
      },
    }))
    const restoreLinkSocial = mock.method(authClient, "linkSocial", async () => {
      throw new Error("linkSocial should not run")
    })
    const user = userEvent.setup({ document: globalThis.document })
    const view = render(
      <RecoveryPageClient
        error="account_not_linked"
        errorDescription={null}
        initialIsSignedIn={false}
        provider="microsoft"
        redirectUrl="/dashboard/team"
        shouldOfferAccountLink
        signInHref="/sign-in?redirect_url=%2Fdashboard%2Fteam"
      />
    )

    await user.type(view.getByLabelText("Email"), "jeremy@example.com")
    await user.type(view.getByLabelText("Password"), "bad-password")
    await user.click(view.getByRole("button", { name: "Link Microsoft" }))

    assert.equal(
      view.getByText("Invalid email or password").textContent,
      "Invalid email or password"
    )
    assert.ok(view.getByLabelText("Email"))
    assert.ok(view.getByLabelText("Password"))
    restoreSignIn.mock.restore()
    restoreLinkSocial.mock.restore()
  } finally {
    teardown()
  }
})

test("successful credential re-auth starts provider linking with the preserved redirect", async () => {
  const teardown = setupTestDom()

  try {
    const calls: LinkSocialInput[] = []
    const restoreSignIn = mock.method(authClient.signIn, "email", async () => ({}))
    const restoreLinkSocial = mock.method(
      authClient,
      "linkSocial",
      async (input: LinkSocialInput) => {
        calls.push(input)
        return {}
      }
    )
    const user = userEvent.setup({ document: globalThis.document })
    const view = render(
      <RecoveryPageClient
        error="account_not_linked"
        errorDescription={null}
        initialIsSignedIn={false}
        provider="microsoft"
        redirectUrl="/dashboard/team"
        shouldOfferAccountLink
        signInHref="/sign-in?redirect_url=%2Fdashboard%2Fteam"
      />
    )

    await user.type(view.getByLabelText("Email"), "jeremy@example.com")
    await user.type(view.getByLabelText("Password"), "correct-password")
    await user.click(view.getByRole("button", { name: "Link Microsoft" }))

    assert.deepEqual(calls, [
      {
        provider: "microsoft",
        callbackURL: "/dashboard/team",
        errorCallbackURL:
          "/auth/recovery?provider=microsoft&redirect_url=%2Fdashboard%2Fteam",
      },
    ])
    restoreSignIn.mock.restore()
    restoreLinkSocial.mock.restore()
  } finally {
    teardown()
  }
})
