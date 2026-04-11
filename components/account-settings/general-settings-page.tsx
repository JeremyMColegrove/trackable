"use client";

import {
	type SignedInDevice,
	SignedInDevicesSection,
} from "@/components/account-settings/signed-in-devices-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { authClient, signOut, useSession } from "@/lib/auth-client";
import { useTRPC, useTRPCClient } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT, useLocale } from "gt-next";
import { LocaleSelector } from "gt-next/client";
import { LoaderCircle, LogOut, Moon, Pencil, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { toast } from "sonner";

const EMAIL_CHANGE_PARAM = "newEmail";

function getErrorMessage(error: unknown, fallback: string) {
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string" &&
		error.message.trim().length > 0
	) {
		return error.message;
	}

	return fallback;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
	const bytes = new Uint8Array(buffer);
	const chunkSize = 0x8000;
	let binary = "";

	for (let index = 0; index < bytes.length; index += chunkSize) {
		const chunk = bytes.subarray(index, index + chunkSize);
		binary += String.fromCharCode(...chunk);
	}

	return window.btoa(binary);
}

type SettingsSectionProps = {
	action?: React.ReactNode;
	children: React.ReactNode;
	description: React.ReactNode;
	title: React.ReactNode;
};

function SettingsSection({
	action,
	children,
	description,
	title,
}: SettingsSectionProps) {
	return (
		<section className="overflow-hidden rounded-2xl border bg-card">
			<div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<h3 className="text-sm font-semibold text-foreground">{title}</h3>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
			<Separator />
			<div className="px-5 py-4">{children}</div>
		</section>
	);
}

