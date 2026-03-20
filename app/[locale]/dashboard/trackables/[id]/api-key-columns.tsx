"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

import { formatDateTime, formatStatusLabel } from "./display-utils"
import type { ApiKeyRow } from "./table-types"
import { T, useGT } from "gt-next";

type ApiKeyColumnsOptions = {
  onRevoke: (apiKey: ApiKeyRow) => void
  revokingKeyId?: string | null
}

export function getApiKeyColumns({
  onRevoke,
  revokingKeyId,
}: ApiKeyColumnsOptions): ColumnDef<ApiKeyRow>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <div className="pl-4">
          <DataTableColumnHeader column={column} title="Connection" />
        </div>
      ),
      cell: ({ row }) => {
        const apiKey = row.original

        return (
          <div className="flex items-center gap-3 pl-4 font-medium">
            <div
              className={
                apiKey.status === "active"
                  ? "size-2 rounded-full bg-emerald-500"
                  : "size-2 rounded-full bg-muted-foreground"
              }
            />
            <div className="space-y-0.5">
              <div
                className={
                  apiKey.status === "revoked"
                    ? "text-muted-foreground"
                    : undefined
                }
              >
                {apiKey.name}
              </div>
              <div className="text-xs font-normal text-muted-foreground capitalize">
                {formatStatusLabel(apiKey.status)}
              </div>
            </div>
          </div>
        )
      },
      enableHiding: false,
    },
    {
      accessorKey: "maskedKey",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Key" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          {formatShortMaskedKey(String(row.getValue("maskedKey")))}
        </span>
      ),
    },
    {
      accessorKey: "expiresAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Expires" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.expiresAt
            ? formatDateTime(row.original.expiresAt)
            : "Never"}
        </span>
      ),
    },
    {
      accessorKey: "lastUsedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Used" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDateTime(row.original.lastUsedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="pr-4 text-right"><T>Actions</T></div>,
      cell: ({ row }) => {
          const gt = useGT();
        const apiKey = row.original
        const isRevoking = revokingKeyId === apiKey.id

        return (
          <div className="flex justify-end gap-1 pr-4">
            <Button
              variant="ghost"
              size="icon"
              disabled={apiKey.status === "revoked" || isRevoking}
              title={gt("Revoke API key")}
              className="size-8 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onRevoke(apiKey)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )
      },
      enableSorting: false,
    },
  ]
}

function formatShortMaskedKey(maskedKey: string) {
  const normalizedKey = maskedKey.trim()

  if (normalizedKey.length <= 3) {
    return `***${normalizedKey}`
  }

  return `***${normalizedKey.slice(-3)}`
}
