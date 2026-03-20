"use client";

import { CreateWorkspaceDialog } from "@/app/[locale]/dashboard/CreateWorkspaceDialog";
import { AppBrand } from "@/components/app-brand";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { UserAccountButton } from "@/components/user-account-button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next";
import { Plus } from "lucide-react";
import { useState } from "react";

const CREATE_WORKSPACE_VALUE = "__create-workspace__";

export function DashboardHeader() {
	const gt = useGT();
	const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceContext = useQuery(
		trpc.account.getWorkspaceContext.queryOptions(),
	);

	async function invalidateWorkspaceQueries() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: trpc.account.getWorkspaceContext.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.dashboard.getTrackables.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.dashboard.getMetrics.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.team.listMembers.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.team.getMemberCount.queryKey(),
			}),
		]);
	}

	const switchWorkspace = useMutation(
		trpc.account.switchWorkspace.mutationOptions({
			onSuccess: invalidateWorkspaceQueries,
		}),
	);

	function handleWorkspaceChange(workspaceId: string) {
		if (workspaceId === CREATE_WORKSPACE_VALUE) {
			setIsCreateWorkspaceOpen(true);
			return;
		}

		switchWorkspace.mutate({ workspaceId });
	}

	return (
		<>
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
				<div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
					<div className="flex min-w-0 items-center gap-6">
						<AppBrand
							href="/"
							className="shrink-0 text-lg font-bold tracking-tighter"
							collapseTextOnMobile
						/>
					</div>
					<div className="flex min-w-0 items-center gap-3 ">
						<Select
							value={workspaceContext.data?.activeWorkspace.id}
							onValueChange={handleWorkspaceChange}
						>
							<SelectTrigger className="w-fit border-none">
								<SelectValue placeholder={gt("Select workspace")} />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>
										<T>Workspaces</T>
									</SelectLabel>
									{(workspaceContext.data?.workspaces ?? []).map(
										(workspace) => (
											<SelectItem key={workspace.id} value={workspace.id}>
												{workspace.name}
											</SelectItem>
										),
									)}
								</SelectGroup>
								<SelectSeparator />
								<SelectGroup>
									<SelectItem value={CREATE_WORKSPACE_VALUE}>
										<Plus className="size-4" />

										<T>Create new workspace</T>
									</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
						<div className="h-4 w-px bg-border" />
						<UserAccountButton />
					</div>
				</div>
			</header>
			<CreateWorkspaceDialog
				open={isCreateWorkspaceOpen}
				onOpenChange={setIsCreateWorkspaceOpen}
			/>
		</>
	);
}
