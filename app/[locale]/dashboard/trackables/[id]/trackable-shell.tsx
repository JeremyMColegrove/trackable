"use client";

import { AppBrand } from "@/components/app-brand";
import { RequireAuth } from "@/components/auth/require-auth";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAccountButton } from "@/components/user-account-button";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowLeft,
	KeyRound,
	LayoutTemplate,
	Radio,
	Settings2,
	TableProperties,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext } from "react";
import { SurveyShareDialog } from "./survey-share-dialog";
import type { TrackableDetails } from "./table-types";
import { T, useGT, useLocale } from "gt-next";

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
): TrackableNavItem[] {
	const baseHref = `${dashboardBaseHref}/trackables/${trackable.id}`;

	if (trackable.kind === "survey") {
		return [
			{
				href: baseHref,
				label: "Responses",
				icon: TableProperties,
				isActive: (pathname) => pathname === baseHref,
			},
			{
				href: `${baseHref}/form`,
				label: "Form",
				icon: LayoutTemplate,
				isActive: (pathname) => pathname.startsWith(`${baseHref}/form`),
			},
			{
				href: `${baseHref}/settings`,
				label: "Settings",
				icon: Settings2,
				isActive: (pathname) => pathname.startsWith(`${baseHref}/settings`),
			},
		];
	}

	return [
		{
			href: baseHref,
			label: "Events",
			icon: Radio,
			isActive: (pathname) => pathname === baseHref,
		},
		{
			href: `${baseHref}/api-keys`,
			label: "Connection",
			icon: KeyRound,
			isActive: (pathname) => pathname.startsWith(`${baseHref}/api-keys`),
		},
		{
			href: `${baseHref}/settings`,
			label: "Settings",
			icon: Settings2,
			isActive: (pathname) => pathname.startsWith(`${baseHref}/settings`),
		},
	];
}

function getWorkspaceNavItems(dashboardBaseHref: string): TrackableNavItem[] {
	return [
		{
			href: dashboardBaseHref,
			label: "Back to Dashboard",
			icon: ArrowLeft,
			isActive: (pathname) =>
				pathname === dashboardBaseHref || pathname === "/dashboard",
		},
	];
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
					<Skeleton className="h-[28rem] rounded-xl" />
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
	const locale = useLocale();
	const pathname = usePathname();
	const { isMobile, setOpenMobile } = useSidebar();
	const dashboardBaseHref = locale === "en" ? "/dashboard" : `/${locale}/dashboard`;
	const trackableNavItems = getTrackableNavItems(trackable, dashboardBaseHref);
	const workspaceNavItems = getWorkspaceNavItems(dashboardBaseHref);

	function handleNavigate() {
		if (isMobile) {
			setOpenMobile(false);
		}
	}

	return (
		<Sidebar variant="inset" collapsible="offcanvas">
			<SidebarHeader className="gap-4 border-b px-4 py-4">
				<AppBrand href={dashboardBaseHref} />
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup className="px-3 py-3">
					<SidebarGroupLabel><T>Current Trackable</T></SidebarGroupLabel>
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
					<SidebarGroupLabel><T>Workspace</T></SidebarGroupLabel>
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
			</SidebarContent>

			<SidebarFooter className="border-t px-3 py-3"></SidebarFooter>

			<SidebarRail />
		</Sidebar>
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
	const trpc = useTRPC();
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
					description={gt("This trackable does not exist or you no longer have access to it.")}
				/>
			);
		}

		if (trackableQuery.isError) {
			return (
				<TrackableShellError
					title={gt("Unable to load trackable")}
					description={gt("There was a problem loading the latest trackable data.")}
				/>
			);
		}

		return <TrackableShellSkeleton />;
	}

	const trackable = trackableQuery.data;

	return (
		<TrackableDetailsContext.Provider value={trackable}>
			<SidebarProvider defaultOpen className="bg-muted/20">
				<TrackableSidebarNav trackable={trackable} />
				<SidebarInset className="min-h-svh min-w-0 overflow-hidden bg-background md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none">
					<header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
						<div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
							<div className="flex items-center gap-3">
								<SidebarTrigger />

								<span className="truncate text-sm font-semibold">
									{trackable.name}
								</span>
							</div>
							<div className="flex items-center gap-3">
								{trackable.kind === "survey" ? (
									<SurveyShareDialog
										trackableId={trackable.id}
										activeForm={trackable.activeForm}
										shareLinks={trackable.shareSettings.shareLinks}
									/>
								) : null}
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