export function GeneralSettingsPage() {
	const gt = useGT();
	const locale = useLocale();
	const { resolvedTheme, setTheme } = useTheme();
	const trpc = useTRPC();
	const trpcClient = useTRPCClient();
	const queryClient = useQueryClient();
	const { refetch: refetchSession } = useSession();
	const meQuery = useQuery(trpc.me.get.queryOptions());
	const sessionsQuery = useQuery(trpc.me.listSessions.queryOptions());
	const meQueryKey = trpc.me.get.queryKey();
	const sessionsQueryKey = trpc.me.listSessions.queryKey();
	const fileInputRef = React.useRef<HTMLInputElement | null>(null);

	const profile = meQuery.data?.appProfile;
	const authUser = meQuery.data?.authUser;
	const canChangeEmail = meQuery.data?.capabilities.canChangeEmail ?? false;
	const name = profile?.displayName ?? authUser?.name ?? null;
	const email = profile?.primaryEmail ?? authUser?.email ?? null;
	const imageUrl = profile?.imageUrl ?? authUser?.image ?? null;

	const [isEditingName, setIsEditingName] = React.useState(false);
	const [isEditingEmail, setIsEditingEmail] = React.useState(false);
	const [isThemeReady, setIsThemeReady] = React.useState(false);
	const [nameValue, setNameValue] = React.useState("");
	const [emailValue, setEmailValue] = React.useState("");

	React.useEffect(() => {
		setIsThemeReady(true);
	}, []);

	React.useEffect(() => {
		if (!isEditingName) {
			setNameValue(name ?? "");
		}
	}, [isEditingName, name]);

	React.useEffect(() => {
		if (!isEditingEmail) {
			setEmailValue(email ?? "");
		}
	}, [email, isEditingEmail]);

	const refreshAccountState = React.useCallback(async () => {
		await Promise.all([
			refetchSession(),
			queryClient.invalidateQueries({ queryKey: meQueryKey }),
			queryClient.invalidateQueries({ queryKey: sessionsQueryKey }),
		]);
	}, [meQueryKey, queryClient, refetchSession, sessionsQueryKey]);

	const updateName = useMutation({
		mutationFn: async (nextName: string) => {
			const trimmedName = nextName.trim();

			if (!trimmedName) {
				throw new Error("Name is required.");
			}

			const result = await authClient.updateUser({
				name: trimmedName,
			});

			if (result.error) {
				throw new Error(result.error.message || "Unable to update your name.");
			}
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Unable to update your name."));
		},
		onSuccess: async () => {
			setIsEditingName(false);
			toast.success(gt("Name updated."));
			await refreshAccountState();
		},
	});

	const updateEmail = useMutation({
		mutationFn: async (nextEmail: string) => {
			const trimmedEmail = nextEmail.trim();

			if (!trimmedEmail) {
				throw new Error("Email is required.");
			}

			const callbackURL = new URL(window.location.origin);
			callbackURL.pathname = `/${locale}/auth/change-email`;
			callbackURL.searchParams.set(
				EMAIL_CHANGE_PARAM,
				trimmedEmail.toLowerCase(),
			);

			const result = await authClient.changeEmail({
				callbackURL: `${callbackURL.pathname}${callbackURL.search}${callbackURL.hash}`,
				newEmail: trimmedEmail,
			});

			if (result.error) {
				throw new Error(result.error.message || "Unable to update your email.");
			}

			return result.data;
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Unable to update your email."));
		},
		onSuccess: async () => {
			setIsEditingEmail(false);
			toast.success(
				gt("Check your new email to finish changing your address."),
			);
			await refreshAccountState();
		},
	});

	const uploadProfileImage = useMutation({
		mutationFn: async (file: File) => {
			const upload = await trpcClient.account.uploadProfileImage.mutate({
				contentBase64: arrayBufferToBase64(await file.arrayBuffer()),
				mimeType: file.type || "application/octet-stream",
				previousImageUrl: imageUrl,
			});

			const result = await authClient.updateUser({
				image: upload.imageUrl,
			});

			if (result.error) {
				throw new Error(result.error.message || "Unable to update your image.");
			}
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Unable to upload your image."));
		},
		onSuccess: async () => {
			toast.success(gt("Profile image updated."));
			await refreshAccountState();
		},
	});

	const signOutEverywhere = useMutation({
		mutationFn: async () => {
			await trpcClient.me.revokeOtherSessions.mutate();
		},
		onError: (error) => {
			toast.error(
				getErrorMessage(error, "Unable to log you out of all devices."),
			);
		},
		onSuccess: async () => {
			await signOut({
				fetchOptions: {
					onSuccess: () => {
						window.location.href = "/";
					},
				},
			});
		},
	});

	const revokeSession = useMutation({
		mutationFn: async (session: SignedInDevice) => {
			if (session.isCurrent) {
				await signOut({
					fetchOptions: {
						onSuccess: () => {
							window.location.href = "/";
						},
					},
				});
				return;
			}

			await trpcClient.me.revokeSession.mutate({
				token: session.token,
			});
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Unable to log out that device."));
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
		},
	});

	async function handleProfileImageSelection(
		event: React.ChangeEvent<HTMLInputElement>,
	) {
		const file = event.target.files?.[0];
		event.target.value = "";

		if (!file) {
			return;
		}

		try {
			uploadProfileImage.mutate(file);
		} catch (error) {
			toast.error(getErrorMessage(error, "Unable to read that image file."));
		}
	}

	if (meQuery.isLoading && !meQuery.data) {
		return (
			<div className="space-y-6" aria-label={gt("Loading account settings")}>
				<Card className="rounded-2xl">
					<CardContent className="space-y-4 pt-6">
						<div className="flex items-center gap-4">
							<Skeleton className="size-20 rounded-full" />
							<div className="space-y-2">
								<Skeleton className="h-5 w-40" />
								<Skeleton className="h-4 w-56" />
							</div>
						</div>
						<div className="flex gap-2">
							<Skeleton className="h-8 w-28" />
							<Skeleton className="h-8 w-24" />
						</div>
					</CardContent>
				</Card>
				<Skeleton className="h-44 rounded-2xl" />
				<Skeleton className="h-44 rounded-2xl" />
			</div>
		);
	}

	if (meQuery.error) {
		return (
			<p className="text-sm text-destructive">
				<T>Failed to load your account details. Please try again.</T>
			</p>
		);
	}

	return (
		<div className="space-y-6">
			<Card className="rounded-2xl">
				<CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-4">
						<div className="group relative">
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleProfileImageSelection}
							/>
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								disabled={uploadProfileImage.isPending}
								className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
								aria-label={gt("Update profile image")}
							>
								<UserAvatar
									className="size-20"
									fallbackClassName="text-lg font-semibold"
									imageUrl={imageUrl}
									name={name}
									email={email}
								/>
								<span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/45 group-hover:opacity-100 group-focus-within:bg-black/45 group-focus-within:opacity-100">
									{uploadProfileImage.isPending ? (
										<LoaderCircle className="size-5 animate-spin" />
									) : (
										<Pencil className="size-5" />
									)}
								</span>
							</button>
						</div>
						<div className="min-w-0 space-y-1">
							<p className="truncate text-base font-semibold text-foreground">
								{name || "Unknown user"}
							</p>
							<p className="truncate text-sm text-muted-foreground">
								{email || "No email"}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<SettingsSection
				title={<T>Profile</T>}
				description={<T>Update the details that appear across your account.</T>}
			>
				<div className="space-y-6">
					<div className="space-y-3">
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="text-sm font-medium text-foreground">
									<T>Name</T>
								</p>
								<p className="text-sm text-muted-foreground">
									<T>This is the name shown in your workspace.</T>
								</p>
							</div>
							{!isEditingName ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setIsEditingName(true)}
								>
									<Pencil data-icon="inline-start" />
									<T>Edit</T>
								</Button>
							) : null}
						</div>

						{isEditingName ? (
							<form
								className="space-y-3"
								onSubmit={(event) => {
									event.preventDefault();
									updateName.mutate(nameValue);
								}}
							>
								<div className="space-y-2">
									<Input
										id="account-name"
										value={nameValue}
										onChange={(event) => setNameValue(event.target.value)}
										disabled={updateName.isPending}
										maxLength={100}
									/>
								</div>
								<div className="flex gap-2">
									<Button type="submit" disabled={updateName.isPending}>
										{updateName.isPending ? (
											<LoaderCircle
												className="animate-spin"
												data-icon="inline-start"
											/>
										) : null}
										<T>Save</T>
									</Button>
									<Button
										type="button"
										variant="ghost"
										disabled={updateName.isPending}
										onClick={() => {
											setIsEditingName(false);
											setNameValue(name ?? "");
										}}
									>
										<T>Cancel</T>
									</Button>
								</div>
							</form>
						) : (
							<p className="text-sm font-medium text-foreground">
								{name || "Add your name"}
							</p>
						)}
					</div>

					{canChangeEmail ? (
						<>
							<Separator />

							<div className="space-y-3">
								<div className="flex items-center justify-between gap-4">
									<div>
										<p className="text-sm font-medium text-foreground">
											<T>Email</T>
										</p>
										<p className="text-sm text-muted-foreground">
											<T>Changing your email may require verification.</T>
										</p>
									</div>
									{!isEditingEmail ? (
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => setIsEditingEmail(true)}
										>
											<Pencil data-icon="inline-start" />
											<T>Edit</T>
										</Button>
									) : null}
								</div>

								{isEditingEmail ? (
									<form
										className="space-y-3"
										onSubmit={(event) => {
											event.preventDefault();
											updateEmail.mutate(emailValue);
										}}
									>
										<div className="space-y-2">
											<Label htmlFor="account-email">
												<T>Email address</T>
											</Label>
											<Input
												id="account-email"
												type="email"
												value={emailValue}
												onChange={(event) => setEmailValue(event.target.value)}
												disabled={updateEmail.isPending}
											/>
										</div>
										<div className="flex gap-2">
											<Button type="submit" disabled={updateEmail.isPending}>
												{updateEmail.isPending ? (
													<LoaderCircle
														className="animate-spin"
														data-icon="inline-start"
													/>
												) : null}
												<T>Save</T>
											</Button>
											<Button
												type="button"
												variant="ghost"
												disabled={updateEmail.isPending}
												onClick={() => {
													setIsEditingEmail(false);
													setEmailValue(email ?? "");
												}}
											>
												<T>Cancel</T>
											</Button>
										</div>
									</form>
								) : (
									<p className="text-sm font-medium text-foreground">
										{email || "Add your email"}
									</p>
								)}
							</div>
						</>
					) : null}
				</div>
			</SettingsSection>
			<SettingsSection
				title={<T>Preferences</T>}
				description={
					<T>Choose how the app looks and which language it uses.</T>
				}
			>
				<div className="space-y-6">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
						<div className="space-y-1">
							<p className="text-sm font-medium text-foreground">
								<T>Language</T>
							</p>
							<p className="text-sm text-muted-foreground">
								<T>Select the language used across the app.</T>
							</p>
						</div>
						<LocaleSelector />
						{/* <Select
							value={locale}
							onValueChange={(nextLocale) => {
								void setLocale(nextLocale);
							}}
						>
							<SelectTrigger className="w-full sm:w-[220px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								{supportedLocales.map((supportedLocale) => (
									<SelectItem key={supportedLocale} value={supportedLocale}>
										{getLanguageLabel(supportedLocale, locale)}
									</SelectItem>
								))}
							</SelectContent>
						</Select> */}
					</div>

					<Separator />

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
						<div className="space-y-1">
							<p className="text-sm font-medium text-foreground">
								<T>Appearance</T>
							</p>
							<p className="text-sm text-muted-foreground">
								<T>Switch between light and dark mode.</T>
							</p>
						</div>
						<div className="flex items-center gap-3 self-start sm:self-center">
							<span className="text-sm text-muted-foreground">
								{isThemeReady && resolvedTheme === "dark" ? (
									<T>Dark</T>
								) : (
									<T>Light</T>
								)}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => {
									setTheme(
										isThemeReady && resolvedTheme === "dark" ? "light" : "dark",
									);
								}}
								disabled={!isThemeReady}
								aria-label={gt("Toggle dark mode")}
							>
								{isThemeReady && resolvedTheme === "dark" ? <Moon /> : <Sun />}
							</Button>
						</div>
					</div>
				</div>
			</SettingsSection>
			<SettingsSection
				title={<T>Signed-in devices</T>}
				description={
					<T>
						Review active sessions, their locations, and sign out any device.
					</T>
				}
			>
				<div className="mb-4">
					<SignedInDevicesSection
						isLoading={sessionsQuery.isLoading && !sessionsQuery.data}
						isPendingRevoke={revokeSession.isPending}
						sessions={sessionsQuery.data ?? []}
					/>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<Button
						type="button"
						variant="destructive"
						onClick={() => signOutEverywhere.mutate()}
						disabled={signOutEverywhere.isPending}
					>
						{signOutEverywhere.isPending ? (
							<LoaderCircle className="animate-spin" data-icon="inline-start" />
						) : (
							<LogOut data-icon="inline-start" />
						)}
						<T>Log out of all devices</T>
					</Button>
				</div>
			</SettingsSection>
		</div>
	);
}
