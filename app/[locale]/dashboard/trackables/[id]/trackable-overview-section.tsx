"use client"

import { useTRPC } from "@/trpc/client"
import { useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { LoaderCircle, RefreshCw } from "lucide-react"
import { buildTableExportFileName } from "@/lib/table-export"
import { useTrackableDetails } from "./trackable-shell"
import { FormSubmissionsTable } from "./form-submissions-table"
import {
  TrackablePageFrame,
  TrackablePageSearch,
} from "./components/trackable-page-frame"
import { UsageEventsPage } from "./usage-events-page"
import { T, useGT } from "gt-next"
import { SurveyShareDialog } from "./survey-share-dialog"

export function TrackableOverviewSection() {
  const gt = useGT()
  const trackable = useTrackableDetails()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [draftQuery, setDraftQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [isRefreshingTable, setIsRefreshingTable] = useState(false)
  const hasPendingTableChange = draftQuery.trim() !== appliedQuery.trim()
  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = appliedQuery.trim().toLowerCase()

    if (normalizedQuery.length === 0) {
      return trackable.recentSubmissions
    }

    return trackable.recentSubmissions.filter((submission) =>
      JSON.stringify(submission.submissionSnapshot)
        .toLowerCase()
        .includes(normalizedQuery)
    )
  }, [appliedQuery, trackable.recentSubmissions])

  if (trackable.kind === "survey") {
    const trackableQueryKey = trpc.trackables.getById.queryKey({
      id: trackable.id,
    })

    async function handleRefreshTable() {
      setIsRefreshingTable(true)

      try {
        await queryClient.invalidateQueries({
          queryKey: trackableQueryKey,
        })
      } finally {
        setIsRefreshingTable(false)
      }
    }

    function handleUpdateTable() {
      setAppliedQuery(draftQuery)
    }

    return (
      <TrackablePageFrame
        title={gt("Responses")}
        description={gt(
          "Review the latest structured responses submitted through this survey."
        )}
        headerActions={
          trackable.permissions.canManageResponses ? (
            <SurveyShareDialog
              trackableId={trackable.id}
              activeForm={trackable.activeForm}
              shareLinks={trackable.shareSettings.shareLinks}
            />
          ) : null
        }
        search={
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-row items-center gap-3">
              <div className="min-w-0 flex-1">
                <TrackablePageSearch
                  value={draftQuery}
                  onChange={setDraftQuery}
                  placeholder={gt("Search response text")}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void handleUpdateTable()}
                  className="h-12 rounded-2xl px-4"
                  disabled={!hasPendingTableChange}
                >
                  <T>Update</T>
                </Button>
              </div>
            </div>
          </div>
        }
      >
        <FormSubmissionsTable
          data={filteredSubmissions}
          exportFileName={buildTableExportFileName(
            trackable.name,
            "survey-data"
          )}
          headerButton={
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void handleRefreshTable()}
              disabled={isRefreshingTable}
              aria-label={gt("Refresh data")}
              title={gt("Refresh data")}
            >
              {isRefreshingTable ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
            </Button>
          }
        />
      </TrackablePageFrame>
    )
  }

  return <UsageEventsPage />
}
