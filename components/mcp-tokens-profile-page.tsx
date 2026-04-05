"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, MoreHorizontal, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";

type CreatedToken = { token: string; name: string };

export function McpTokensProfilePage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const queryKey = trpc.mcpTokens.listTokens.queryKey();

	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [expiration, setExpiration] = useState<string>("never");
	const [search, setSearch] = useState("");
	const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
	const [copied, setCopied] = useState(false);

	const tokensQuery = useQuery(trpc.mcpTokens.listTokens.queryOptions());

	const createToken = useMutation(
		trpc.mcpTokens.createToken.mutationOptions({
			onSuccess: (data) => {
				void queryClient.invalidateQueries({ queryKey });
				setCreatedToken(data);
				setName("");
				setExpiration("never");
			},
		}),
	);

	const revokeToken = useMutation(
		trpc.mcpTokens.revokeToken.mutationOptions({
			onSuccess: () => {
				void queryClient.invalidateQueries({ queryKey });
			},
		}),
	);

	function handleCreate() {
		if (!name.trim()) return;
		let expiresAt: string | null = null;
		if (expiration !== "never") {
			const days = parseInt(expiration, 10);
			const d = new Date();
			d.setDate(d.getDate() + days);
			expiresAt = d.toISOString();
		}
		createToken.mutate({ name: name.trim(), expiresAt });
	}

	async function handleCopy(text: string) {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function handleCopyAndClose() {
		if (createdToken) {
			void navigator.clipboard.writeText(createdToken.token);
		}
		setCreatedToken(null);
		setShowForm(false);
		setCopied(false);
	}

	const tokens = tokensQuery.data ?? [];
	const filtered = search.trim()
		? tokens.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
		: tokens;

	function formatDate(date: Date | string | null) {
		if (!date) return null;
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	}

	return (
		<div className="space-y-4">
			{/* Page heading */}
			<div className="space-y-1">
				<h2 className="text-xl font-semibold">API keys</h2>
				<p className="text-sm text-muted-foreground">
					Manage your MCP server access tokens.
				</p>
			</div>

			{/* Header row */}
			<div className="flex items-center justify-between gap-2">
				<div className="relative w-52">
					<Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="pl-8"
						placeholder="Search keys"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<Button
					size="sm"
					onClick={() => {
						setShowForm((v) => !v);
						setCreatedToken(null);
					}}
				>
					Add new key
				</Button>
			</div>

			{/* Create form / Created token reveal */}
			{showForm ? (
				<div className="rounded-lg border p-4 space-y-4">
					{createdToken ? (
						<>
							<div className="space-y-1">
								<p className="text-sm font-semibold">
									Copy your &ldquo;{createdToken.name}&rdquo; API Key now
								</p>
								<p className="text-xs text-muted-foreground">
									For security reasons, we won&apos;t allow you to view it again
									later.
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">
									API key
								</p>
								<div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
									<code className="flex-1 truncate text-xs font-mono">
										{createdToken.token}
									</code>
									<button
										type="button"
										className="text-muted-foreground hover:text-foreground transition-colors"
										onClick={() => handleCopy(createdToken.token)}
									>
										{copied ? (
											<Check className="size-4" />
										) : (
											<Copy className="size-4" />
										)}
									</button>
								</div>
							</div>
							<div className="flex justify-end">
								<Button size="sm" variant="outline" onClick={handleCopyAndClose}>
									Copy &amp; Close
								</Button>
							</div>
						</>
					) : (
						<>
							<div className="space-y-1">
								<p className="text-sm font-semibold">Add new API key</p>
								<p className="text-xs text-muted-foreground">
									Provide a name to generate a new key. You&apos;ll be able to
									revoke it anytime.
								</p>
							</div>
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1 space-y-1.5">
									<Label className="text-xs">Secret key name</Label>
									<Input
										placeholder="Enter your secret key name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleCreate()}
									/>
								</div>
								<div className="w-48 space-y-1.5">
									<div className="flex items-center justify-between">
										<Label className="text-xs">Expiration</Label>
										<span className="text-xs text-muted-foreground">
											Optional
										</span>
									</div>
									<Select value={expiration} onValueChange={setExpiration}>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Select date" />
										</SelectTrigger>
										<SelectContent modal={false}>
											<SelectItem value="never">Never expires</SelectItem>
											<SelectItem value="30">30 days</SelectItem>
											<SelectItem value="60">60 days</SelectItem>
											<SelectItem value="90">90 days</SelectItem>
										</SelectContent>
									</Select>
									<p className="text-xs text-muted-foreground">
										{expiration === "never"
											? "This key will never expire"
											: `Expires in ${expiration} days`}
									</p>
								</div>
							</div>
							{createToken.error ? (
								<p className="text-xs text-destructive">
									Failed to create key. Please try again.
								</p>
							) : null}
							<div className="flex justify-end gap-2">
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										setShowForm(false);
										setName("");
										setExpiration("never");
									}}
								>
									Cancel
								</Button>
								<Button
									size="sm"
									disabled={!name.trim() || createToken.isPending}
									onClick={handleCreate}
								>
									Create key
								</Button>
							</div>
						</>
					)}
				</div>
			) : null}

			{/* Token list */}
			<div className="rounded-lg border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b">
							<th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
								Name
							</th>
							<th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
								Last used
							</th>
							<th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
								Actions
							</th>
						</tr>
					</thead>
					<tbody>
						{tokensQuery.isLoading ? (
							<tr>
								<td colSpan={3} className="px-4 py-3">
									<div className="space-y-2">
										<Skeleton className="h-4 w-48" />
										<Skeleton className="h-3 w-32" />
									</div>
								</td>
							</tr>
						) : filtered.length === 0 ? (
							<tr>
								<td
									colSpan={3}
									className="px-4 py-6 text-center text-xs text-muted-foreground"
								>
									{search ? "No keys match your search." : "No API keys yet."}
								</td>
							</tr>
						) : (
							filtered.map((token) => (
								<tr key={token.id} className="border-b last:border-0">
									<td className="px-4 py-3">
										<p className="font-medium">{token.name}</p>
										<p className="text-xs text-muted-foreground">
											Created {formatDate(token.createdAt)}
											{token.expiresAt
												? ` • Expires ${formatDate(token.expiresAt)}`
												: " • Never expires"}
										</p>
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{token.lastUsedAt ? formatDate(token.lastUsedAt) : "-"}
									</td>
									<td className="px-4 py-3 text-right">
										<DropdownMenu modal={false}>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon" className="size-7">
													<MoreHorizontal className="size-4" />
													<span className="sr-only">Actions</span>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent modal={false} align="end">
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													disabled={revokeToken.isPending}
													onClick={() =>
														revokeToken.mutate({ tokenId: token.id })
													}
												>
													Revoke
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
