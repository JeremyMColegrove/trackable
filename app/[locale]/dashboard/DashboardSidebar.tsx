"use client";

import {
	dashboardNavItems,
	isDashboardNavItemActive,
} from "@/app/[locale]/dashboard/navigation";
import { AppBrand } from "@/components/app-brand";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardSidebar() {
	const pathname = usePathname();
	const { setOpenMobile } = useSidebar();

	return (
		<Sidebar collapsible="offcanvas">
			<SidebarHeader className="border-b p-4">
				<AppBrand href="/dashboard" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup className="p-3">
					<SidebarGroupContent>
						<SidebarMenu>
							{dashboardNavItems.map((item) => (
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
			</SidebarContent>
		</Sidebar>
	);
}
