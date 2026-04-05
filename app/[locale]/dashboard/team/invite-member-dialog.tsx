"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isWorkspaceMemberLimitMessage } from "@/lib/subscription-limit-messages"
import { useTRPC } from "@/trpc/client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { T, useGT } from "gt-next"
import throttle from "lodash/throttle"
import { Check, LoaderCircle, Search, UserPlus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { getDisplayName, getInitials } from "./team-page-shared"

const MEMBER_SEARCH_MIN_LENGTH = 2
const MEMBER_SEARCH_THROTTLE_MS = 300

export function InviteMemberDialog({
  hasReachedMemberLimit,
  isCheckingMemberLimit,
  onRequireUpgrade,
}: {
  hasReachedMemberLimit: boolean
  isCheckingMemberLimit: boolean
  onRequireUpgrade: () => void
}) {
  const gt = useGT()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [throttledSearch, setThrottledSearch] = useState("")
  const [selectedRole, setSelectedRole] = useState<
    "admin" | "member" | "viewer"
  >("viewer")
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const normalizedInput = search.trim()
  const hasEnoughCharacters = normalizedInput.length >= MEMBER_SEARCH_MIN_LENGTH
  const shouldSearch =
    open &&
    hasEnoughCharacters &&
    throttledSearch.length >= MEMBER_SEARCH_MIN_LENGTH

  const updateThrottledSearch = useMemo(
    () =>
      throttle(
        (value: string) => {
          setThrottledSearch(value.trim())
        },
        MEMBER_SEARCH_THROTTLE_MS,
        {
          leading: false,
          trailing: true,
        }
      ),
    []
  )

  useEffect(() => {
    if (!open || !hasEnoughCharacters) {
      updateThrottledSearch.cancel()
      return
    }

    updateThrottledSearch(search)

    return () => {
      updateThrottledSearch.cancel()
    }
  }, [hasEnoughCharacters, open, search, updateThrottledSearch])

  const searchQuery = useQuery(
    trpc.team.searchUsers.queryOptions(
      { query: throttledSearch },
      {
        enabled: shouldSearch,
        placeholderData: (previousData) => previousData,
      }
    )
  )

  const inviteMember = useMutation(
    trpc.team.inviteMember.mutationOptions({
      onSuccess: async () => {
        setOpen(false)
        setSearch("")

        await queryClient.invalidateQueries({
          queryKey: trpc.team.listPendingInvitations.queryKey(),
        })

        toast.success(gt("Invitation sent."))
      },
      onError: (err) => {
        if (isWorkspaceMemberLimitMessage(err.message)) {
          setOpen(false)
          onRequireUpgrade()
          return
        }

        toast.error(err.message)
      },
    })
  )

  const results = searchQuery.data ?? []
  const isWaitingForThrottle =
    hasEnoughCharacters && normalizedInput !== throttledSearch
  const hasSearched = hasEnoughCharacters && Boolean(throttledSearch)
  const isSearching =
    hasEnoughCharacters && (isWaitingForThrottle || searchQuery.isFetching)
  const searchStatusLabel = !hasSearched
    ? null
    : isSearching
      ? gt("Loading")
      : gt("Up to date")

  function handleInviteTriggerClick() {
    if (isCheckingMemberLimit) {
      return
    }

    if (hasReachedMemberLimit) {
      onRequireUpgrade()
      return
    }

    setOpen(true)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (!nextOpen) {
          setSearch("")
          setThrottledSearch("")
          updateThrottledSearch.cancel()
        }
      }}
    >
      <Button
        type="button"
        variant="default"
        size="lg"
        onClick={handleInviteTriggerClick}
        disabled={isCheckingMemberLimit}
      >
        <UserPlus data-icon="inline-start" />
        <T>Invite member</T>
      </Button>
      <DialogContent className="gap-3 pb-0 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <T>Invite member</T>
          </DialogTitle>
          <DialogDescription>
            <T>
              Search for an existing user by name or email to invite them to
              this workspace.
            </T>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">
              <T>Role for invited members</T>
            </Label>
            <Select
              value={selectedRole}
              onValueChange={(value) =>
                setSelectedRole(value as "admin" | "member" | "viewer")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  Admin (Manage Workspace & Trackables)
                </SelectItem>
                <SelectItem value="member">Member (Edit Trackables)</SelectItem>
                <SelectItem value="viewer">Viewer (View Only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={gt("Search by name or email")}
              className="pr-28 pl-9"
            />
            <div className="pointer-events-none absolute top-1/2 right-3 flex min-w-20 -translate-y-1/2 items-center justify-end gap-1.5 text-xs text-muted-foreground">
              {searchStatusLabel ? (
                <>
                  {isSearching ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>{searchStatusLabel}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pb-4">
            {!hasEnoughCharacters ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <T>Type at least 2 characters to search for users.</T>
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <T>No users matched that search.</T>
              </div>
            ) : (
              results.map((user) => {
                const label = getDisplayName(user)

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar>
                        <AvatarImage
                          src={user.imageUrl ?? undefined}
                          alt={label}
                        />
                        <AvatarFallback>{getInitials(label)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{label}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {user.primaryEmail}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        inviteMember.mutate({
                          invitedUserId: user.id,
                          role: selectedRole,
                        })
                      }
                      disabled={inviteMember.isPending}
                    >
                      <T>Invite</T>
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
