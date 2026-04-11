import assert from "node:assert/strict";
import test from "node:test";

import { render } from "@react-email/render";
import { createElement } from "react";

import { ChangeEmail } from "@/emails/change-email";
import ResetPasswordEmail from "@/emails/reset-password";
import VerifyEmail from "@/emails/verify-email";

test("email templates inline configured font utilities", async () => {
	const templates = [
		createElement(VerifyEmail, {
			name: "Jamie",
			verificationUrl: "https://example.com/verify",
		}),
		createElement(ResetPasswordEmail, {
			name: "Jamie",
			resetUrl: "https://example.com/reset",
		}),
		createElement(ChangeEmail, {
			name: "Jamie",
			confirmationUrl: "https://example.com/change",
		}),
	];

	for (const template of templates) {
		const html = await render(template);

		assert.equal(html.includes('class="font-dropbox"'), false);
		assert.equal(html.includes('class="font-dropbox-sans"'), false);
		assert.match(html, /font-family:[^"]*Avenir Next/i);
	}
});

test("change-email email explains the two-step verification flow", async () => {
	const html = await render(
		createElement(ChangeEmail, {
			name: "Jamie",
			confirmationUrl: "https://example.com/change",
		}),
	);

	assert.match(html, /confirm the change here/i);
	assert.match(html, /send a verification link to your new email address/i);
	assert.match(html, /confirm email change/i);
});

test("verify-email template uses neutral wording", async () => {
	const html = await render(
		createElement(VerifyEmail, {
			name: "Jamie",
			verificationUrl: "https://example.com/verify",
		}),
	);

	assert.match(html, /please verify your email address to continue using trackables/i);
	assert.doesNotMatch(html, /welcome to your new trackables account/i);
});
