import { getPublicAppConfig } from "@/lib/public-app-config"
import { SignInPageClient } from "./sign-in-page-client"

export function SignInPageEntry({
  initialEmail,
  redirectUrl,
}: {
  initialEmail: string
  redirectUrl: string
}) {
  const showMicrosoftSignIn = Boolean(process.env.MICROSOFT_CLIENT_ID?.trim())
  const { authEmailServiceEnabled } = getPublicAppConfig()

  return (
    <SignInPageClient
      authEmailServiceEnabled={authEmailServiceEnabled}
      initialEmail={initialEmail}
      redirectUrl={redirectUrl}
      showMicrosoftSignIn={showMicrosoftSignIn}
    />
  )
}
