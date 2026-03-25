"use client";

import { WorkspaceTierDialog } from "@/app/[locale]/dashboard/workspace-tier-dialog";
import { WorkspaceTierSection } from "@/app/[locale]/dashboard/workspace-tier-section";
import { RequireAuth } from "@/components/auth/require-auth";
import { SidebarShell } from "@/components/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAccountButton } from "@/components/user-account-button";
import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement";
import {
	getTrackableKindShortLabel,
	getTrackableKindVisuals,
} from "@/lib/trackable-kind";
import type { SubscriptionTier } from "@/server/subscriptions/types";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { T, useGT, useLocale } from "gt-next";
import {
	ArrowLeft,
	ChevronRight,
	KeyRound,
	LayoutTemplate,
	Radio,
	Settings2,
	TableProperties,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import type { TrackableDetails } from "./table-types";

type TrackableNavItem = {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	isActive: (pathname: string) => boolean;
	badge?: React.ReactNode;
};

const TrackableDetailsContext = createContext<TrackableDetails | null>(null);

function getTrackableNavItems(
	trackable: TrackableDetails,
	dashboardBaseHref: string,
	gt: (value: string) => string,
): TrackableNavItem[] {
	const baseHref = `${dashboardBaseHref}/trackables/${trackable.id}`;

	if (trackable.kind === "survey") {
		return [
			{
				href: baseHref,
				label: gt("Responses"),
				icon: TableProperties,
				isActive: (pathname) => pathname === baseHref,
			},
			...(trackable.permissions.canManageForm
				? [
						{
							href: `${baseHref}/form`,
							label: gt("Form Builder"),
							icon: LayoutTemplate,
							isActive: (pathname: string) =>
								pathname.startsWith(`${baseHref}/form`),
						},
					]
				: []),
			...(trackable.permissions.canManageSettings
				? [
						{
							href: `${baseHref}/settings`,
							label: gt("Settings"),
							icon: Settings2,
							isActive: (pathname: string) =>
								pathname.startsWith(`${baseHref}/settings`),
						},
					]
				: []),
		];
	}

	return [
		{
			href: baseHref,
			label: gt("Events"),
			icon: Radio,
			isActive: (pathname) => pathname === baseHref,
		},
		...(trackable.permissions.canManageApiKeys
			? [
					{
						href: `${baseHref}/api-keys`,
						label: gt("Connection"),
						icon: KeyRound,
						isActive: (pathname: string) =>
							pathname.startsWith(`${baseHref}/api-keys`),
					},
				]
			: []),
		...(trackable.permissions.canManageSettings
			? [
					{
						href: `${baseHref}/settings`,
						label: gt("Settings"),
						icon: Settings2,
						isActive: (pathname: string) =>
							pathname.startsWith(`${baseHref}/settings`),
					},
				]
			: []),
	];
}

function getWorkspaceNavItems(
	dashboardBaseHref: string,
	gt: (value: string) => string,
): TrackableNavItem[] {
	return [
		{
			href: dashboardBaseHref,
			label: gt("Back to Dashboard"),
			icon: ArrowLeft,
			isActive: (pathname) =>
				pathname === dashboardBaseHref || pathname === "/dashboard",
		},
	];
}

function getTrackableBreadcrumbLabel({
	pathname,
	baseHref,
	trackableKind,
	gt,
}: {
	pathname: string;
	baseHref: string;
	trackableKind: TrackableDetails["kind"];
	gt: (value: string) => string;
}) {
	if (pathname.startsWith(`${baseHref}/form`)) {
		return gt("Form Builder");
	}

	if (pathname.startsWith(`${baseHref}/api-keys`)) {
		return gt("Connection");
	}

	if (pathname.startsWith(`${baseHref}/settings`)) {
		return gt("Settings");
	}

	if (trackableKind === "survey") {
		return gt("Responses");
	}

	return gt("Events");
}

function TrackableShellSkeleton() {
	return (
		<div className="flex min-h-svh bg-muted/20">
			<div className="hidden w-72 border-r bg-sidebar md:block">
				<div className="flex flex-col gap-4 p-4">
					<Skeleton className="h-7 w-28" />
					<Skeleton className="h-24 rounded-xl" />
					<div className="flex flex-col gap-2">
						<Skeleton className="h-8 rounded-md" />
						<Skeleton className="h-8 rounded-md" />
						<Skeleton className="h-8 rounded-md" />
					</div>
				</div>
			</div>

			<div className="flex min-h-svh flex-1 flex-col">
				<div className="border-b bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
					<div className="flex items-center justify-between">
						<Skeleton className="h-8 w-40" />
						<Skeleton className="size-8 rounded-full" />
					</div>
				</div>

				<div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
					<Skeleton className="h-12 w-72" />
					<Skeleton className="h-112 rounded-xl" />
				</div>
			</div>
		</div>
	);
}

function TrackableShellError({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="flex min-h-svh items-center justify-center bg-muted/20 px-4 py-12">
			<Card className="w-full max-w-2xl">
				<CardHeader className="flex flex-col gap-2">
					<Badge variant="outline" className="w-fit">
						<T>Trackable</T>
					</Badge>
					<CardTitle>{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
			</Card>
		</div>
	);
}

function TrackableSidebarNav({ trackable }: { trackable: TrackableDetails }) {
	const subscriptionsEnabled = isSubscriptionEnforcementEnabled();
	const gt = useGT();
	const locale = useLocale();
	const pathname = usePathname();
	const { isMobile, setOpenMobile } = useSidebar();
	const [tierDialogOpen, setTierDialogOpen] = useState(false);
	const [dialogTier, setDialogTier] = useState<SubscriptionTier>("free");
	const dashboardBaseHref =
		locale === "en" ? "/dashboard" : `/${locale}/dashboard`;
	const trackableNavItems = getTrackableNavItems(
		trackable,
		dashboardBaseHref,
		gt,
	);
	const workspaceNavItems = getWorkspaceNavItems(dashboardBaseHref, gt);
	const trackableBadgeClassName = getTrackableKindVisuals(
		trackable.kind,
	).badgeClassName;

	function handleNavigate() {
		if (isMobile) {
			setOpenMobile(false);
		}
	}

	function handleOpenTierDialog(tier: SubscriptionTier) {
		setDialogTier(tier);
		setTierDialogOpen(true);
	}

	return (
		<>
			<SidebarShell
				href={dashboardBaseHref}
				footer={
					subscriptionsEnabled ? (
						<WorkspaceTierSection onOpenDialog={handleOpenTierDialog} />
					) : undefined
				}
			>
				<SidebarGroup className="px-3 py-3">
					<SidebarGroupLabel className="justify-between gap-2">
						<span>
							<T>Current Trackable</T>
						</span>
						<Badge variant="outline" className={trackableBadgeClassName}>
							{getTrackableKindShortLabel(trackable.kind)}
						</Badge>
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu className="gap-1">
							{trackableNavItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										asChild
										isActive={item.isActive(pathname)}
										tooltip={item.label}
									>
										<Link href={item.href} onClick={handleNavigate}>
											<item.icon />
											<span>{item.label}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				<SidebarGroup className="px-3 py-3">
					<SidebarGroupLabel>
						<T>Workspace</T>
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{workspaceNavItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										asChild
										isActive={item.isActive(pathname)}
										tooltip={item.label}
									>
										<Link href={item.href} onClick={handleNavigate}>
											<item.icon />
											<span>{item.label}</span>
										</Link>
									</SidebarMenuButton>
									{item.badge !== undefined ? (
										<SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
									) : null}
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarShell>

			{subscriptionsEnabled ? (
				<WorkspaceTierDialog
					currentTier={dialogTier}
					open={tierDialogOpen}
					onOpenChange={setTierDialogOpen}
				/>
			) : null}
		</>
	);
}

function TrackableLayoutContent({
	trackableId,
	children,
}: {
	trackableId: string;
	children: React.ReactNode;
}) {
	const gt = useGT();
	const locale = useLocale();
	const trpc = useTRPC();
	const pathname = usePathname();
	const trackableQuery = useQuery(
		trpc.trackables.getById.queryOptions(
			{ id: trackableId },
			{
				retry: false,
			},
		),
	);

	if (trackableQuery.isLoading || !trackableQuery.data) {
		if (trackableQuery.error?.data?.code === "NOT_FOUND") {
			return (
				<TrackableShellError
					title={gt("Trackable not found")}
					description={gt(
						"This trackable does not exist or you no longer have access to it.",
					)}
				/>
			);
		}

		if (trackableQuery.isError) {
			return (
				<TrackableShellError
					title={gt("Unable to load trackable")}
					description={gt(
						"There was a problem loading the latest trackable data.",
					)}
				/>
			);
		}

		return <TrackableShellSkeleton />;
	}

	const trackable = trackableQuery.data;
	const dashboardBaseHref =
		locale === "en" ? "/dashboard" : `/${locale}/dashboard`;
	const trackableBaseHref = `${dashboardBaseHref}/trackables/${trackable.id}`;
	const breadcrumbLabel = getTrackableBreadcrumbLabel({
		pathname,
		baseHref: trackableBaseHref,
		trackableKind: trackable.kind,
		gt,
	});

	return (
		<TrackableDetailsContext.Provider value={trackable}>
			<SidebarProvider defaultOpen className="bg-background">
				<TrackableSidebarNav trackable={trackable} />
				<SidebarInset className="min-h-svh min-w-0 overflow-hidden bg-background">
					<header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
						<div className="flex h-15 w-full items-center justify-between px-4 sm:px-6">
							<div className="flex min-w-0 items-center gap-3">
								<SidebarTrigger className="-ml-1" />
								<nav
									aria-label={gt("Breadcrumb")}
									className="flex min-w-0 items-center gap-2 text-sm"
								>
									<Link
										href={dashboardBaseHref}
										className="font-medium text-muted-foreground transition-colors hover:text-foreground"
									>
										{gt("Overview")}
									</Link>
									<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
									<span className="truncate font-semibold">
										{trackable.name}
									</span>
									<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
									<span className="truncate text-muted-foreground">
										{breadcrumbLabel}
									</span>
								</nav>
							</div>
							<div className="flex items-center gap-3">
								<UserAccountButton />
							</div>
						</div>
					</header>
					<div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-4 sm:pt-6">
						{children}
					</div>
				</SidebarInset>
			</SidebarProvider>
		</TrackableDetailsContext.Provider>
	);
}

export function TrackableLayoutClient({
	trackableId,
	children,
}: {
	trackableId: string;
	children: React.ReactNode;
}) {
	return (
		<RequireAuth fallback={<TrackableShellSkeleton />}>
			<TrackableLayoutContent trackableId={trackableId}>
				{children}
			</TrackableLayoutContent>
		</RequireAuth>
	);
}

export function useTrackableDetails() {
	const context = useContext(TrackableDetailsContext);

	if (!context) {
		throw new Error(
			"useTrackableDetails must be used within TrackableLayoutClient.",
		);
	}

	return context;
}
