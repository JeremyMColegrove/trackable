"use client";

import { CreateWorkspaceDialog } from "@/app/[locale]/dashboard/CreateWorkspaceDialog";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserAccountButton } from "@/components/user-account-button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next";
import { Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WorkspaceSettingsDialog } from "./workspace-settings-dialog";

const CREATE_WORKSPACE_VALUE = "__create-workspace__";
const SETTINGS_VALUE = "__workspace_settings__";

export function DashboardHeader() {
	const gt = useGT();
	const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const router = useRouter();
	const workspaceContext = useQuery(
		trpc.account.getWorkspaceContext.queryOptions(),
	);
	const canManageActiveWorkspace =
		workspaceContext.data?.activeWorkspace.role === "owner" ||
		workspaceContext.data?.activeWorkspace.role === "admin";

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
		if (workspaceId === SETTINGS_VALUE) {
			if (!canManageActiveWorkspace) {
				return;
			}
			setIsSettingsOpen(true);
			return;
		}

		switchWorkspace.mutate({ workspaceId });
	}

	return (
		<>
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
				<div className="flex h-15 w-full items-center justify-between gap-4 px-6 md:px-8">
					<div className="flex h-full min-w-0 flex-1 items-center gap-4">
						<SidebarTrigger className="-ml-1" />
					</div>
					<div className="flex min-w-0 items-center gap-3 ">
						<Select
							value={workspaceContext.data?.activeWorkspace.id}
							onValueChange={handleWorkspaceChange}
						>
							<SelectTrigger className="w-fit border-none">
								<SelectValue placeholder={gt("Select workspace")} />
							</SelectTrigger>
							<SelectContent position="popper" align="start">
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
									<SelectItem
										value={SETTINGS_VALUE}
										disabled={!canManageActiveWorkspace}
									>
										<div className="flex items-center gap-2">
											<Settings className="size-4 inline-block" />
											<T>Workspace Settings</T>
										</div>
									</SelectItem>
									<SelectItem value={CREATE_WORKSPACE_VALUE}>
										<div className="flex items-center gap-2">
											<Plus className="size-4 inline-block" />
											<T>Create new workspace</T>
										</div>
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
			<WorkspaceSettingsDialog
				open={isSettingsOpen}
				onOpenChange={setIsSettingsOpen}
			/>
		</>
	);
}
