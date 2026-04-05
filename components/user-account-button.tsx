"use client";

import { useAppSettings } from "@/components/app-settings-provider";
import { McpTokensProfilePage } from "@/components/mcp-tokens-profile-page";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useTRPC } from "@/trpc/client";
import { UserButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next";
import { KeyRound, Shield } from "lucide-react";

export function UserAccountButton() {
	const gt = useGT();
	const { customMCPServerTokens } = useAppSettings();
	return (
		<UserButton
			appearance={{
				elements: {
					userButtonPopoverRootBox: { pointerEvents: "auto" },
				},
			}}
		>
			{customMCPServerTokens ? (
				<UserButton.UserProfilePage
					label={gt("API keys")}
					labelIcon={<KeyRound className="size-4" />}
					url="api-keys"
				>
					<McpTokensProfilePage />
				</UserButton.UserProfilePage>
			) : null}
			<UserButton.UserProfilePage
				label={gt("Privacy")}
				labelIcon={<Shield className="size-4" />}
				url="privacy"
			>
				<ProfilePrivacyPage />
			</UserButton.UserProfilePage>
		</UserButton>
	);
}

function ProfilePrivacyPage() {
	const gt = useGT();
	const { user } = useUser();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const queryKey = trpc.account.getProfilePrivacy.queryKey();
	type ProfilePrivacyQueryData = {
		hasAdminControls: boolean;
		isProfilePrivate: boolean;
	};
	const profilePrivacyQuery = useQuery(
		trpc.account.getProfilePrivacy.queryOptions(),
	);

	const updateProfilePrivacy = useMutation(
		trpc.account.updateProfilePrivacy.mutationOptions({
			onMutate: async (values) => {
				await queryClient.cancelQueries({ queryKey });

				const previousPrivacy =
					queryClient.getQueryData<ProfilePrivacyQueryData>(queryKey);

				queryClient.setQueryData(queryKey, {
					hasAdminControls: previousPrivacy?.hasAdminControls ?? false,
					isProfilePrivate: values.isProfilePrivate,
				});

				return { previousPrivacy };
			},
			onError: (_error, _values, context) => {
				if (context?.previousPrivacy) {
					queryClient.setQueryData(queryKey, context.previousPrivacy);
				}
			},
			onSuccess: async (data) => {
				queryClient.setQueryData(
					queryKey,
					(previous: ProfilePrivacyQueryData | undefined) => ({
						hasAdminControls: previous?.hasAdminControls ?? false,
						isProfilePrivate: data.isProfilePrivate,
					}),
				);
				await user?.reload();
			},
		}),
	);

	const isProfilePrivate =
		profilePrivacyQuery.data?.isProfilePrivate ??
		user?.publicMetadata?.isProfilePrivate === true;

	const isLoadingPrivacy =
		profilePrivacyQuery.isLoading && !profilePrivacyQuery.data;

	return (
		<div className="space-y-4">
			<div className="space-y-1">
				<h2 className="text-sm font-semibold text-foreground">
					<T>Profile privacy</T>
				</h2>
				<p className="text-sm text-muted-foreground">
					<T>Hide your profile from other users across Trackable.</T>
				</p>
			</div>

			{isLoadingPrivacy ? (
				<div
					aria-label={gt("Loading privacy settings")}
					className="rounded-lg border p-4"
				>
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-56" />
						</div>
						<Skeleton className="h-6 w-11 rounded-full" />
					</div>
				</div>
			) : (
				<div className="flex items-start justify-between gap-4 rounded-lg border p-4">
					<div className="space-y-1">
						<p className="text-sm font-medium text-foreground">
							<T>Private profile</T>
						</p>
						<p className="text-sm text-muted-foreground">
							<T>
								When enabled, your profile is treated as private by the app.
							</T>
						</p>
					</div>
					<Switch
						checked={isProfilePrivate}
						disabled={updateProfilePrivacy.isPending}
						onCheckedChange={(checked) =>
							updateProfilePrivacy.mutate({ isProfilePrivate: checked })
						}
					/>
				</div>
			)}

			{updateProfilePrivacy.error ? (
				<p className="text-sm text-destructive">
					<T>Failed to update your privacy setting. Please try again.</T>
				</p>
			) : null}
		</div>
	);
}
