"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, MoreHorizontal, Search } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { MCP_TOOL_DEFINITIONS, type McpToolName } from "@/lib/mcp-tools"
import { useTRPC } from "@/trpc/client"
import { T, useGT } from "gt-next"

type TokenCapabilities = {
  tools: "all" | McpToolName[]
  workspaceIds?: string[]
  trackableIds?: string[]
}

type CreatedToken = {
  token: string
  name: string
  capabilities: TokenCapabilities
}

function toggleStringValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value]
}

export function McpTokensProfilePage() {
  const gt = useGT()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const queryKey = trpc.mcpTokens.listTokens.queryKey()
  const creationOptionsQuery = useQuery(
    trpc.mcpTokens.getCreationOptions.queryOptions()
  )

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [expiration, setExpiration] = useState<string>("never")
  const [search, setSearch] = useState("")
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedTools, setSelectedTools] = useState<McpToolName[]>([])
  const [limitWorkspaces, setLimitWorkspaces] = useState(false)
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([])
  const [limitTrackables, setLimitTrackables] = useState(false)
  const [selectedTrackableIds, setSelectedTrackableIds] = useState<string[]>([])

  const tokensQuery = useQuery(trpc.mcpTokens.listTokens.queryOptions())
  const workspaceOptions = creationOptionsQuery.data?.workspaces ?? []
  const allTrackableOptions = creationOptionsQuery.data?.trackables ?? []
  const filteredTrackableOptions =
    limitWorkspaces && selectedWorkspaceIds.length > 0
      ? allTrackableOptions.filter((trackable) =>
          selectedWorkspaceIds.includes(trackable.workspaceId)
        )
      : allTrackableOptions

  useEffect(() => {
    if (!limitWorkspaces) {
      return
    }

    setSelectedTrackableIds((current) =>
      current.filter((trackableId) => {
        const trackable = allTrackableOptions.find(
          (entry) => entry.id === trackableId
        )
        return trackable
          ? selectedWorkspaceIds.includes(trackable.workspaceId)
          : false
      })
    )
  }, [allTrackableOptions, limitWorkspaces, selectedWorkspaceIds])

  const createToken = useMutation(
    trpc.mcpTokens.createToken.mutationOptions({
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey })
        setCreatedToken(data)
        setName("")
        setExpiration("never")
        setSelectedTools([])
        setLimitWorkspaces(false)
        setSelectedWorkspaceIds([])
        setLimitTrackables(false)
        setSelectedTrackableIds([])
      },
    })
  )

  const revokeToken = useMutation(
    trpc.mcpTokens.revokeToken.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey })
      },
    })
  )

  function handleCreate() {
    if (!name.trim() || selectedTools.length === 0) return
    let expiresAt: string | null = null
    if (expiration !== "never") {
      const days = parseInt(expiration, 10)
      const d = new Date()
      d.setDate(d.getDate() + days)
      expiresAt = d.toISOString()
    }
    createToken.mutate({
      name: name.trim(),
      expiresAt,
      capabilities: {
        tools: selectedTools,
        workspaceIds:
          limitWorkspaces && selectedWorkspaceIds.length > 0
            ? selectedWorkspaceIds
            : undefined,
        trackableIds:
          limitTrackables && selectedTrackableIds.length > 0
            ? selectedTrackableIds
            : undefined,
      },
    })
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleCopyAndClose() {
    if (createdToken) {
      void navigator.clipboard.writeText(createdToken.token)
    }
    setCreatedToken(null)
    setShowForm(false)
    setCopied(false)
  }

  const tokens = tokensQuery.data ?? []
  const filtered = search.trim()
    ? tokens.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : tokens

  function formatDate(date: Date | string | null) {
    if (!date) return null
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  function describeTools(capabilities: TokenCapabilities) {
    if (capabilities.tools === "all") {
      return gt("All tools")
    }

    return capabilities.tools
      .map(
        (toolName) =>
          MCP_TOOL_DEFINITIONS.find(
            (definition) => definition.name === toolName
          )?.label ?? toolName
      )
      .join(", ")
  }

  function describeResourceScope(
    label: string,
    ids: string[] | undefined,
    totalCount: number
  ) {
    if (!ids?.length) {
      return `${label}: ${gt("All accessible")}`
    }

    return `${label}: ${ids.length}/${totalCount}`
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative w-52">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={gt("Search keys")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowForm((v) => !v)
            setCreatedToken(null)
          }}
        >
          <T>Add new token</T>
        </Button>
      </div>

      {/* Create form / Created token reveal */}
      {showForm ? (
        <div className="space-y-4 rounded-lg border p-4">
          {createdToken ? (
            <>
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  <T>Copy your</T> &ldquo;{createdToken.name}&rdquo;{" "}
                  <T>MCP token now</T>
                </p>
                <p className="text-xs text-muted-foreground">
                  <T>
                    For security reasons, we won&apos;t allow you to view it
                    again later.
                  </T>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  <T>MCP token</T>
                </p>
                <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
                  <code className="flex-1 truncate font-mono text-xs">
                    {createdToken.token}
                  </code>
                  <button
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => handleCopy(createdToken.token)}
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyAndClose}
                >
                  <T>Copy &amp; Close</T>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  <T>Add new MCP token</T>
                </p>
                <p className="text-xs text-muted-foreground">
                  <T>
                    Choose exactly which MCP tools and resources this token can
                    access. You&apos;ll be able to revoke it anytime.
                  </T>
                </p>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">
                    <T>Token name</T>
                  </Label>
                  <Input
                    placeholder={gt("Enter your token name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <div className="w-48 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      <T>Expiration</T>
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      <T>Optional</T>
                    </span>
                  </div>
                  <Select value={expiration} onValueChange={setExpiration}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={gt("Select date")} />
                    </SelectTrigger>
                    <SelectContent modal={false}>
                      <SelectItem value="never">
                        <T>Never expires</T>
                      </SelectItem>
                      <SelectItem value="30">
                        <T>30 days</T>
                      </SelectItem>
                      <SelectItem value="60">
                        <T>60 days</T>
                      </SelectItem>
                      <SelectItem value="90">
                        <T>90 days</T>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {expiration === "never"
                      ? gt("This token will never expire")
                      : `${gt("Expires in")} ${expiration} ${gt("days")}`}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    <T>Allowed tools</T>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <T>
                      Select at least one tool. Tokens no longer default to full
                      access.
                    </T>
                  </p>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {MCP_TOOL_DEFINITIONS.map((tool) => (
                    <label
                      key={tool.name}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <Checkbox
                        checked={selectedTools.includes(tool.name)}
                        onCheckedChange={() =>
                          setSelectedTools((current) =>
                            toggleStringValue(current, tool.name)
                          )
                        }
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-medium">
                          {tool.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {tool.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <label className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    checked={limitWorkspaces}
                    onCheckedChange={(checked) => {
                      const enabled = checked === true
                      setLimitWorkspaces(enabled)
                      if (!enabled) {
                        setSelectedWorkspaceIds([])
                      }
                    }}
                  />
                  <span className="space-y-1">
                    <span className="block text-sm font-medium">
                      <T>Restrict workspaces</T>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      <T>
                        Leave this off to allow all workspaces you can already
                        access.
                      </T>
                    </span>
                  </span>
                </label>
                {limitWorkspaces ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {workspaceOptions.map((workspace) => (
                      <label
                        key={workspace.id}
                        className="flex items-center gap-3 rounded-md border p-3"
                      >
                        <Checkbox
                          checked={selectedWorkspaceIds.includes(workspace.id)}
                          onCheckedChange={() =>
                            setSelectedWorkspaceIds((current) =>
                              toggleStringValue(current, workspace.id)
                            )
                          }
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            {workspace.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {workspace.slug}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              <Separator />
              <div className="space-y-3">
                <label className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    checked={limitTrackables}
                    onCheckedChange={(checked) => {
                      const enabled = checked === true
                      setLimitTrackables(enabled)
                      if (!enabled) {
                        setSelectedTrackableIds([])
                      }
                    }}
                  />
                  <span className="space-y-1">
                    <span className="block text-sm font-medium">
                      <T>Restrict trackables</T>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      <T>
                        Optional fine-grained scope for specific trackables.
                      </T>
                    </span>
                  </span>
                </label>
                {limitTrackables ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {filteredTrackableOptions.map((trackable) => (
                      <label
                        key={trackable.id}
                        className="flex items-center gap-3 rounded-md border p-3"
                      >
                        <Checkbox
                          checked={selectedTrackableIds.includes(trackable.id)}
                          onCheckedChange={() =>
                            setSelectedTrackableIds((current) =>
                              toggleStringValue(current, trackable.id)
                            )
                          }
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            {trackable.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {trackable.kind}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              {createToken.error ? (
                <p className="text-xs text-destructive">
                  {createToken.error.message}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowForm(false)
                    setName("")
                    setExpiration("never")
                    setSelectedTools([])
                    setLimitWorkspaces(false)
                    setSelectedWorkspaceIds([])
                    setLimitTrackables(false)
                    setSelectedTrackableIds([])
                  }}
                >
                  <T>Cancel</T>
                </Button>
                <Button
                  size="sm"
                  disabled={
                    !name.trim() ||
                    selectedTools.length === 0 ||
                    createToken.isPending ||
                    creationOptionsQuery.isLoading
                  }
                  onClick={handleCreate}
                >
                  <T>Create token</T>
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Token list */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                <T>Name</T>
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                <T>Scope</T>
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                <T>Last used</T>
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                <T>Actions</T>
              </th>
            </tr>
          </thead>
          <tbody>
            {tokensQuery.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-xs text-muted-foreground"
                >
                  {search ? (
                    <T>No keys match your search.</T>
                  ) : (
                    <T>No MCP tokens yet.</T>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((token) => (
                <tr key={token.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{token.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <T>Created</T> {formatDate(token.createdAt)}
                      {token.expiresAt
                        ? ` • ${gt("Expires")} ${formatDate(token.expiresAt)}`
                        : ` • ${gt("Never expires")}`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <p>{describeTools(token.capabilities)}</p>
                    <p>
                      {describeResourceScope(
                        gt("Workspaces"),
                        token.capabilities.workspaceIds,
                        workspaceOptions.length
                      )}
                    </p>
                    <p>
                      {describeResourceScope(
                        gt("Trackables"),
                        token.capabilities.trackableIds,
                        allTrackableOptions.length
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {token.lastUsedAt ? formatDate(token.lastUsedAt) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">
                            <T>Actions</T>
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent modal={false} align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={revokeToken.isPending}
                          onClick={() =>
                            revokeToken.mutate({ tokenId: token.id })
                          }
                        >
                          <T>Revoke</T>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
