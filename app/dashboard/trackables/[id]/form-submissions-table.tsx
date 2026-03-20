"use client"

import { useState } from "react"

import { DataTable } from "@/components/ui/data-table"

import { ActivityDetailsDialog } from "./activity-details-dialog"
import { formSubmissionColumns } from "./form-submission-columns"
import type { SubmissionRow } from "./table-types"

export function FormSubmissionsTable({
  data,
}: {
  data: SubmissionRow[]
}) {
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRow | null>(
    null
  )

  return (
    <>
      <DataTable
        columns={formSubmissionColumns}
        data={data}
        title="Survey Data"
        description="Latest structured responses submitted to this trackable."
        onRowClick={setSelectedSubmission}
        emptyMessage="No form submissions have been recorded yet."
        initialPageSize={10}
      />
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
