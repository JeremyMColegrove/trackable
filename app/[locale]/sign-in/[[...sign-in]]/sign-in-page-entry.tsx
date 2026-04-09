import { getPublicAppConfig } from "@/lib/public-app-config"
import { SignInPageClient } from "./sign-in-page-client"

export function SignInPageEntry({ redirectUrl }: { redirectUrl: string }) {
  const showMicrosoftSignIn = Boolean(process.env.MICROSOFT_CLIENT_ID?.trim())
  const { authEmailServiceEnabled } = getPublicAppConfig()

  return (
    <SignInPageClient
      authEmailServiceEnabled={authEmailServiceEnabled}
      redirectUrl={redirectUrl}
      showMicrosoftSignIn={showMicrosoftSignIn}
    />
  )
}
