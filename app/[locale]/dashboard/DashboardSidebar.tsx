"use client";

import {
	getDashboardNavItems,
	isDashboardNavItemActive,
} from "@/app/[locale]/dashboard/navigation";
import { WorkspaceTierDialog } from "@/app/[locale]/dashboard/workspace-tier-dialog";
import { WorkspaceTierSection } from "@/app/[locale]/dashboard/workspace-tier-section";
import { SidebarShell } from "@/components/sidebar-shell";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { isSubscriptionEnforcementEnabled } from "@/lib/subscription-enforcement";
import type { SubscriptionTier } from "@/server/subscriptions/types";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

export function DashboardSidebar() {
	const subscriptionsEnabled = isSubscriptionEnforcementEnabled();
	const pathname = usePathname();
	const { setOpenMobile } = useSidebar();
	const trpc = useTRPC();
	const workspaceContext = useQuery(
		trpc.account.getWorkspaceContext.queryOptions(),
	);
	const currentTier = workspaceContext.data?.activeWorkspace.tier ?? "free";
	const navItems = getDashboardNavItems(
		workspaceContext.data?.hasAdminControls ?? false,
	);
	const [tierDialogOpen, setTierDialogOpen] = React.useState(false);
	const [dialogTier, setDialogTier] =
		React.useState<SubscriptionTier>(currentTier);

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
