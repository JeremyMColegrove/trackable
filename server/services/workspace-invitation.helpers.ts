import type { WorkspaceRole } from "@/server/services/access-control.service"

export type WorkspaceInvitationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "revoked"

export type WorkspaceInvitationDecisionState =
  | "actionable"
  | "accepted"
  | "rejected"
  | "revoked"

export type WorkspaceInvitationAcceptanceMembershipAction =
  | "none"
  | "restore"
  | "create"

export function normalizeWorkspaceInvitationEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getWorkspaceRoleLabel(role: WorkspaceRole) {
  if (role === "owner") {
    return "Owner"
  }

  if (role === "admin") {
    return "Admin"
  }

  if (role === "viewer") {
    return "Viewer"
  }

  return "Member"
}

export function getWorkspaceInvitationDecisionState(input: {
  status: WorkspaceInvitationStatus
}): WorkspaceInvitationDecisionState {
  if (input.status === "accepted") {
    return "accepted"
  }

  if (input.status === "rejected") {
    return "rejected"
  }

  if (input.status === "revoked") {
    return "revoked"
  }

  return "actionable"
}

export function getWorkspaceInvitationAcceptanceMembershipAction(input: {
  hasActiveMembership: boolean
  hasRevokedMembership: boolean
}): WorkspaceInvitationAcceptanceMembershipAction {
  if (input.hasActiveMembership) {
    return "none"
  }

  if (input.hasRevokedMembership) {
    return "restore"
  }

  return "create"
}
