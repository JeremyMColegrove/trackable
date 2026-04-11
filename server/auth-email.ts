import "server-only";

import { getRuntimeConfig } from "@/lib/runtime-config";
import {
	sendResetPasswordEmail,
	sendVerifyEmail,
} from "@/server/email";

type VerifyEmailData = Parameters<typeof sendVerifyEmail>[0];
type ResetPasswordEmailData = Parameters<typeof sendResetPasswordEmail>[0];

type AuthEmailService = {
	sendVerifyEmail(data: VerifyEmailData): Promise<unknown>;
	sendResetPasswordEmail(data: ResetPasswordEmailData): Promise<unknown>;
};

function buildVerifiedChangeEmailCallback(url: string) {
	try {
		const verificationUrl = new URL(url);
		const callbackURL = verificationUrl.searchParams.get("callbackURL");

		if (!callbackURL) {
			return url;
		}

		const parsedCallbackURL = new URL(callbackURL, "http://localhost");

		if (!parsedCallbackURL.pathname.endsWith("/auth/change-email")) {
			return url;
		}

		parsedCallbackURL.searchParams.set("complete", "1");
		verificationUrl.searchParams.set(
			"callbackURL",
			`${parsedCallbackURL.pathname}${parsedCallbackURL.search}${parsedCallbackURL.hash}`,
		);

		return verificationUrl.toString();
	} catch {
		return url;
	}
}

function getAuthEmailService(): AuthEmailService {
	return {
		sendVerifyEmail,
		sendResetPasswordEmail,
	};
}

export function buildAuthEmailSettings(
	emailService: AuthEmailService = getAuthEmailService(),
	options?: {
		emailServiceEnabled?: boolean;
	},
) {
	const emailServiceEnabled =
		options?.emailServiceEnabled ?? getRuntimeConfig().auth.emailServiceEnabled;

	const emailAndPassword = {
		enabled: true,
		requireEmailVerification: emailServiceEnabled,
	};

	const user = {
		changeEmail: {
			enabled: emailServiceEnabled,
		},
	};

	if (!emailServiceEnabled) {
		return {
			emailAndPassword,
			user,
		};
	}

	return {
		emailVerification: {
			sendVerificationEmail: async ({
				user,
				url,
			}: {
				user: { email: string; name?: string | null };
				url: string;
				token: string;
			}) => {
				await emailService.sendVerifyEmail({
					email: user.email,
					name: user.name ?? undefined,
					verificationUrl: buildVerifiedChangeEmailCallback(url),
				});
			},
		},
		emailAndPassword: {
			...emailAndPassword,
			sendResetPassword: async ({
				user,
				url,
			}: {
				user: { email: string; name?: string | null };
				url: string;
				token: string;
			}) => {
				await emailService.sendResetPasswordEmail({
					email: user.email,
					name: user.name ?? undefined,
					resetUrl: url,
				});
			},
		},
		user: {
			changeEmail: user.changeEmail,
		},
	};
}
