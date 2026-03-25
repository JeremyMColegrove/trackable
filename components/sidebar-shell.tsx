import { AppBrand } from "@/components/app-brand";
import { WorkspaceSwitcher } from "@/app/[locale]/dashboard/workspace-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";

export function SidebarShell({
	children,
	href,
	footer,
	...props
}: {
	children: React.ReactNode;
	href: string;
	footer?: React.ReactNode;
} & React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader className="border-b p-4">
				<AppBrand href={href} />
			</SidebarHeader>
			<SidebarContent>{children}</SidebarContent>
			<SidebarFooter className="border-t px-3 py-3">
				<div className="space-y-2">
					<WorkspaceSwitcher triggerClassName="w-full justify-between" />
					{footer}
				</div>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
