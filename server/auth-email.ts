import "server-only";

import { getRuntimeConfig } from "@/lib/runtime-config";
import {
	sendChangeEmail,
	sendResetPasswordEmail,
	sendVerifyEmail,
} from "@/server/email";

type VerifyEmailData = Parameters<typeof sendVerifyEmail>[0];
type ResetPasswordEmailData = Parameters<typeof sendResetPasswordEmail>[0];
type ChangeEmailData = Parameters<typeof sendChangeEmail>[0];

type AuthEmailService = {
	sendVerifyEmail(data: VerifyEmailData): Promise<unknown>;
	sendResetPasswordEmail(data: ResetPasswordEmailData): Promise<unknown>;
	sendChangeEmail(data: ChangeEmailData): Promise<unknown>;
};

function getAuthEmailService(): AuthEmailService {
	return {
		sendVerifyEmail,
		sendResetPasswordEmail,
		sendChangeEmail,
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
					verificationUrl: url,
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
			changeEmail: {
				...user.changeEmail,
				sendChangeEmailConfirmation: async ({
					user,
					newEmail,
					url,
				}: {
					user: { email: string; name?: string | null };
					newEmail: string;
					url: string;
					token: string;
				}) => {
					await emailService.sendChangeEmail({
						email: user.email,
						name: user.name ?? undefined,
						newEmail,
						confirmationUrl: url,
					});
				},
			},
		},
	};
}
