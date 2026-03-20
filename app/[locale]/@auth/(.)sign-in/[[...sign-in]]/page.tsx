import { AuthModal } from "@/components/auth/auth-modal"

import { SignInPageClient } from "../../../sign-in/[[...sign-in]]/sign-in-page-client"

export default function InterceptedSignInPage() {
  return (
    <AuthModal>
      <SignInPageClient />
    </AuthModal>
  )
}
