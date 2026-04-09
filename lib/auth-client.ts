"use client";

import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { lastLoginMethodClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_APP_URL!,
	plugins: [oauthProviderClient(), lastLoginMethodClient()],
});

export const { useSession, signIn, signOut, signUp } = authClient;
