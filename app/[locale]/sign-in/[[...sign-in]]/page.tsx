import { AuthModal } from "@/components/auth/auth-modal";
import { LandingPage } from "../../landing-page";
import { SignInPageClient } from "./sign-in-page-client";

export default function SignInPage() {
	return (
		<>
			<LandingPage />
			<AuthModal>
				<SignInPageClient />
			</AuthModal>
		</>
	);
}
