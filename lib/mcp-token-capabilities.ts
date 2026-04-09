import { z } from "zod"

import { MCP_TOOL_NAMES, type McpToolName } from "@/lib/mcp-tools"

export interface McpTokenCapabilities {
  tools: "all" | McpToolName[]
  workspaceIds?: string[]
  trackableIds?: string[]
}

const mcpToolNameSchema = z.enum(MCP_TOOL_NAMES)

export const mcpTokenCapabilitiesSchema = z.object({
  tools: z.union([z.literal("all"), z.array(mcpToolNameSchema).min(1)]),
  workspaceIds: z.array(z.string().uuid()).optional(),
  trackableIds: z.array(z.string().uuid()).optional(),
})

function dedupe(values?: string[]) {
  if (!values?.length) {
    return undefined
  }

  return Array.from(new Set(values))
}

export function normalizeMcpTokenCapabilities(
  capabilities: McpTokenCapabilities
): McpTokenCapabilities {
  return {
    tools:
      capabilities.tools === "all"
        ? "all"
        : Array.from(new Set(capabilities.tools)),
    workspaceIds: dedupe(capabilities.workspaceIds),
    trackableIds: dedupe(capabilities.trackableIds),
  }
}
