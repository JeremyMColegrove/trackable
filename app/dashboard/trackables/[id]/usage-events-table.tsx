"use client"

import { useState } from "react"

import { DataTable } from "@/components/ui/data-table"

import type { UsageEventRow } from "./table-types"
import { UsageDetailsDialog } from "./usage-details-dialog"
import { usageEventColumns } from "./usage-event-columns"

export function UsageEventsTable({
  data,
  title = "Ingestion Data",
  description = "Aggregated API hits grouped by unique name and API key.",
}: {
  data: UsageEventRow[]
  title?: React.ReactNode
  description?: React.ReactNode
}) {
  const [selectedUsageEvent, setSelectedUsageEvent] =
    useState<UsageEventRow | null>(null)

  return (
    <>
      <DataTable
        columns={usageEventColumns}
        data={data}
        title={title}
        description={description}
        onRowClick={setSelectedUsageEvent}
        emptyMessage="No API usage has been recorded yet."
        initialPageSize={5}
      />
      {selectedUsageEvent ? (
        <UsageDetailsDialog
          usageEvent={selectedUsageEvent}
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedUsageEvent(null)
            }
          }}
        />
      ) : null}
    </>
  )
}
