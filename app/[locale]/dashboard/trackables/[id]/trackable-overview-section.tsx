"use client"

import { useTRPC } from "@/trpc/client"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
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
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function TrackableOverviewSection() {
  const gt = useGT()
  const trackable = useTrackableDetails()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get("q") ?? ""
  const [draftQuery, setDraftQuery] = useState(urlQuery)
  const [appliedQuery, setAppliedQuery] = useState(urlQuery)
  const [isRefreshingTable, setIsRefreshingTable] = useState(false)
  const hasPendingTableChange = draftQuery.trim() !== appliedQuery.trim()
  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = appliedQuery.trim().toLowerCase()

    if (normalizedQuery.length === 0) {
      return trackable.recentSubmissions
    }

    return trackable.recentSubmissions.filter((submission) => {
      const searchableText = [
        submission.id,
        submission.submitterLabel,
        submission.source,
        JSON.stringify(submission.submissionSnapshot),
      ]
        .join(" ")
        .toLowerCase()

      return searchableText.includes(normalizedQuery)
    })
  }, [appliedQuery, trackable.recentSubmissions])

  useEffect(() => {
    setDraftQuery(urlQuery)
    setAppliedQuery(urlQuery)
  }, [urlQuery])

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
      const nextQuery = draftQuery.trim()
      const nextSearchParams = new URLSearchParams(searchParams.toString())

      if (nextQuery.length === 0) {
        nextSearchParams.delete("q")
      } else {
        nextSearchParams.set("q", nextQuery)
      }

      const nextHref = nextSearchParams.toString()
        ? `${pathname}?${nextSearchParams.toString()}`
        : pathname

      setAppliedQuery(nextQuery)
      router.replace(nextHref, { scroll: false })
    }

    return (
      <TrackablePageFrame
        title={gt("Responses")}
        description={gt(
          "Review the latest structured responses submitted through this survey."
        )}
        headerActions={
          trackable.permissions.canManageResponses ? (
            <SurveyShareDialog />
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
