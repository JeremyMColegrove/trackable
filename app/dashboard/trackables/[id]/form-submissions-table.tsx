"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { DataTable } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"

import { ActivityDetailsDialog } from "./activity-details-dialog"
import { formSubmissionColumns } from "./form-submission-columns"
import type { SubmissionRow } from "./table-types"

export function FormSubmissionsTable({
  data,
}: {
  data: SubmissionRow[]
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRow | null>(
    null
  )
  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (normalizedQuery.length === 0) {
      return data
    }

    return data.filter((submission) =>
      [
        submission.submitterLabel,
        submission.source.replaceAll("_", " "),
        submission.metadata?.referrer ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    )
  }, [data, searchQuery])

  return (
    <>
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search submissions"
            aria-label="Search submissions"
            className="h-11 rounded-xl pl-10"
          />
        </div>
        <DataTable
          columns={formSubmissionColumns}
          data={filteredSubmissions}
          title="Survey Data"
          description="Latest structured responses submitted to this trackable."
          onRowClick={setSelectedSubmission}
          emptyMessage="No form submissions have been recorded yet."
          initialPageSize={5}
        />
      </div>
      {selectedSubmission ? (
        <ActivityDetailsDialog
          submission={selectedSubmission}
          open
          hideTrigger
          onOpenChange={(open) => {
            if (!open) {
              setSelectedSubmission(null)
            }
          }}
        />
      ) : null}
    </>
  )
}
