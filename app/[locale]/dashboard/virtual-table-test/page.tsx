import { VirtualTableDemoClient } from "./page-client";

export default function VirtualTableDemoPage() {
	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-8 pb-24">
			<h1 className="text-2xl font-bold">Virtual Table Demo (100k Rows)</h1>
			<VirtualTableDemoClient />
		</div>
	);
}
