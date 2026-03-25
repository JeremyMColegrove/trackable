import { T } from "gt-next";

export type DashboardNavItem = {
	href: string;
	label: string | React.ReactNode;
};

export function getDashboardNavItems(
	hasAdminControls: boolean,
): DashboardNavItem[] {
	return [
		{
			href: "/dashboard",
			label: <T>Overview</T>,
		},
		{
			href: "/dashboard/team",
			label: <T>Team</T>,
		},
		...(hasAdminControls
			? [
					{
						href: "/dashboard/internal/batch",
						label: <T>Batch Jobs</T>,
					},
				]
			: []),
	];
}

export function isDashboardNavItemActive(href: string, pathname: string) {
	if (href === "/dashboard") {
		return pathname === href || pathname.startsWith("/dashboard/trackables/");
	}

	return pathname === href;
}
