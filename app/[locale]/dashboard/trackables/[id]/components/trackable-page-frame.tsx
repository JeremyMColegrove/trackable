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
	eyebrow: string;
	title: string;
	description: string;
	search?: React.ReactNode;
	children: React.ReactNode;
}) {
	const { search, children } = props;
	const hasTopControls = search !== undefined;

	return (
		<main className="flex-1">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-1 pb-0 lg:px-6">
				{hasTopControls ? (
					<div className="flex flex-col gap-1">{search}</div>
				) : null}
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

export function TrackableNarrowContent({ children }: { children: React.ReactNode }) {
	return <div className="mx-auto w-full max-w-4xl">{children}</div>;
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
