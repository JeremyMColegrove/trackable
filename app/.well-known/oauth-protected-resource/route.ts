/**
 * OAuth Protected Resource Metadata
 * RFC 9728 / MCP Authorization Spec
 *
 * ChatGPT discovers this endpoint before initiating OAuth to learn:
 *   - The canonical resource identifier (this MCP server's URL)
 *   - Which authorization server issues valid tokens
 *   - Which scopes are available
 *
 * GET https://your-domain.com/.well-known/oauth-protected-resource
 */

import { type NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS(_req: NextRequest): Promise<Response> {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(_req: NextRequest): Promise<Response> {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL;
	const clerkIssuerUrl = process.env.CLERK_ISSUER_URL;

	if (!appUrl || !clerkIssuerUrl) {
		return NextResponse.json(
			{ error: "NEXT_PUBLIC_APP_URL and CLERK_ISSUER_URL must be set." },
			{ status: 500 },
		);
	}

	const metadata = {
		resource: `${appUrl}/api/mcp`,
		authorization_servers: [clerkIssuerUrl],
		scopes_supported: ["openid", "profile", "email", "offline_access"],
		resource_documentation: `${appUrl}/docs/mcp`,
	};

	return NextResponse.json(metadata, {
		status: 200,
		headers: {
			...CORS_HEADERS,
			"Cache-Control": "public, max-age=3600",
		},
	});
}
