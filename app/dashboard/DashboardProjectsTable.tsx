"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"

import { dashboardTrackableColumns } from "@/app/dashboard/dashboard-project-columns"
import { DataTable } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import { getTrackableKindCreationLabel } from "@/lib/trackable-kind"
import { useTRPC } from "@/trpc/client"

type DashboardTrackablesTableProps = {
  title?: string
  titleVariant?: "default" | "page"
  description?: string
  headerButton?: ReactNode
  showSearch?: boolean
  showViewOptions?: boolean
}

export function DashboardTrackablesTable({
  title = "Trackables",
  titleVariant = "default",
  description = "An overview of your trackables",
  headerButton,
  showSearch = true,
  showViewOptions = true,
}: DashboardTrackablesTableProps) {
  const trpc = useTRPC()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const { data: trackables, isLoading } = useQuery(
    trpc.dashboard.getTrackables.queryOptions()
  )
  const filteredTrackables = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (normalizedQuery.length === 0) {
      return trackables ?? []
    }

    return (trackables ?? []).filter((trackable) =>
      [
        trackable.name,
        getTrackableKindCreationLabel(trackable.kind),
        trackable.workspace.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    )
  }, [searchQuery, trackables])

  return (
    <div className="space-y-4">
      {showSearch ? (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search trackables"
            aria-label="Search trackables"
            className="h-11 rounded-xl pl-10"
          />
        </div>
      ) : null}
      <DataTable
        title={title}
        titleVariant={titleVariant}
        columns={dashboardTrackableColumns}
        data={filteredTrackables}
        onRowClick={(trackable) =>
          router.push(`/dashboard/trackables/${trackable.id}`)
        }
        emptyMessage={
          isLoading ? "Loading trackables..." : "No trackables found."
        }
        initialPageSize={10}
        description={description}
        headerButton={headerButton}
        showViewOptions={showViewOptions}
      />
    </div>
  )
}
