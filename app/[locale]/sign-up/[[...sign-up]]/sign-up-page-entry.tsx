import { getPublicAppConfig } from "@/lib/public-app-config"
import { SignUpPageClient } from "./sign-up-page-client"

export function SignUpPageEntry({ redirectUrl }: { redirectUrl: string }) {
  const showMicrosoftSignIn = Boolean(process.env.MICROSOFT_CLIENT_ID?.trim())
  const { authEmailServiceEnabled } = getPublicAppConfig()

  return (
    <SignUpPageClient
      authEmailServiceEnabled={authEmailServiceEnabled}
      redirectUrl={redirectUrl}
      showMicrosoftSignIn={showMicrosoftSignIn}
    />
  )
}
