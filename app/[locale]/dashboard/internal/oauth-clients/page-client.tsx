"use client";

import { PageShell } from "@/components/page-shell";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AppRouter } from "@/server/api/root";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { T, useGT } from "gt-next";
import { CheckCircle2, Copy, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type CreatedClient = RouterOutputs["oauthClients"]["create"];
type OAuthClient = RouterOutputs["oauthClients"]["list"][number];

function getClientDisplayName(client: OAuthClient) {
	return typeof client.client_name === "string" && client.client_name.length > 0
		? client.client_name
		: null;
}

function CopyField({ label, value }: { label: string; value: string }) {
	const gt = useGT();
	const [copied, setCopied] = useState(false);

	function copy() {
		navigator.clipboard.writeText(value);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<div className="space-y-1.5">
			<Label className="text-xs text-muted-foreground">{label}</Label>
			<div className="flex items-center gap-2">
				<code className="min-w-0 flex-1 rounded bg-muted px-2 py-1.5 font-mono text-xs break-all">
					{value}
				</code>
				<Button
					variant="ghost"
					size="icon"
					className="size-7 shrink-0"
					onClick={copy}
					title={copied ? gt("Copied") : gt("Copy")}
				>
					{copied ? (
						<CheckCircle2 className="size-3.5 text-green-500" />
					) : (
						<Copy className="size-3.5" />
					)}
				</Button>
			</div>
		</div>
	);
}

function CreatedClientView({
	client,
	appUrl,
}: {
	client: CreatedClient;
	appUrl: string;
}) {
	const gt = useGT();
	return (
		<div className="space-y-3">
			<p className="text-sm text-muted-foreground">
				<T>
					Copy these values into your OAuth client (e.g. ChatGPT connector
					settings). The client secret will not be shown again.
				</T>
			</p>
			<div className="space-y-3 rounded-lg border bg-muted/40 p-4">
				<CopyField label={gt("Client ID")} value={client.client_id} />
				<CopyField
					label={gt("Client Secret")}
					value={(client.client_secret as string) ?? ""}
				/>
				<CopyField
					label={gt("Authorization URL")}
					value={`${appUrl}/api/auth/oauth2/authorize`}
				/>
				<CopyField
					label={gt("Token URL")}
					value={`${appUrl}/api/auth/oauth2/token`}
				/>
			</div>
		</div>
	);
}

function AddClientDialog() {
	const gt = useGT();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [redirectUri, setRedirectUri] = useState("");
	const [created, setCreated] = useState<CreatedClient | null>(null);

	const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

	const createClient = useMutation(
		trpc.oauthClients.create.mutationOptions({
			onSuccess: async (data) => {
				setCreated(data as CreatedClient);
				await queryClient.invalidateQueries({
					queryKey: trpc.oauthClients.list.queryKey(),
				});
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (!next) {
			setName("");
			setRedirectUri("");
			setCreated(null);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size="sm">
					<Plus className="mr-2 size-4" />
					<T>Add client</T>
				</Button>
			</DialogTrigger>
			<DialogContent className="flex flex-col gap-0 overflow-hidden sm:max-w-lg">
				{created ? (
					<>
						<DialogHeader className="px-6 pt-6 pb-4">
							<DialogTitle>
								<T>Client created</T>
							</DialogTitle>
							<DialogDescription>
								<T>
									Save these credentials now. The secret cannot be retrieved
									later.
								</T>
							</DialogDescription>
						</DialogHeader>
						<div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
							<CreatedClientView client={created} appUrl={appUrl} />
						</div>
						<DialogFooter className="border-t px-6 py-4">
							<Button onClick={() => handleOpenChange(false)}>
								<T>Done</T>
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader className="px-6 pt-6 pb-4">
							<DialogTitle>
								<T>Add OAuth client</T>
							</DialogTitle>
							<DialogDescription>
								<T>
									Register a new confidential OAuth client. Provide the redirect
									URI from the service you are connecting (e.g. from ChatGPT
									connector settings).
								</T>
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 px-6 pb-2">
							<div className="space-y-1.5">
								<Label htmlFor="client-name">
									<T>Name</T>
								</Label>
								<Input
									id="client-name"
									placeholder={gt("ChatGPT MCP Connector")}
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="redirect-uri">
									<T>Redirect URI</T>
								</Label>
								<Input
									id="redirect-uri"
									placeholder={"https://chatgpt.com/connector/oauth/..."}
									value={redirectUri}
									onChange={(e) => setRedirectUri(e.target.value)}
								/>
							</div>
						</div>
						<DialogFooter className="border-t px-6 py-4">
							<Button variant="outline" onClick={() => handleOpenChange(false)}>
								<T>Cancel</T>
							</Button>
							<Button
								disabled={
									!name.trim() || !redirectUri.trim() || createClient.isPending
								}
								onClick={() => createClient.mutate({ name, redirectUri })}
							>
								{createClient.isPending ? gt("Creating...") : gt("Create")}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

export function OAuthClientsPageSkeleton() {
	return (
		<main className="flex-1">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
				<Skeleton className="h-10 w-48 rounded-lg" />
				<Skeleton className="h-64 rounded-2xl" />
			</div>
		</main>
	);
}

export function OAuthClientsPageClient() {
	const gt = useGT();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [rotatedClient, setRotatedClient] = useState<CreatedClient | null>(
		null,
	);

	const { data: clients, isLoading } = useQuery(
		trpc.oauthClients.list.queryOptions(),
	);

	const rotate = useMutation(
		trpc.oauthClients.rotate.mutationOptions({
			onSuccess: async (data) => {
				setRotatedClient(data as CreatedClient);
				toast.success(gt("Client secret rotated"));
				await queryClient.invalidateQueries({
					queryKey: trpc.oauthClients.list.queryKey(),
				});
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	const revoke = useMutation(
		trpc.oauthClients.revoke.mutationOptions({
			onSuccess: async () => {
				toast.success(gt("Client deleted"));
				await queryClient.invalidateQueries({
					queryKey: trpc.oauthClients.list.queryKey(),
				});
			},
			onError: (err) => toast.error(err.message),
		}),
	);

	return (
		<>
			<Dialog
				open={Boolean(rotatedClient)}
				onOpenChange={(open) => {
					if (!open) {
						setRotatedClient(null);
					}
				}}
			>
				<DialogContent className="flex flex-col gap-0 overflow-hidden sm:max-w-lg">
					<DialogHeader className="px-6 pt-6 pb-4">
						<DialogTitle>
							<T>Client secret rotated</T>
						</DialogTitle>
						<DialogDescription>
							<T>
								Save this secret now. The previous secret has already been
								invalidated and this new one will not be shown again.
							</T>
						</DialogDescription>
					</DialogHeader>
					<div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
						{rotatedClient ? (
							<CreatedClientView
								client={rotatedClient}
								appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
							/>
						) : null}
					</div>
					<DialogFooter className="border-t px-6 py-4">
						<Button onClick={() => setRotatedClient(null)}>
							<T>Done</T>
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<PageShell
				title={gt("OAuth Clients")}
				description={gt(
					"Managed confidential OAuth clients for MCP integrations like ChatGPT.",
				)}
				headerActions={<AddClientDialog />}
			>
				{isLoading ? (
					<Skeleton className="h-48 rounded-xl" />
				) : !clients?.length ? (
					<div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
						<T>
							No OAuth clients yet. Add one to explicitly authorize an MCP
							integration.
						</T>
					</div>
				) : (
					<div className="rounded-xl border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>
										<T>Name</T>
									</TableHead>
									<TableHead>
										<T>Client ID</T>
									</TableHead>
									<TableHead>
										<T>Redirect URI</T>
									</TableHead>
									<TableHead>
										<T>Status</T>
									</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{clients.map((client: OAuthClient) => {
									const displayName = getClientDisplayName(client);

									return (
										<TableRow key={client.client_id}>
											<TableCell className="font-medium">
												{displayName ? (
													displayName
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell>
												<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
													{client.client_id}
												</code>
											</TableCell>
											<TableCell className="max-w-xs truncate text-xs text-muted-foreground">
												{client.redirect_uris?.[0] ?? "—"}
											</TableCell>
											<TableCell>
												<Badge
													variant={client.disabled ? "secondary" : "default"}
												>
													{client.disabled ? <T>Disabled</T> : <T>Active</T>}
												</Badge>
											</TableCell>
											<TableCell>
												{!client.disabled && (
													<div className="flex items-center justify-end gap-1">
														<AlertDialog>
															<AlertDialogTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className="size-8 text-muted-foreground"
																	disabled={rotate.isPending}
																>
																	<RefreshCw className="size-4" />
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>
																		<T>Rotate client secret?</T>
																	</AlertDialogTitle>
																	<AlertDialogDescription>
																		<strong>
																			{displayName ?? client.client_id}
																		</strong>{" "}
																		<T>
																			will receive a new secret immediately. Any
																			existing integrations must be updated
																			before they can exchange tokens again.
																		</T>
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel>
																		<T>Cancel</T>
																	</AlertDialogCancel>
																	<AlertDialogAction
																		onClick={() =>
																			rotate.mutate({
																				clientId: client.client_id,
																			})
																		}
																	>
																		<T>Rotate secret</T>
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>

														<AlertDialog>
															<AlertDialogTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className="size-8 text-muted-foreground hover:text-destructive"
																	disabled={revoke.isPending}
																>
																	<Trash2 className="size-4" />
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>
																		<T>Delete client?</T>
																	</AlertDialogTitle>
																	<AlertDialogDescription>
																		<strong>
																			{displayName ?? client.client_id}
																		</strong>{" "}
																		<T>
																			will immediately stop working. Any
																			integrations using this client will lose
																			access and you will need to create a new
																			client to restore it.
																		</T>
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel>
																		<T>Cancel</T>
																	</AlertDialogCancel>
																	<AlertDialogAction
																		className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
																		onClick={() =>
																			revoke.mutate({
																				clientId: client.client_id,
																			})
																		}
																	>
																		<T>Delete client</T>
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													</div>
												)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</PageShell>
		</>
	);
}
