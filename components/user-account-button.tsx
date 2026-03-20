"use client"

import { UserButton, useUser } from "@clerk/nextjs"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, Shield } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { useTRPC } from "@/trpc/client"
import { T, useGT } from "gt-next";

export function UserAccountButton() {
    const gt = useGT();
  return (
    <UserButton>
      <UserButton.UserProfilePage
        label={gt("Privacy")}
        labelIcon={<Shield className="size-4" />}
        url="privacy"
      >
        <ProfilePrivacyPage />
      </UserButton.UserProfilePage>
    </UserButton>
  )
}

function ProfilePrivacyPage() {
  const { user } = useUser()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const queryKey = trpc.account.getProfilePrivacy.queryKey()
  const profilePrivacyQuery = useQuery(
    trpc.account.getProfilePrivacy.queryOptions()
  )

  const updateProfilePrivacy = useMutation(
    trpc.account.updateProfilePrivacy.mutationOptions({
      onMutate: async (values) => {
        await queryClient.cancelQueries({ queryKey })

        const previousPrivacy = queryClient.getQueryData<{
          isProfilePrivate: boolean
        }>(queryKey)

        queryClient.setQueryData(queryKey, {
          isProfilePrivate: values.isProfilePrivate,
        })

        return { previousPrivacy }
      },
      onError: (_error, _values, context) => {
        if (context?.previousPrivacy) {
          queryClient.setQueryData(queryKey, context.previousPrivacy)
        }
      },
      onSuccess: async (data) => {
        queryClient.setQueryData(queryKey, data)
        await user?.reload()
      },
    })
  )

  const isProfilePrivate =
    profilePrivacyQuery.data?.isProfilePrivate ??
    user?.publicMetadata?.isProfilePrivate === true

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          
                            <T>Profile privacy</T>
                          </h2>
        <p className="text-sm text-muted-foreground">
          
                            <T>Hide your profile from other users across Trackable.</T>
                          </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground"><T>Private profile</T></p>
          <p className="text-sm text-muted-foreground">
            
                                  <T>When enabled, your profile is treated as private by the app.</T>
                                </p>
        </div>
        <Switch
          checked={isProfilePrivate}
          disabled={
            profilePrivacyQuery.isLoading || updateProfilePrivacy.isPending
          }
          onCheckedChange={(checked) =>
            updateProfilePrivacy.mutate({ isProfilePrivate: checked })
          }
        />
      </div>

      {profilePrivacyQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          
                            <T>Loading privacy settings...</T>
                          </div>
      ) : null}

      {updateProfilePrivacy.error ? (
        <p className="text-sm text-destructive">
          
                            <T>Failed to update your privacy setting. Please try again.</T>
                          </p>
      ) : null}
    </div>
  )
}
