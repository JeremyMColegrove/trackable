import { type NextRequest, NextResponse } from "next/server"

const MARKDOWN = `# Trackables MCP Server

Trackables is a multi-tenant platform for creating trackable items — either **survey forms** that collect user responses, or **API ingestion endpoints** that log structured usage events. This MCP server lets you manage your workspaces, trackables, forms, responses, API keys, and logs on behalf of an authenticated user.

## Authentication

All requests require a valid OAuth access token issued by Clerk. The token operates on behalf of the authenticated user — all data access is scoped to workspaces and trackables that user can access.

## Concepts

- **Workspace** — a tenant boundary. Users belong to one or more workspaces. Most tools default to the user's active workspace when no workspace ID is supplied.
- **Trackable** — an item inside a workspace. Two types:
  - \`survey\` — has a form definition and collects responses via a shareable public link.
  - \`api_ingestion\` — has API keys and accepts structured event payloads via HTTP.
- **Log** — a single ingestion event recorded against an \`api_ingestion\` trackable.
- **Response** — a single form submission recorded against a \`survey\` trackable.

## Tools

### Workspaces
| Tool | Description |
|------|-------------|
| \`list_workspaces\` | List all workspaces the user can access and identify the active one. |

### Trackables
| Tool | Description |
|------|-------------|
| \`find_trackables\` | Search trackables by name or keyword. Prefer this over \`list_trackables\` when looking for a specific item. |
| \`list_trackables\` | Browse all trackables in a workspace. |
| \`create_trackable\` | Create a new trackable (survey or api_ingestion). |

### Forms & Responses (survey trackables)
| Tool | Description |
|------|-------------|
| \`create_form\` | Define or replace the form schema for a survey trackable. |
| \`update_form_sharing\` | Enable or disable the public sharing link and anonymous responses. |
| \`list_responses\` | List collected form responses. |
| \`get_response\` | Fetch a single response in detail. |

### API Keys & Logs (api_ingestion trackables)
| Tool | Description |
|------|-------------|
| \`list_api_keys\` | List API keys for an api_ingestion trackable. |
| \`create_api_key\` | Create a new API key. |
| \`revoke_api_key\` | Revoke an existing API key. |
| \`search_logs\` | Search ingestion log events with optional filters. |
| \`get_log\` | Fetch a single log event in detail. |

## Usage Tips

- When the user does not specify a workspace, omit the workspace ID — tools default to the active workspace.
- Use \`find_trackables\` before any action that targets an existing trackable — it is faster than \`list_trackables\` and handles partial name matches.
- \`create_form\` replaces the existing form definition; fetch the current one first if you intend to make partial edits.
`

export async function GET(_req: NextRequest): Promise<Response> {
  return new NextResponse(MARKDOWN, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
