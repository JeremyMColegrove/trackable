/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <explanation> */
"use client"

import { useWorkspaceContext } from "@/app/[locale]/dashboard/workspace-context-provider"
import { WorkspaceTierDialog } from "@/app/[locale]/dashboard/workspace-tier-dialog"
import { useAppSettings } from "@/components/app-settings-provider"
import { PageShell } from "@/components/page-shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LimitUsageBadge } from "@/components/ui/limit-usage-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useTRPC } from "@/trpc/client"
import { useSession } from "@/lib/auth-client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { T, useGT } from "gt-next"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { InviteMemberDialog } from "./invite-member-dialog"
import {
  formatDateLabel,
  getDisplayName,
  getInitials,
  type MyInvitationRow,
  type PendingInvitationRow,
  type TeamAccessRow,
  type TeamMemberRow,
} from "./team-page-shared"

function WorkspaceAccessDescription({ role }: { role: TeamAccessRow["role"] }) {
  if (role === "viewer") {
    return <T>View only</T>
  }

  if (role === "member") {
    return <T>Edit trackables</T>
  }

  return <T>Manage workspace & trackables</T>
}

function StatusDot({ tone }: { tone: "active" | "pending" }) {
  return (
    <span
      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
        tone === "active" ? "bg-green-500" : "bg-orange-400"
      }`}
      aria-hidden="true"
    />
  )
}

export function TeamPageClient() {
  return <TeamPageContent />
}

function TeamPageContent() {
  const gt = useGT()
  const { data: session } = useSession()
  const { getTierLimits, subscriptionEnforcementEnabled } = useAppSettings()
  const {
    currentTier,
    isLoading: isWorkspaceContextLoading,
    activeWorkspace,
  } = useWorkspaceContext()
  const [memberToRemove, setMemberToRemove] = useState<TeamMemberRow | null>(
    null
  )
  const [invitationToRevoke, setInvitationToRevoke] =
    useState<PendingInvitationRow | null>(null)
  const [tierDialogOpen, setTierDialogOpen] = useState(false)
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const membersQuery = useQuery(trpc.team.listMembers.queryOptions())
  const myInvitationsQuery = useQuery(
    trpc.team.listMyPendingInvitations.queryOptions()
  )

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const currentUserId = session?.user?.id ?? null
  const maxWorkspaceMembers = getTierLimits(currentTier).maxWorkspaceMembers
  const isCheckingMemberLimit =
    subscriptionEnforcementEnabled &&
    (isWorkspaceContextLoading || membersQuery.isLoading)
  const hasReachedMemberLimit =
    subscriptionEnforcementEnabled &&
    maxWorkspaceMembers !== null &&
    members.length >= maxWorkspaceMembers
  const currentMember = members.find((member) => member.id === currentUserId)
  const canManageTeam =
    currentMember?.role === "owner" || currentMember?.role === "admin"

  const pendingInvitationsQuery = useQuery(
    trpc.team.listPendingInvitations.queryOptions(undefined, {
      enabled: canManageTeam,
    })
  )

  const updateMemberRole = useMutation(
    trpc.team.updateMemberRole.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.team.listMembers.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.account.getWorkspaceContext.queryKey(),
          }),
        ])
      },
      onError: (err) => toast.error(err.message),
    })
  )

  const acceptInvitation = useMutation(
    trpc.team.acceptInvitation.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.team.listMyPendingInvitations.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.account.getWorkspaceContext.queryKey(),
          }),
        ])

        toast.success(gt("Invitation accepted."))
      },
      onError: (err) => toast.error(err.message),
    })
  )

  const rejectInvitation = useMutation(
    trpc.team.rejectInvitation.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.team.listMyPendingInvitations.queryKey(),
        })

        toast.success(gt("Invitation rejected."))
      },
      onError: (err) => toast.error(err.message),
    })
  )

  const revokeInvitation = useMutation(
    trpc.team.revokeInvitation.mutationOptions({
      onSuccess: async () => {
        setInvitationToRevoke(null)
        await queryClient.invalidateQueries({
          queryKey: trpc.team.listPendingInvitations.queryKey(),
        })

        toast.success(gt("Invitation revoked."))
      },
      onError: (err) => toast.error(err.message),
    })
  )

  const removeMember = useMutation(
    trpc.team.removeMember.mutationOptions({
      onSuccess: async () => {
        setMemberToRemove(null)
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.team.listMembers.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.team.getMemberCount.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.dashboard.getTrackables.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.dashboard.getMetrics.queryKey(),
          }),
        ])
      },
      onError: (err) => toast.error(err.message),
    })
  )

  const myInvitations = myInvitationsQuery.data ?? []
  const pendingInvitations = useMemo(
    () =>
      (pendingInvitationsQuery.data ?? []).map((invitation) => ({
        ...invitation,
        rowType: "invitation" as const,
      })),
    [pendingInvitationsQuery.data]
  )
  const memberRows = useMemo(
    () =>
      members.map((member) => ({
        ...member,
        rowType: "member" as const,
      })),
    [members]
  )
  const accessRows = useMemo<TeamAccessRow[]>(
    () => [...memberRows, ...pendingInvitations],
    [memberRows, pendingInvitations]
  )
  const removingMemberId = removeMember.variables?.memberUserId ?? null
  const acceptingInvitationId = acceptInvitation.variables?.invitationId ?? null
  const rejectingInvitationId = rejectInvitation.variables?.invitationId ?? null
  const revokingInvitationId = revokeInvitation.variables?.invitationId ?? null
  const removeLabel =
    memberToRemove?.id === currentUserId
      ? gt("Leave team")
      : gt("Remove member")
  const removeDescription = memberToRemove
    ? memberToRemove.id === currentUserId
      ? gt(
          "Leave this team? You will lose access to the shared team trackables."
        )
      : `${gt("Remove")} ${getDisplayName(memberToRemove)}${gt("from the team? They will lose access to the shared team trackables.")}`
    : ""
  const revokeDescription = invitationToRevoke
    ? `${gt("Revoke the invitation for")}  ${
        invitationToRevoke.invitedDisplayName || invitationToRevoke.invitedEmail
      }${gt("? They will need a new invitation to join this workspace.")}`
    : ""

  const teamMemberColumns = useMemo<ColumnDef<TeamAccessRow>[]>(() => {
    return [
      {
        accessorKey: "displayName",
        header: gt("Member"),
        cell: ({ row }) => {
          const entry = row.original
          const isInvitation = entry.rowType === "invitation"
          const label = isInvitation
            ? entry.invitedDisplayName ||
              entry.invitedEmail ||
              gt("Pending invite")
            : getDisplayName(entry)

          return (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <StatusDot tone={isInvitation ? "pending" : "active"} />
                <Avatar>
                  <AvatarImage src={entry.imageUrl ?? undefined} alt={label} />
                  <AvatarFallback>{getInitials(label)}</AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{label}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {isInvitation
                    ? (entry.invitedEmail ?? gt("No email"))
                    : (entry.primaryEmail ?? gt("No email"))}
                </p>
              </div>
            </div>
          )
        },
        enableHiding: false,
      },
      {
        accessorKey: "roleLabel",
        header: gt("Role"),
        cell: ({ row }: { row: { original: TeamAccessRow } }) => {
          const entry = row.original

          if (entry.rowType === "invitation") {
            return <Badge variant="outline">{entry.roleLabel}</Badge>
          }

          if (!canManageTeam || entry.isOwner || entry.id === currentUserId) {
            return <Badge variant="outline">{entry.roleLabel}</Badge>
          }

          return (
            <Select
              value={entry.role}
              onValueChange={(value) => {
                updateMemberRole.mutate({
                  memberUserId: entry.id,
                  role: value as "admin" | "member" | "viewer",
                })
              }}
              disabled={updateMemberRole.isPending}
            >
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{gt("Admin")}</SelectItem>
                <SelectItem value="member">{gt("Member")}</SelectItem>
                <SelectItem value="viewer">{gt("Viewer")}</SelectItem>
              </SelectContent>
            </Select>
          )
        },
      },
      {
        id: "access",
        header: gt("Access"),
        cell: ({ row }: { row: { original: TeamAccessRow } }) => (
          <span className="text-sm text-muted-foreground">
            <WorkspaceAccessDescription role={row.original.role} />
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const entry = row.original

          if (entry.rowType === "invitation") {
            return (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canManageTeam || revokeInvitation.isPending}
                  onClick={() => setInvitationToRevoke(entry)}
                >
                  {revokeInvitation.isPending &&
                  revokingInvitationId === entry.id
                    ? gt("Revoking...")
                    : gt("Revoke")}
                </Button>
              </div>
            )
          }

          const isCurrentUser = entry.id === currentUserId
          const isDisabled = entry.isOwner || !canManageTeam

          return (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isDisabled || removeMember.isPending}
                onClick={() => setMemberToRemove(entry)}
              >
                {removeMember.isPending && removingMemberId === entry.id
                  ? isCurrentUser
                    ? gt("Leaving...")
                    : gt("Removing...")
                  : isCurrentUser
                    ? gt("Leave")
                    : gt("Remove")}
              </Button>
            </div>
          )
        },
      },
    ]
  }, [
    canManageTeam,
    currentUserId,
    removeMember,
    removingMemberId,
    revokeInvitation.isPending,
    revokingInvitationId,
    updateMemberRole,
  ])

  return (
    <PageShell
      title={gt("Team")}
      description={gt(
        "Manage active workspace members and respond to workspace invitations."
      )}
      headerActions={
        canManageTeam ? (
          <InviteMemberDialog
            hasReachedMemberLimit={hasReachedMemberLimit}
            isCheckingMemberLimit={isCheckingMemberLimit}
            onRequireUpgrade={() => setTierDialogOpen(true)}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">
              {gt("Your invitations")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {gt("Invitations you can accept or reject.")}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {myInvitationsQuery.isLoading ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {gt("Loading invitations...")}
              </div>
            ) : myInvitations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {gt("No pending invitations.")}
              </div>
            ) : (
              myInvitations.map((invitation: MyInvitationRow) => (
                <div
                  key={invitation.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{invitation.workspaceName}</p>
                      <Badge variant="secondary">{invitation.roleLabel}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <T>Invited by</T> {invitation.invitedByDisplayName} (
                      {invitation.invitedByEmail})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <T>Sent</T> {formatDateLabel(invitation.createdAt)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        acceptInvitation.isPending || rejectInvitation.isPending
                      }
                      onClick={() =>
                        rejectInvitation.mutate({
                          invitationId: invitation.id,
                        })
                      }
                    >
                      {rejectInvitation.isPending &&
                      rejectingInvitationId === invitation.id
                        ? gt("Rejecting...")
                        : gt("Reject")}
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        acceptInvitation.isPending || rejectInvitation.isPending
                      }
                      onClick={() =>
                        acceptInvitation.mutate({
                          invitationId: invitation.id,
                        })
                      }
                    >
                      {acceptInvitation.isPending &&
                      acceptingInvitationId === invitation.id
                        ? gt("Accepting...")
                        : gt("Accept")}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center">
                <h2 className="text-base font-semibold">
                  {gt("Workspace access")}
                </h2>
                <LimitUsageBadge
                  current={members.length}
                  limit={maxWorkspaceMembers ?? 1}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {gt(
                  "Active members and pending invitations for this workspace."
                )}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <DataTable
              columns={teamMemberColumns}
              data={accessRows}
              showViewOptions={false}
              emptyMessage={
                membersQuery.isLoading || pendingInvitationsQuery.isLoading
                  ? gt("Loading workspace access...")
                  : gt("No members or invitations yet.")
              }
              initialPageSize={10}
            />
          </div>
        </section>
      </div>

      <Dialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => {
          if (!open && !removeMember.isPending) {
            setMemberToRemove(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{removeLabel}</DialogTitle>
            <DialogDescription>{removeDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={removeMember.isPending}
            >
              <T>Cancel</T>
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!memberToRemove || removeMember.isPending}
              onClick={() => {
                if (!memberToRemove) {
                  return
                }

                removeMember.mutate({
                  memberUserId: memberToRemove.id,
                })
              }}
            >
              {removeMember.isPending
                ? memberToRemove?.id === currentUserId
                  ? gt("Leaving...")
                  : gt("Removing...")
                : memberToRemove?.id === currentUserId
                  ? gt("Leave team")
                  : gt("Remove member")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(invitationToRevoke)}
        onOpenChange={(open) => {
          if (!open && !revokeInvitation.isPending) {
            setInvitationToRevoke(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{gt("Revoke invitation")}</DialogTitle>
            <DialogDescription>{revokeDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInvitationToRevoke(null)}
              disabled={revokeInvitation.isPending}
            >
              <T>Cancel</T>
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!invitationToRevoke || revokeInvitation.isPending}
              onClick={() => {
                if (!invitationToRevoke) {
                  return
                }

                revokeInvitation.mutate({
                  invitationId: invitationToRevoke.id,
                })
              }}
            >
              {revokeInvitation.isPending
                ? gt("Revoking...")
                : gt("Revoke invitation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {subscriptionEnforcementEnabled ? (
        <WorkspaceTierDialog
          currentTier={currentTier}
          workspaceId={activeWorkspace?.id ?? ""}
          open={tierDialogOpen}
          onOpenChange={setTierDialogOpen}
        />
      ) : null}
    </PageShell>
  )
}
