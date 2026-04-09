"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useTRPC } from "@/trpc/client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { T, useGT } from "gt-next"

export function ProfilePrivacyPage() {
  const gt = useGT()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const queryKey = trpc.account.getProfilePrivacy.queryKey()
  type ProfilePrivacyQueryData = {
    hasAdminControls: boolean
    isProfilePrivate: boolean
  }
  const profilePrivacyQuery = useQuery(
    trpc.account.getProfilePrivacy.queryOptions()
  )

  const updateProfilePrivacy = useMutation(
    trpc.account.updateProfilePrivacy.mutationOptions({
      onMutate: async (values) => {
        await queryClient.cancelQueries({ queryKey })

        const previousPrivacy =
          queryClient.getQueryData<ProfilePrivacyQueryData>(queryKey)

        queryClient.setQueryData(queryKey, {
          hasAdminControls: previousPrivacy?.hasAdminControls ?? false,
          isProfilePrivate: values.isProfilePrivate,
        })

        return { previousPrivacy }
      },
      onError: (_error, _values, context) => {
        if (context?.previousPrivacy) {
          queryClient.setQueryData(queryKey, context.previousPrivacy)
        }
      },
      onSuccess: (data) => {
        queryClient.setQueryData(
          queryKey,
          (previous: ProfilePrivacyQueryData | undefined) => ({
            hasAdminControls: previous?.hasAdminControls ?? false,
            isProfilePrivate: data.isProfilePrivate,
          })
        )
      },
    })
  )

  const isProfilePrivate = profilePrivacyQuery.data?.isProfilePrivate ?? false
  const isLoadingPrivacy =
    profilePrivacyQuery.isLoading && !profilePrivacyQuery.data

  return (
    <div className="space-y-4">
      {isLoadingPrivacy ? (
        <div
          aria-label={gt("Loading privacy settings")}
          className="rounded-lg border p-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              <T>Private profile</T>
            </p>
            <p className="text-sm text-muted-foreground">
              <T>
                When enabled, your profile is treated as private by the app.
              </T>
            </p>
          </div>
          <Switch
            checked={isProfilePrivate}
            disabled={updateProfilePrivacy.isPending}
            onCheckedChange={(checked) =>
              updateProfilePrivacy.mutate({ isProfilePrivate: checked })
            }
          />
        </div>
      )}

      {updateProfilePrivacy.error ? (
        <p className="text-sm text-destructive">
          <T>Failed to update your privacy setting. Please try again.</T>
        </p>
      ) : null}
    </div>
  )
}
