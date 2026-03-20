import { AuthModal } from "@/components/auth/auth-modal"

import { SignUpPageClient } from "../../../sign-up/[[...sign-up]]/sign-up-page-client"

export default function InterceptedSignUpPage() {
  return (
    <AuthModal>
      <SignUpPageClient />
    </AuthModal>
  )
}
