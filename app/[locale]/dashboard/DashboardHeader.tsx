"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserAccountButton } from "@/components/user-account-button";

export function DashboardHeader() {
	return (
		<>
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
				<div className="flex h-15 w-full items-center justify-between gap-4 px-6 md:px-8">
					<div className="flex h-full min-w-0 flex-1 items-center gap-4">
						<SidebarTrigger className="-ml-1" />
					</div>
					<div className="flex min-w-0 items-center gap-3">
						<UserAccountButton />
					</div>
				</div>
			</header>
		</>
	);
}
