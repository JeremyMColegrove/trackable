/** biome-ignore-all lint/correctness/useUniqueElementIds: <explanation> */
"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function WorkspaceSettingsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const gt = useGT();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const settingsQuery = useQuery(
		trpc.workspace.getSettings.queryOptions(undefined, {
			enabled: open,
		}),
	);
	const [name, setName] = useState("");
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	useEffect(() => {
		if (settingsQuery.data && open) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setName(settingsQuery.data.name);
		}
	}, [settingsQuery.data, open]);

	const updateSettings = useMutation(
		trpc.workspace.updateSettings.mutationOptions({
			onSuccess: async () => {
				toast.success(gt("Settings updated successfully"));
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.workspace.getSettings.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.account.getWorkspaceContext.queryKey(),
					}),
				]);
				onOpenChange(false);
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const deleteWorkspace = useMutation(
		trpc.workspace.deleteWorkspace.mutationOptions({
			onSuccess: async () => {
				toast.success(gt("Workspace deleted successfully"));
				await queryClient.invalidateQueries({
					queryKey: trpc.account.getWorkspaceContext.queryKey(),
				});
				onOpenChange(false);
				setIsDeleteDialogOpen(false);
			},
			onError: (error) => {
				toast.error(error.message);
				setIsDeleteDialogOpen(false);
			},
		}),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						<T>Workspace Settings</T>
					</DialogTitle>
					<DialogDescription>
						<T>Manage your workspace configuration and preferences.</T>
					</DialogDescription>
				</DialogHeader>

				{settingsQuery.isLoading ? (
					<div className="grid gap-6 py-4">
						<div className="space-y-4">
							<div className="space-y-2">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-10 w-32" />
						</div>
					</div>
				) : settingsQuery.isError ? (
					<div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
						<T>
							Error loading workspace settings. You may not access a workspace
							you do not have permission for.
						</T>
					</div>
				) : (
					<div className="grid gap-6 py-4">
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="workspace-name">
									<T>Workspace Name</T>
								</Label>
								<Input
									id="workspace-name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder={gt("My Workspace")}
								/>
							</div>
							<Button
								onClick={() => updateSettings.mutate({ name })}
								disabled={
									updateSettings.isPending ||
									name === settingsQuery.data?.name ||
									name.trim() === ""
								}
							>
								{updateSettings.isPending
									? gt("Saving...")
									: gt("Save Changes")}
							</Button>
						</div>
					</div>
				)}
			</DialogContent>

			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							<T>Are you absolutely sure?</T>
						</DialogTitle>
						<DialogDescription>
							<T>
								This action cannot be undone. This will permanently delete your
								workspace and remove all associated data, including trackables
								and API usage.
							</T>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsDeleteDialogOpen(false)}
							disabled={deleteWorkspace.isPending}
						>
							<T>Cancel</T>
						</Button>
						<Button
							type="button"
							variant="destructive"
							disabled={deleteWorkspace.isPending}
							onClick={() => {
								if (settingsQuery.data) {
									deleteWorkspace.mutate({
										workspaceId: settingsQuery.data.id,
									});
								}
							}}
						>
							{deleteWorkspace.isPending ? gt("Deleting...") : gt("Delete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Dialog>
	);
}
