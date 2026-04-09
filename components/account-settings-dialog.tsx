"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { T } from "gt-next";
import * as React from "react";
import { Button } from "./ui/button";

type AccountSettingsDialogPageProps = {
	children: React.ReactNode;
	description?: React.ReactNode;
	icon?: React.ReactNode;
	id: string;
	label: React.ReactNode;
	title: React.ReactNode;
};

type AccountSettingsDialogProps = {
	children: React.ReactNode;
	initialPage?: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

export function AccountSettingsDialog({
	children,
	initialPage,
	onOpenChange,
	open,
}: AccountSettingsDialogProps) {
	void initialPage;
	const pages = React.Children.toArray(children).filter(
		(child): child is React.ReactElement<AccountSettingsDialogPageProps> =>
			React.isValidElement<AccountSettingsDialogPageProps>(child),
	);

	const [activePageIndex, setActivePageIndex] = React.useState<number>(0);

	const activePage = pages.at(activePageIndex);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[min(86vh,52rem)] max-w-[min(calc(100%-2rem),72rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)] lg:max-w-4xl">
				<DialogHeader className="border-b px-6 py-4">
					<DialogTitle>
						<T>Account Settings</T>
					</DialogTitle>
				</DialogHeader>

				<div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
					<aside className="shrink-0 border-b bg-muted/20 md:min-h-0 md:border-r md:border-b-0">
						<nav
							aria-label="Account settings pages"
							className="flex gap-2 overflow-x-auto p-3 md:flex-col md:py-3"
						>
							{pages.map((page, index) => {
								const isActive = index === activePageIndex;

								return (
									<Button
										type="button"
										key={page.props.id}
										onClick={() => setActivePageIndex(index)}
										variant="ghost"
										className={cn(
											"justify-start rounded-full border border-transparent px-4 py-3 text-muted-foreground md:w-full md:rounded-lg",
											isActive
												? "border-border/70 bg-background text-foreground shadow-sm hover:bg-background hover:text-foreground"
												: "hover:border-border/50 hover:bg-background/60 hover:text-foreground",
										)}
										aria-current={isActive ? "page" : undefined}
									>
										{page.props.icon ? (
											<span className="flex size-4 shrink-0 items-center justify-center text-current">
												{page.props.icon}
											</span>
										) : null}
										<span className="whitespace-nowrap">
											{page.props.label}
										</span>
									</Button>
								);
							})}
						</nav>
					</aside>

					<div className="min-h-0 min-w-0 overflow-y-auto p-6">
						{activePage ? (
							<div className="space-y-4">
								<div className="space-y-1">
									<h2 className="text-sm font-semibold text-foreground">
										{activePage.props.title}
									</h2>
									{activePage.props.description ? (
										<p className="text-sm text-muted-foreground">
											{activePage.props.description}
										</p>
									) : null}
								</div>
								{activePage.props.children}
							</div>
						) : null}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function AccountSettingsDialogPage(
	_props: AccountSettingsDialogPageProps,
) {
	void _props;
	return null;
}

AccountSettingsDialogPage.displayName = "AccountSettingsDialogPage";
