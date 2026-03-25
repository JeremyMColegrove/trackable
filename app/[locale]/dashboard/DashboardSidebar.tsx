"use client";

import {
	getDashboardNavItems,
	isDashboardNavItemActive,
} from "@/app/[locale]/dashboard/navigation";
import { useWorkspaceContext } from "@/app/[locale]/dashboard/workspace-context-provider";
import { WorkspaceTierDialog } from "@/app/[locale]/dashboard/workspace-tier-dialog";
import { WorkspaceTierSection } from "@/app/[locale]/dashboard/workspace-tier-section";
import { useAppSettings } from "@/components/app-settings-provider";
import { SidebarShell } from "@/components/sidebar-shell";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import type { SubscriptionTier } from "@/server/subscriptions/types";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

export function DashboardSidebar() {
	const { subscriptionsEnabled } = useAppSettings();
	const { currentTier, hasAdminControls } = useWorkspaceContext();
	const trpc = useTRPC();
	const pathname = usePathname();
	const { setOpenMobile } = useSidebar();
	const navItems = getDashboardNavItems(hasAdminControls);
	const [tierDialogOpen, setTierDialogOpen] = React.useState(false);
	const [dialogTier, setDialogTier] =
		React.useState<SubscriptionTier>(currentTier);
	const myInvitationsQuery = useQuery(
		trpc.team.listMyPendingInvitations.queryOptions(),
	);
	const myInvitationCount = myInvitationsQuery.data?.length;

	function handleOpenTierDialog(tier: SubscriptionTier) {
		setDialogTier(tier);
		setTierDialogOpen(true);
	}

	return (
		<>
			<SidebarShell
				href="/dashboard"
				footer={
					subscriptionsEnabled ? (
						<WorkspaceTierSection onOpenDialog={handleOpenTierDialog} />
					) : undefined
				}
			>
				<SidebarGroup className="p-3">
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										asChild
										isActive={isDashboardNavItemActive(item.href, pathname)}
									>
										<Link
											href={item.href}
											className="flex w-full items-center justify-between gap-2"
											onClick={() => setOpenMobile(false)}
										>
											<span>{item.label}</span>
										</Link>
									</SidebarMenuButton>
									{item.href === "/dashboard/team" &&
									typeof myInvitationCount === "number" &&
									myInvitationCount > 0 ? (
										<SidebarMenuBadge>{myInvitationCount}</SidebarMenuBadge>
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
