export function getAppOrigin(): string {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  ).replace(/\/+$/, "")
}

export function getMcpResourceUrl(): string {
  return `${getAppOrigin()}/api/mcp`
}

export function getMcpProtectedResourceMetadataUrl(): string {
  return `${getAppOrigin()}/.well-known/oauth-protected-resource/api/mcp`
}

export const MCP_OAUTH_SECURITY_SCHEMES = [
  { type: "oauth2", scopes: ["openid"] },
] as const
