/** biome-ignore-all lint/a11y/useAriaPropsSupportedByRole: <explanation> */
"use client"
import {
  ApiKeysPage,
  GeneralSettingsPage,
  ProfilePrivacyPage,
} from "@/components/account-settings"
import { useAppSettings } from "@/components/app-settings-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { UserAvatar } from "@/components/user-avatar"
import { signOut, useSession } from "@/lib/auth-client"
import { T, useGT } from "gt-next"
import { KeyRound, LogOut, Settings2, Shield, UserRound } from "lucide-react"
import { useState } from "react"
import {
  AccountSettingsDialog,
  AccountSettingsDialogPage,
} from "./account-settings-dialog"

export function UserAccountButton() {
  const gt = useGT()
  const { customMCPServerTokens } = useAppSettings()
  const { data: session, isPending } = useSession()
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false)

  if (isPending) {
    return <Skeleton className="size-8 rounded-full" />
  }

  const user = session?.user

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex size-10 items-center justify-center rounded-full border border-border/60 bg-background/80 p-0.5 shadow-xs transition-all outline-none hover:border-border hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={gt("Account menu")}
          >
            <UserAvatar
              className="size-9"
              fallbackClassName="bg-linear-to-br from-violet-500 via-indigo-500 to-sky-500 text-xs font-semibold text-white"
              imageUrl={user?.image}
              name={user?.name}
              email={user?.email}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={10} className="w-72">
          {user ? (
            <DropdownMenuLabel className="px-2 py-2 text-foreground">
              <div className="flex items-center gap-3">
                <UserAvatar
                  fallbackClassName="bg-linear-to-br from-violet-500 via-indigo-500 to-sky-500 text-sm font-semibold text-white"
                  imageUrl={user.image}
                  name={user.name}
                  email={user.email}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {user.name ? (
                    <p className="truncate text-sm leading-none font-semibold">
                      {user.name}
                    </p>
                  ) : null}
                  {user.email ? (
                    <p className="truncate text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
          ) : null}

          {user ? <DropdownMenuSeparator /> : null}

          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() => setIsAccountSettingsOpen(true)}
              className="min-h-10 rounded-xl px-3"
            >
              <Settings2 data-icon="inline-start" />
              <T>Account Settings</T>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() =>
                signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.href = "/"
                    },
                  },
                })
              }
              variant="destructive"
              className="min-h-10 rounded-xl px-3"
            >
              <LogOut data-icon="inline-start" />
              <T>Sign out</T>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountSettingsDialog
        open={isAccountSettingsOpen}
        onOpenChange={setIsAccountSettingsOpen}
        initialPage="general"
      >
        <AccountSettingsDialogPage
          id="general"
          label={<T>General</T>}
          icon={<UserRound />}
          title={<T>General</T>}
          description={<T>View the account details associated with your login.</T>}
        >
          <GeneralSettingsPage />
        </AccountSettingsDialogPage>
        <AccountSettingsDialogPage
          id="privacy"
          label={<T>Privacy</T>}
          icon={<Shield />}
          title={<T>Profile privacy</T>}
          description={
            <T>Hide your profile from other users across Trackable.</T>
          }
        >
          <ProfilePrivacyPage />
        </AccountSettingsDialogPage>
        {customMCPServerTokens ? (
          <AccountSettingsDialogPage
            id="api-keys"
            label={<T>API keys</T>}
            icon={<KeyRound />}
            title={<T>API keys</T>}
            description={<T>Manage the API keys connected to your account.</T>}
          >
            <ApiKeysPage />
          </AccountSettingsDialogPage>
        ) : null}
      </AccountSettingsDialog>
    </>
  )
}
