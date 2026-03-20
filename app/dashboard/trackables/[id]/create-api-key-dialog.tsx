"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

const expirationPresetOptions = [
	{ value: "never", label: "Never" },
	{ value: "30_days", label: "30 days" },
	{ value: "60_days", label: "60 days" },
	{ value: "90_days", label: "90 days" },
] as const;

const formSchema = z.object({
	name: z.string().min(2, "API key name must be at least 2 characters."),
	expirationPreset: z.enum(["never", "30_days", "60_days", "90_days"]),
});

type FormValues = z.infer<typeof formSchema>;

type CreateApiKeyDialogProps = {
	trackableId: string;
	onCreated?: (createdKey: { id: string; plaintextKey: string }) => void;
};

export function CreateApiKeyDialog({
	trackableId,
	onCreated,
}: CreateApiKeyDialogProps) {
	const [open, setOpen] = useState(false);
	const [createdKey, setCreatedKey] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			expirationPreset: "never",
		},
	});

	const createApiKey = useMutation(
		trpc.trackables.createApiKey.mutationOptions({
			onSuccess: async (result) => {
				setCreatedKey(result.plaintextKey);
				setCopied(false);
				onCreated?.({
					id: result.id,
					plaintextKey: result.plaintextKey,
				});
				form.reset({
					name: "",
					expirationPreset: "never",
				});

				await queryClient.invalidateQueries({
					queryKey: trpc.trackables.getById.queryKey({ id: trackableId }),
				});
			},
		}),
	);

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);

		if (!nextOpen) {
			setCreatedKey(null);
			setCopied(false);
			form.reset({
				name: "",
				expirationPreset: "never",
			});
		}
	}

	async function handleCopy() {
		if (!createdKey) {
			return;
		}

		await navigator.clipboard.writeText(createdKey);
		setCopied(true);
	}

	function onSubmit(values: FormValues) {
		createApiKey.mutate({
			trackableId,
			name: values.name,
			expirationPreset: values.expirationPreset,
		});
	}

	const isSubmitting = form.formState.isSubmitting || createApiKey.isPending;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="h-8 gap-2">
					<Plus className="size-4" />
					Create API Key
				</Button>
			</DialogTrigger>
			<DialogContent>
				{createdKey ? (
					<>
						<DialogHeader>
							<DialogTitle>API key created</DialogTitle>
							<DialogDescription>
								Copy this API key now. You will not be able to see it again.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-3">
							<code className="block break-all rounded-md border bg-muted/50 p-3 font-mono text-sm">
								{createdKey}
							</code>
							<p className="text-sm text-muted-foreground">
								Store it somewhere secure before closing this dialog.
							</p>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => void handleCopy()}
							>
								<Copy className="size-4" />
								{copied ? "Copied" : "Copy key"}
							</Button>
							<Button type="button" onClick={() => setOpen(false)}>
								Done
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Create API key</DialogTitle>
							<DialogDescription>
								Create an API key for sending logs to this trackable.
							</DialogDescription>
						</DialogHeader>
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="space-y-4"
							>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input
													placeholder="e.g. Production log key"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="expirationPreset"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Expiration</FormLabel>
											<FormControl>
												<select
													{...field}
													className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
												>
													{expirationPresetOptions.map((option) => (
														<option key={option.value} value={option.value}>
															{option.label}
														</option>
													))}
												</select>
											</FormControl>

											<FormMessage />
										</FormItem>
									)}
								/>

								<DialogFooter>
									<Button
										type="button"
										variant="outline"
										onClick={() => setOpen(false)}
										disabled={isSubmitting}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={isSubmitting}>
										{createApiKey.isPending ? "Creating..." : "Create API Key"}
									</Button>
								</DialogFooter>
							</form>
						</Form>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
