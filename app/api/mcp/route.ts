/**
 * MCP HTTP Transport Route
 *
 * Handles all MCP JSON-RPC requests via the Streamable HTTP transport.
 * Each POST request is stateless and independent.
 *
 * Auth flow:
 * 1. Authenticate via Clerk (`auth()`) requiring an OAuth token.
 * 2. Build a scoped McpServer with the resolved auth context
 * 3. Delegate to WebStandardStreamableHTTPServerTransport
 *
 * The business layer never receives raw tokens — only McpAuthContext.
 */

import { logger } from "@/lib/logger"
import { getRuntimeConfig } from "@/lib/runtime-config"
import { validateCustomMcpToken } from "@/server/mcp/auth/custom-token-auth"
import {
  McpAuthContextImpl,
  type McpAuthContext,
} from "@/server/mcp/auth/mcp-auth-context"
import { buildMcpServer } from "@/server/mcp/mcp-server"
import { auth } from "@clerk/nextjs/server"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { type NextRequest, NextResponse } from "next/server"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
}

/**
 * Resolves the MCP auth context from the incoming request.
 *
 * When `customMCPServerTokens` is enabled in config, tokens beginning with
 * `trk_mcp_` are validated against the local mcp_access_tokens table.
 * All other tokens (or when the flag is disabled) fall through to Clerk auth.
 */
async function resolveMcpAuth(
  req: NextRequest
): Promise<McpAuthContext | null> {
  const config = getRuntimeConfig()

  if (config.features.customMCPServerTokens) {
    const raw =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""
    if (raw.startsWith("trk_mcp_")) {
      return validateCustomMcpToken(raw)
    }
  }

  const context = await auth({ acceptsToken: ["oauth_token", "api_key"] })
  if (!context.isAuthenticated || !context.userId) return null
  return new McpAuthContextImpl({
    userId: context.userId,
    scopes: context.scopes ?? [],
  })
}

export async function OPTIONS(_req: NextRequest): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest): Promise<Response> {
  logger.info(
    {
      hasAuth: req.headers.has("authorization"),
      authPrefix: req.headers.get("authorization")?.substring(0, 30),
      method: req.method,
      contentType: req.headers.get("content-type"),
    },
    "MCP request received"
  )

  const authContext = await resolveMcpAuth(req)

  if (!authContext) {
    logger.warn("Attempted to access MCP server without valid token.")
    return NextResponse.json(
      {
        error: true,
        code: "UNAUTHORIZED",
        message: "Valid access token is required.",
      },
      { status: 401, headers: CORS_HEADERS }
    )
  }

  const server = buildMcpServer(authContext)

  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless mode: no session ID, no in-memory state between requests
    sessionIdGenerator: undefined,
    // Return JSON responses instead of SSE streams for simple request/response tools
    enableJsonResponse: true,
  })

  await server.connect(transport)

  const response = await transport.handleRequest(req)

  // Attach CORS headers to the MCP response
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * GET handler for SSE stream connections (optional long-lived sessions).
 * Currently responds with a guidance message — stateless JSON mode is preferred.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const authContext = await resolveMcpAuth(req)

  if (!authContext) {
    return NextResponse.json(
      {
        error: true,
        code: "UNAUTHORIZED",
        message: "Valid auth context is required.",
      },
      { status: 401, headers: CORS_HEADERS }
    )
  }

  const server = buildMcpServer(authContext)

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  await server.connect(transport)

  const response = await transport.handleRequest(req)

  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
