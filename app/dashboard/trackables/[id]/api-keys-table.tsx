"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTRPC } from "@/trpc/client"

import { getApiKeyColumns } from "./api-key-columns"
import { CreateApiKeyDialog } from "./create-api-key-dialog"
import type { ApiKeyRow } from "./table-types"

export function ApiKeysTable({
  data,
  trackableId,
  headerButton,
}: {
  data: ApiKeyRow[]
  trackableId: string
  headerButton?: React.ReactNode
}) {
  const [apiKeyToRevoke, setApiKeyToRevoke] = useState<ApiKeyRow | null>(null)
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const revokeApiKey = useMutation(
    trpc.trackables.revokeApiKey.mutationOptions({
      onSuccess: async () => {
        setApiKeyToRevoke(null)

        await queryClient.invalidateQueries({
          queryKey: trpc.trackables.getById.queryKey({ id: trackableId }),
        })
      },
    })
  )

  const columns = getApiKeyColumns({
    onRevoke: setApiKeyToRevoke,
    revokingKeyId: revokeApiKey.isPending ? apiKeyToRevoke?.id : null,
  })

  function handleConfirmRevoke() {
    if (!apiKeyToRevoke) {
      return
    }

    revokeApiKey.mutate({
      trackableId,
      apiKeyId: apiKeyToRevoke.id,
    })
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        title="API Keys"
        description="Manage API keys that can authorize tracking requests."
        headerButton={headerButton ?? <CreateApiKeyDialog trackableId={trackableId} />}
        emptyMessage="No API keys created yet."
        initialPageSize={5}
      />
      <Dialog
        open={Boolean(apiKeyToRevoke)}
        onOpenChange={(open) => {
          if (!open && !revokeApiKey.isPending) {
            setApiKeyToRevoke(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API key</DialogTitle>
            <DialogDescription>
              {apiKeyToRevoke
                ? `Revoke "${apiKeyToRevoke.name}"? This key will stay visible in the table but can no longer be used.`
                : "Revoke this API key?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setApiKeyToRevoke(null)}
              disabled={revokeApiKey.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={revokeApiKey.isPending}
            >
              {revokeApiKey.isPending ? "Revoking..." : "Revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
