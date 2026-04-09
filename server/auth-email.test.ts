import assert from "node:assert/strict"
import test, { before } from "node:test"

import { registerServerOnlyMock } from "@/support/module-mocks/register-module-mocks"

registerServerOnlyMock()

let buildAuthEmailSettings: typeof import("@/server/auth-email").buildAuthEmailSettings

before(async () => {
  ;({ buildAuthEmailSettings } = await import("@/server/auth-email"))
})

type VerifyEmailData = {
  email: string
  name?: string | null
  verificationUrl: string
}

type ResetPasswordEmailData = {
  email: string
  name?: string | null
  resetUrl: string
}

type ChangeEmailData = {
  email: string
  name?: string | null
  newEmail: string
  confirmationUrl: string
}

class StubEmailService {
  public verifyEmails: VerifyEmailData[] = []
  public resetEmails: ResetPasswordEmailData[] = []
  public changeEmails: ChangeEmailData[] = []

  async sendVerifyEmail(data: VerifyEmailData) {
    this.verifyEmails.push(data)
  }

  async sendResetPasswordEmail(data: ResetPasswordEmailData) {
    this.resetEmails.push(data)
  }

  async sendChangeEmail(data: ChangeEmailData) {
    this.changeEmails.push(data)
  }
}

test("buildAuthEmailSettings disables email hooks when auth email delivery is off", () => {
  const settings = buildAuthEmailSettings(new StubEmailService(), {
    emailServiceEnabled: false,
  })

  assert.equal(settings.emailAndPassword.requireEmailVerification, false)
  assert.equal(settings.user.changeEmail.enabled, false)
  assert.equal("emailVerification" in settings, false)
})

test("buildAuthEmailSettings enables auth email hooks and dispatches through the email service", async () => {
  const emailService = new StubEmailService()
  const settings = buildAuthEmailSettings(emailService, {
    emailServiceEnabled: true,
  })

  if (!("emailVerification" in settings)) {
    assert.fail("Expected emailVerification settings to be enabled.")
  }

  if (!("sendResetPassword" in settings.emailAndPassword)) {
    assert.fail("Expected reset-password email handler to be enabled.")
  }

  if (!("sendChangeEmailConfirmation" in settings.user.changeEmail)) {
    assert.fail("Expected change-email confirmation handler to be enabled.")
  }

  await settings.emailVerification.sendVerificationEmail({
    user: {
      email: "user@example.com",
      name: "Jamie",
    },
    url: "https://example.com/verify?token=abc",
    token: "abc",
  })

  await settings.emailAndPassword.sendResetPassword({
    user: {
      email: "user@example.com",
      name: "Jamie",
    },
    url: "https://example.com/reset?token=abc",
    token: "abc",
  })

  await settings.user.changeEmail.sendChangeEmailConfirmation({
    user: {
      email: "user@example.com",
      name: "Jamie",
    },
    newEmail: "new@example.com",
    url: "https://example.com/change?token=abc",
    token: "abc",
  })

  assert.deepEqual(emailService.verifyEmails, [
    {
      email: "user@example.com",
      name: "Jamie",
      verificationUrl: "https://example.com/verify?token=abc",
    },
  ])
  assert.deepEqual(emailService.resetEmails, [
    {
      email: "user@example.com",
      name: "Jamie",
      resetUrl: "https://example.com/reset?token=abc",
    },
  ])
  assert.deepEqual(emailService.changeEmails, [
    {
      email: "user@example.com",
      name: "Jamie",
      newEmail: "new@example.com",
      confirmationUrl: "https://example.com/change?token=abc",
    },
  ])
})
