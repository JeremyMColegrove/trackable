"use client"

import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import * as React from "react"
import { T } from "gt-next"

export type VirtualDataTableMenuItem = {
  id: string
  label: React.ReactNode
  icon?: React.ReactNode
  onClick: () => void
  separator?: boolean // If true, renders a separator ABOVE this item
}

interface VirtualDataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
  className?: string
  menuItems?: VirtualDataTableMenuItem[]
  trailingContent?: React.ReactNode
}

export function VirtualDataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  menuItems,
  trailingContent,
}: VirtualDataTableColumnHeaderProps<TData, TValue>) {
  const canSort = column.getCanSort()
  const hasMenuItems = menuItems && menuItems.length > 0
  const isSorted = column.getIsSorted() !== false

  if (!canSort && !hasMenuItems) {
    return (
      <div className={cn("flex items-center justify-between gap-2", className)}>
        <div className="min-w-0 truncate">{title}</div>
        {trailingContent}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "-ml-3 h-8 min-w-0 focus-visible:border-transparent focus-visible:ring-0 data-[state=open]:bg-accent",
              isSorted && "bg-accent text-foreground hover:bg-accent"
            )}
          >
            <span className="truncate">{title}</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowDown className="size-4" />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ChevronsUpDown className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {canSort && (
            <>
              <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                <ArrowUp className="mr-2 size-4 text-muted-foreground/70" />
                <span><T>Sort Ascending</T></span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                <ArrowDown className="mr-2 size-4 text-muted-foreground/70" />
                <span><T>Sort Descending</T></span>
              </DropdownMenuItem>
            </>
          )}

          {canSort && hasMenuItems && <DropdownMenuSeparator />}

          {hasMenuItems &&
            menuItems.map((item) => (
              <React.Fragment key={item.id}>
                {item.separator && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={item.onClick}>
                  {item.icon && (
                    <div className="mr-2 flex size-4 items-center justify-center text-muted-foreground/70">
                      {item.icon}
                    </div>
                  )}
                  <span>{item.label}</span>
                </DropdownMenuItem>
              </React.Fragment>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {trailingContent}
    </div>
  )
}
