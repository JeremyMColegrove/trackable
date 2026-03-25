"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Column } from "@tanstack/react-table";
import { T } from "gt-next";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

interface DataTableColumnHeaderProps<TData, TValue> {
	column: Column<TData, TValue>;
	title: string;
	className?: string;
}

export function DataTableColumnHeader<TData, TValue>({
	column,
	title,
	className,
}: DataTableColumnHeaderProps<TData, TValue>) {
	const isSorted = column.getIsSorted() !== false;

	if (!column.getCanSort()) {
		return <div className={cn(className)}>{title}</div>;
	}

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className={cn(
							"-ml-3 h-8 data-[state=open]:bg-accent",
							isSorted &&
								"bg-accent text-foreground hover:bg-accent focus-visible:border-transparent focus-visible:ring-0",
						)}
					>
						<span>{title}</span>
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
					<DropdownMenuItem onClick={() => column.toggleSorting(false)}>
						<ArrowUp className="size-4" />

						<T>Asc</T>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => column.toggleSorting(true)}>
						<ArrowDown className="size-4" />

						<T>Desc</T>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
