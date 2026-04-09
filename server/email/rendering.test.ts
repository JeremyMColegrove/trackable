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
