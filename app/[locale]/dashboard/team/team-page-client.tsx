"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import throttle from "lodash/throttle";
import { Search, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RequireAuth } from "@/components/auth/require-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";
import { T, useGT } from "gt-next";

type TeamMemberRow = {
	id: string;
	displayName: string | null;
	primaryEmail: string | null;
	imageUrl: string | null;
	roleLabel: string;
	isOwner: boolean;
	addedAt: string | null;
};

function getInitials(value: string) {
	return value
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function getDisplayName(member: {
	displayName: string | null;
	primaryEmail: string | null;
}) {
	return member.displayName ?? member.primaryEmail ?? "Unknown user";
}

function TeamPageSkeleton() {
	return (
		<main className="flex-1">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8 sm:px-8">
				<Skeleton className="h-16 w-64" />
				<Skeleton className="h-[28rem] rounded-xl" />
			</div>
		</main>
	);
}

function AddMemberDialog() {
    const gt = useGT();
	const SEARCH_THROTTLE_MS = 800;
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [throttledSearch, setThrottledSearch] = useState("");
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const normalizedInput = search.trim();
	const shouldSearch = open && throttledSearch.length >= 2;

	const updateThrottledSearch = useMemo(
		() =>
			throttle(
				(value: string) => {
					setThrottledSearch(value.trim());
				},
				SEARCH_THROTTLE_MS,
				{
					leading: false,
					trailing: true,
				},
			),
		[],
	);

	useEffect(() => {
		if (!open) {
			updateThrottledSearch.cancel();
			return;
		}

		updateThrottledSearch(search);

		return () => {
			updateThrottledSearch.cancel();
		};
	}, [open, search, updateThrottledSearch]);

	const searchQuery = useQuery(
		trpc.team.searchUsers.queryOptions(
			{ query: throttledSearch },
			{
				enabled: shouldSearch,
				placeholderData: (previousData) => previousData,
			},
		),
	);

	const addMember = useMutation(
		trpc.team.addMember.mutationOptions({
			onSuccess: async () => {
				setOpen(false);
				setSearch("");

				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.team.listMembers.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.team.getMemberCount.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.dashboard.getTrackables.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.dashboard.getMetrics.queryKey(),
					}),
				]);
			},
		}),
	);

	const results = searchQuery.data ?? [];
	const hasEnoughCharacters = normalizedInput.length >= 2;
	const isSearching = shouldSearch && searchQuery.isFetching;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);

				if (!nextOpen) {
					setSearch("");
					setThrottledSearch("");
					updateThrottledSearch.cancel();
				}
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="lg">
					<UserPlus data-icon="inline-start" />
					
                    					<T>Add member</T>
                    				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle><T>Add member</T></DialogTitle>
					<DialogDescription>
						
                        						<T>Search existing users and add them to your team. They will get the
                        						same trackable access you have for your workspace.</T>
                        					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder={gt("Search by name or email")}
							className="pl-9"
						/>
					</div>

					<div className="flex min-h-40 max-h-80 flex-col gap-2 overflow-y-auto">
						{!hasEnoughCharacters ? (
							<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
								
                                								<T>Type at least 2 characters to search for users.</T>
                                							</div>
						) : results.length === 0 ? (
							<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
								{isSearching ? "Searching users..." : "No users matched that search."}
							</div>
						) : (
							<>
								{results.map((user) => {
									const label = getDisplayName(user);

									return (
										<div
											key={user.id}
											className="flex items-center justify-between gap-3 rounded-lg border p-3"
										>
											<div className="flex min-w-0 items-center gap-3">
												<Avatar>
													<AvatarImage
														src={user.imageUrl ?? undefined}
														alt={label}
													/>
													<AvatarFallback>{getInitials(label)}</AvatarFallback>
												</Avatar>
												<div className="min-w-0">
													<p className="truncate font-medium">{label}</p>
													<p className="truncate text-sm text-muted-foreground">
														{user.primaryEmail}
													</p>
												</div>
											</div>

											<Button
												type="button"
												size="sm"
												onClick={() =>
													addMember.mutate({
														memberUserId: user.id,
													})
												}
												disabled={addMember.isPending}
											>
												
                                                												<T>Add</T>
                                                											</Button>
										</div>
									);
								})}

								{isSearching ? (
									<p className="px-1 text-sm text-muted-foreground">
										
                                                										<T>Updating results...</T>
                                                									</p>
								) : null}
							</>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function TeamPageClient() {
	return (
		<RequireAuth fallback={<TeamPageSkeleton />}>
			<TeamPageContent />
		</RequireAuth>
	);
}

function TeamPageContent() {
    const gt = useGT();
	const { user } = useUser();
	const [memberToRemove, setMemberToRemove] = useState<TeamMemberRow | null>(null);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const membersQuery = useQuery(trpc.team.listMembers.queryOptions());
	const removeMember = useMutation(
		trpc.team.removeMember.mutationOptions({
			onSuccess: async () => {
				setMemberToRemove(null);
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.team.listMembers.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.team.getMemberCount.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.dashboard.getTrackables.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.dashboard.getMetrics.queryKey(),
					}),
				]);
			},
		}),
	);

	const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
	const currentUserId = user?.id ?? null;
	const removingMemberId = removeMember.variables?.memberUserId ?? null;
	const removeLabel =
		memberToRemove?.id === currentUserId ? "Leave team" : "Remove member";
	const removeDescription = memberToRemove
		? memberToRemove.id === currentUserId
			? "Leave this team? You will lose access to the shared team trackables."
			: `Remove ${getDisplayName(memberToRemove)} from the team? They will lose access to the shared team trackables.`
		: "";

	const teamMemberColumns = useMemo<ColumnDef<TeamMemberRow>[]>(
		() => [
			{
				accessorKey: "displayName",
				header: "Member",
				cell: ({ row }) => {
					const member = row.original;
					const label = getDisplayName(member);

					return (
						<div className="flex items-center gap-3">
							<Avatar>
								<AvatarImage src={member.imageUrl ?? undefined} alt={label} />
								<AvatarFallback>{getInitials(label)}</AvatarFallback>
							</Avatar>
							<div className="min-w-0">
								<p className="truncate font-medium">{label}</p>
								<p className="truncate text-sm text-muted-foreground">
									{member.primaryEmail ?? "No email"}
								</p>
							</div>
						</div>
					);
				},
				enableHiding: false,
			},
			{
				accessorKey: "roleLabel",
				header: "Role",
				cell: ({ row }) => (
					<Badge variant="outline">{row.original.roleLabel}</Badge>
				),
			},
			{
				id: "access",
				header: "Access",
				cell: () => (
					<span className="text-sm text-muted-foreground">
						
                        						<T>Full trackable access</T>
                        					</span>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => {
					const member = row.original;
					const isCurrentUser = member.id === currentUserId;
					const isDisabled = member.isOwner;

					return (
						<div className="flex justify-end">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={isDisabled || removeMember.isPending}
								onClick={() => setMemberToRemove(member)}
							>
								{removeMember.isPending && removingMemberId === member.id
									? isCurrentUser
										? "Leaving..."
										: "Removing..."
									: isCurrentUser
										? "Leave"
										: "Remove"}
							</Button>
						</div>
					);
				},
			},
		],
		[currentUserId, removeMember, removingMemberId],
	);

	return (
		<main className="flex-1">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8 sm:px-8">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"></div>

				<DataTable
					columns={teamMemberColumns}
					data={members}
					headerButton={<AddMemberDialog />}
					title={
						<span className="inline-flex items-center gap-2">
							<Users />
							
                            							<T>Members</T>
                            						</span>
					}
					description={gt("Team members can open your trackables from their dashboard and view or edit them.")}
					emptyMessage={
						membersQuery.isLoading
							? "Loading members..."
							: "No team members yet."
					}
					initialPageSize={10}
				/>
			</div>

			<Dialog
				open={Boolean(memberToRemove)}
				onOpenChange={(open) => {
					if (!open && !removeMember.isPending) {
						setMemberToRemove(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{removeLabel}</DialogTitle>
						<DialogDescription>{removeDescription}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setMemberToRemove(null)}
							disabled={removeMember.isPending}
						>
							
                            							<T>Cancel</T>
                            						</Button>
						<Button
							type="button"
							variant="destructive"
							disabled={!memberToRemove || removeMember.isPending}
							onClick={() => {
								if (!memberToRemove) {
									return;
								}

								removeMember.mutate({
									memberUserId: memberToRemove.id,
								});
							}}
						>
							{removeMember.isPending
								? memberToRemove?.id === currentUserId
									? "Leaving..."
									: "Removing..."
								: memberToRemove?.id === currentUserId
									? "Leave team"
									: "Remove member"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}
