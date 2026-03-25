import assert from "node:assert/strict"
import test from "node:test"

import {
  getWorkspaceInvitationAcceptanceMembershipAction,
  getWorkspaceInvitationDecisionState,
  normalizeWorkspaceInvitationEmail,
} from "@/server/services/workspace-invitation.helpers"

test("normalizeWorkspaceInvitationEmail trims and lowercases email addresses", () => {
  assert.equal(
    normalizeWorkspaceInvitationEmail("  Person@Example.COM "),
    "person@example.com"
  )
})

test("getWorkspaceInvitationDecisionState only allows pending invitations to be acted on", () => {
  assert.equal(
    getWorkspaceInvitationDecisionState({ status: "pending" }),
    "actionable"
  )
  assert.equal(
    getWorkspaceInvitationDecisionState({ status: "accepted" }),
    "accepted"
  )
  assert.equal(
    getWorkspaceInvitationDecisionState({ status: "rejected" }),
    "rejected"
  )
  assert.equal(
    getWorkspaceInvitationDecisionState({ status: "revoked" }),
    "revoked"
  )
})

test("getWorkspaceInvitationAcceptanceMembershipAction avoids duplicate memberships", () => {
  assert.equal(
    getWorkspaceInvitationAcceptanceMembershipAction({
      hasActiveMembership: true,
      hasRevokedMembership: false,
    }),
    "none"
  )

  assert.equal(
    getWorkspaceInvitationAcceptanceMembershipAction({
      hasActiveMembership: false,
      hasRevokedMembership: true,
    }),
    "restore"
  )

  assert.equal(
    getWorkspaceInvitationAcceptanceMembershipAction({
      hasActiveMembership: false,
      hasRevokedMembership: false,
    }),
    "create"
  )
})
