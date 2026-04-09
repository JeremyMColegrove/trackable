import "server-only";

import { render, toPlainText } from "@react-email/render";
import { Queue } from "bullmq";
import { createElement } from "react";

import { getLogger } from "@/lib/logger";
import { createBullRedisConnection } from "@/server/redis/redis-client";
import {
	ChangeEmail,
	type TrackablesChangeEmailProps,
} from "../../emails/change-email";
import ResetPasswordEmail, {
	type TrackablesResetPasswordEmailProps,
} from "../../emails/reset-password";
import VerifyEmail, {
	type TrackablesVerifyEmailProps,
} from "../../emails/verify-email";

const logger = getLogger("email");

const EMAIL_QUEUE_NAME = process.env.EMAIL_QUEUE_NAME ?? "email-queue";
const EMAIL_QUEUE_JOB_NAME =
	process.env.EMAIL_QUEUE_JOB_NAME ?? "email-queue-job";

type EmailJob = {
	to: string;
	subject: string;
	html: string;
	text: string;
	template: "auth.verify-email" | "auth.reset-password" | "auth.change-email";
	metadata?: Record<string, unknown> | null;
};

let emailQueue: Queue<EmailJob> | null = null;

function getEmailQueue() {
	if (!emailQueue) {
		emailQueue = new Queue<EmailJob>(EMAIL_QUEUE_NAME, {
			connection: createBullRedisConnection(),
		});
	}

	return emailQueue;
}

async function queueEmail(job: EmailJob) {
	await getEmailQueue().add(EMAIL_QUEUE_JOB_NAME, job, {
		attempts: 3,
		backoff: {
			delay: 5_000,
			type: "exponential",
		},
		removeOnComplete: 1_000,
		removeOnFail: 1_000,
	});

	if (process.env.NODE_ENV !== "production") {
		logger.info(
			{
				to: job.to,
				subject: job.subject,
				template: job.template,
				html: job.html,
			},
			"Queued outbound email with HTML preview.",
		);

		return;
	}

	logger.info(
		{
			to: job.to,
			subject: job.subject,
			template: job.template,
			metadata: job.metadata ?? null,
		},
		"Queued outbound email.",
	);
}

export async function sendVerifyEmail(
	data: TrackablesVerifyEmailProps & { email: string },
) {
	const html = await render(createElement(VerifyEmail, data));

	await queueEmail({
		to: data.email,
		subject: "Verify your Trackables email",
		html,
		text: toPlainText(html),
		template: "auth.verify-email",
		metadata: {
			category: "auth",
			purpose: "verify-email",
		},
	});
}

export async function sendResetPasswordEmail(
	data: TrackablesResetPasswordEmailProps & { email: string },
) {
	const html = await render(createElement(ResetPasswordEmail, data));

	await queueEmail({
		to: data.email,
		subject: "Reset your Trackables password",
		html,
		text: toPlainText(html),
		template: "auth.reset-password",
		metadata: {
			category: "auth",
			purpose: "reset-password",
		},
	});
}

export async function sendChangeEmail(
	data: TrackablesChangeEmailProps & { email: string; newEmail: string },
) {
	const html = await render(createElement(ChangeEmail, data));

	await queueEmail({
		to: data.email,
		subject: "Confirm your Trackables email change",
		html,
		text: toPlainText(html),
		template: "auth.change-email",
		metadata: {
			category: "auth",
			purpose: "change-email",
			newEmail: data.newEmail,
		},
	});
}

export async function closeEmailQueue() {
	await emailQueue?.close();
	emailQueue = null;
}
