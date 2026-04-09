import assert from "node:assert/strict"
import test from "node:test"
import { fireEvent, render } from "@testing-library/react"

import { setupTestDom } from "@/components/date-range-input/__tests__/test-dom"
import {
  AccountSettingsDialog,
  AccountSettingsDialogPage,
} from "@/components/account-settings-dialog"

test("account settings dialog renders the default page and sidebar items", () => {
  const teardown = setupTestDom()

  try {
    const view = render(
      <AccountSettingsDialog open onOpenChange={() => {}} initialPage="privacy">
        <AccountSettingsDialogPage id="general" label="General" title="General">
          <div>General content</div>
        </AccountSettingsDialogPage>
        <AccountSettingsDialogPage id="privacy" label="Privacy" title="Privacy">
          <div>Privacy content</div>
        </AccountSettingsDialogPage>
        <AccountSettingsDialogPage id="api-keys" label="API keys" title="API keys">
          <div>API key content</div>
        </AccountSettingsDialogPage>
      </AccountSettingsDialog>
    )

    assert.equal(
      view.getByText("Account Settings").textContent,
      "Account Settings"
    )
    assert.equal(
      view.getByText("Privacy content").textContent,
      "Privacy content"
    )
    assert.equal(
      view.getByRole("button", { name: "Privacy" }).textContent,
      "Privacy"
    )
    assert.equal(
      view.getByRole("button", { name: "API keys" }).textContent,
      "API keys"
    )
    assert.equal(view.queryByText("General content"), null)
  } finally {
    teardown()
  }
})

test("account settings dialog swaps pages without closing", () => {
  const teardown = setupTestDom()

  try {
    const view = render(
      <AccountSettingsDialog open onOpenChange={() => {}} initialPage="privacy">
        <AccountSettingsDialogPage id="general" label="General" title="General">
          <div>General content</div>
        </AccountSettingsDialogPage>
        <AccountSettingsDialogPage id="privacy" label="Privacy" title="Privacy">
          <div>Privacy content</div>
        </AccountSettingsDialogPage>
        <AccountSettingsDialogPage id="api-keys" label="API keys" title="API keys">
          <div>API key content</div>
        </AccountSettingsDialogPage>
      </AccountSettingsDialog>
    )

    fireEvent.click(view.getByRole("button", { name: "API keys" }))

    assert.equal(
      view.getByText("API key content").textContent,
      "API key content"
    )
    assert.equal(view.queryByText("Privacy content"), null)
    assert.equal(
      view.getByText("Account Settings").textContent,
      "Account Settings"
    )
  } finally {
    teardown()
  }
})

test("account settings dialog resets to the default page when reopened", () => {
  const teardown = setupTestDom()

  try {
    const view = render(
      <AccountSettingsDialog open onOpenChange={() => {}} initialPage="privacy">
        <AccountSettingsDialogPage id="general" label="General" title="General">
          <div>General content</div>
        </AccountSettingsDialogPage>
        <AccountSettingsDialogPage id="privacy" label="Privacy" title="Privacy">
          <div>Privacy content</div>
        </AccountSettingsDialogPage>
        <AccountSettingsDialogPage id="api-keys" label="API keys" title="API keys">
          <div>API key content</div>
        </AccountSettingsDialogPage>
      </AccountSettingsDialog>
    )

    fireEvent.click(view.getByRole("button", { name: "API keys" }))
    view.rerender(
      <AccountSettingsDialog
        open={false}
        onOpenChange={() => {}}
        initialPage="privacy"
      >
        <AccountSettingsDialogPage id="general" label="General" title="General">
          <div>General content</div>
        </AccountSettingsDialogPage>
        <AccountSettingsDialogPage id="privacy" label="Privacy" title="Privacy">
          <div>Privacy content</div>
        </AccountSettingsDialogPage>
        <AccountSettingsDialogPage id="api-keys" label="API keys" title="API keys">
          <div>API key content</div>
        </AccountSettingsDialogPage>
      </AccountSettingsDialog>
    )
    view.rerender(
      <AccountSettingsDialog open onOpenChange={() => {}} initialPage="privacy">
        <AccountSettingsDialogPage id="general" label="General" title="General">
          <div>General content</div>
        </AccountSettingsDialogPage>
        <AccountSettingsDialogPage id="privacy" label="Privacy" title="Privacy">
          <div>Privacy content</div>
        </AccountSettingsDialogPage>
      </AccountSettingsDialog>
    )

    assert.equal(
      view.getByText("Privacy content").textContent,
      "Privacy content"
    )
    assert.equal(view.queryByRole("button", { name: "API keys" }), null)
  } finally {
    teardown()
  }
})
