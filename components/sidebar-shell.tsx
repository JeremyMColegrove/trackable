import { AppBrand } from "@/components/app-brand";
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
			{footer && (
				<SidebarFooter className="border-t px-3 py-3">
					{footer}
				</SidebarFooter>
			)}
			<SidebarRail />
		</Sidebar>
	);
}
