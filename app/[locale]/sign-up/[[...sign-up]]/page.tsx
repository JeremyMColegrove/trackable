import { AuthModal } from "@/components/auth/auth-modal";
import { LandingPage } from "../../landing-page";
import { SignUpPageClient } from "./sign-up-page-client";

export default function SignUpPage() {
	return (
		<>
			<LandingPage />
			<AuthModal>
				<SignUpPageClient />
			</AuthModal>
		</>
	);
}
