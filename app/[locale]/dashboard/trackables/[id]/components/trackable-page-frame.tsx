import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Search } from "lucide-react";

export function TrackablePageFrame(props: {
	title: string;
	description: string;
	search?: React.ReactNode;
	headerActions?: React.ReactNode;
	children: React.ReactNode;
}) {
	const { title, description, search, headerActions, children } = props;

	return (
		<main className="flex-1">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-8 sm:px-6 lg:px-8">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="min-w-0 flex-1">
						<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
						{description && (
							<p className="mt-1 text-sm text-muted-foreground">
								{description}
							</p>
						)}
					</div>
					{headerActions && (
						<div className="ml-auto flex shrink-0 items-center gap-2">
							{headerActions}
						</div>
					)}
				</div>
				{search && <div className="flex flex-col gap-1">{search}</div>}
				{children}
			</div>
		</main>
	);
}

export function TrackablePageSearch({
	value,
	onChange,
	placeholder,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
}) {
	return (
		<div className="relative">
			<Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
				className="h-12 rounded-2xl border-border/60 bg-background pr-4 pl-11 shadow-xs"
			/>
		</div>
	);
}

export function UnsupportedPageState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<Card>
			<CardHeader className="flex flex-col gap-2">
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
		</Card>
	);
}

export function TrackableSectionHeader({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="mb-4">
			<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
			<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			<Separator className="mt-4" />
		</div>
	);
}
