"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { buildAbsoluteUrl } from "@/lib/site-config";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiKeyColumns } from "./api-key-columns";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import type { ApiKeyRow } from "./table-types";

export function ApiKeysTable({
	data,
	trackableId,
	trackableName,
	headerButton,
}: {
	data: ApiKeyRow[];
	trackableId: string;
	trackableName: string;
	headerButton?: React.ReactNode;
}) {
	const gt = useGT();
	const [apiKeyToRevoke, setApiKeyToRevoke] = useState<ApiKeyRow | null>(null);
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const revokeApiKey = useMutation(
		trpc.trackables.revokeApiKey.mutationOptions({
			onSuccess: async () => {
				setApiKeyToRevoke(null);

				await queryClient.invalidateQueries({
					queryKey: trpc.trackables.getById.queryKey({ id: trackableId }),
				});
			},
		}),
	);

	const columns = getApiKeyColumns({
		onRevoke: setApiKeyToRevoke,
		revokingKeyId: revokeApiKey.isPending ? apiKeyToRevoke?.id : null,
	});

	function handleConfirmRevoke() {
		if (!apiKeyToRevoke) {
			return;
		}

		revokeApiKey.mutate({
			trackableId,
			apiKeyId: apiKeyToRevoke.id,
		});
	}

	return (
		<>
			<div className="space-y-6">
				<ConnectionGuide trackableName={trackableName} />
				<DataTable
					columns={columns}
					data={data}
					title={<T>API Keys</T>}
					description={
						<T>
							Manage the API keys that can send log events to this trackable.
						</T>
					}
					headerButton={
						headerButton ?? <CreateApiKeyDialog trackableId={trackableId} />
					}
					emptyMessage={gt("No connections created yet.")}
					initialPageSize={5}
				/>
			</div>
			<Dialog
				open={Boolean(apiKeyToRevoke)}
				onOpenChange={(open) => {
					if (!open && !revokeApiKey.isPending) {
						setApiKeyToRevoke(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							<T>Revoke connection</T>
						</DialogTitle>
						<DialogDescription>
							{apiKeyToRevoke
								? `${gt("Revoke ")} "${apiKeyToRevoke.name}"${gt("? This connection will stay visible in the table but can no longer be used.")}`
								: gt("Revoke this connection?")}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setApiKeyToRevoke(null)}
							disabled={revokeApiKey.isPending}
						>
							<T>Cancel</T>
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={handleConfirmRevoke}
							disabled={revokeApiKey.isPending}
						>
							{revokeApiKey.isPending ? (
								<T>Revoking...</T>
							) : (
								<T>Revoke connection</T>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function ConnectionGuide({ trackableName }: { trackableName: string }) {
	const [endpoint, setEndpoint] = useState(() =>
		buildAbsoluteUrl("/api/usage").toString(),
	);
	const exampleName = JSON.stringify(trackableName);
	const [copiedValue, setCopiedValue] = useState<"endpoint" | "curl" | null>(
		null,
	);

	useEffect(() => {
		setEndpoint(new URL("/api/usage", window.location.origin).toString());
	}, []);

	const exampleCurl = [
		`curl -X POST ${endpoint} \\`,
		'  -H "Content-Type: application/json" \\',
		'  -H "X-Api-Key: trk_live_your_connection_key" \\',
		`  -d '{"event":"Button pressed", "level":"info", "message":"Request completed"}'`,
	].join("\n");

	async function handleCopy(value: string, target: "endpoint" | "curl") {
		await navigator.clipboard.writeText(value);
		setCopiedValue(target);
		window.setTimeout(() => {
			setCopiedValue((current) => (current === target ? null : current));
		}, 1500);
	}

	return (
		<div className="space-y-4 text-sm text-muted-foreground">
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-foreground">
						<T>API Endpoint</T>
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 gap-1.5"
						onClick={() => void handleCopy(endpoint, "endpoint")}
					>
						<Copy className="size-3.5" />
						{copiedValue === "endpoint" ? <T>Copied</T> : <T>Copy</T>}
					</Button>
				</div>
				<pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs text-foreground">
					{endpoint}
				</pre>
			</div>
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-foreground">
						<T>cURL Example</T>
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 gap-1.5"
						onClick={() => void handleCopy(exampleCurl, "curl")}
					>
						<Copy className="size-3.5" />
						{copiedValue === "curl" ? <T>Copied</T> : <T>Copy</T>}
					</Button>
				</div>
				<pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs text-foreground">
					{exampleCurl}
				</pre>
			</div>
		</div>
	);
}
