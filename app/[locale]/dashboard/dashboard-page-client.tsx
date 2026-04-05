"use client";

import { CreateTrackableDialog } from "@/app/[locale]/dashboard/CreateProjectDialog";
import { DashboardMetrics } from "@/app/[locale]/dashboard/DashboardMetrics";
import { DashboardTrackablesTable } from "@/app/[locale]/dashboard/DashboardProjectsTable";
import {
	BillingSuccessModal,
	type BillingSuccessScenario,
} from "@/app/[locale]/dashboard/billing-success-modal";
import { PageShell } from "@/components/page-shell";
import { useGT } from "gt-next";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function DashboardPageClient() {
	const gt = useGT();
	const searchParams = useSearchParams();
	const router = useRouter();
	const [successScenario, setSuccessScenario] =
		useState<BillingSuccessScenario | null>(null);

	useEffect(() => {
		if (searchParams.get("billing") === "success") {
			const planParam = searchParams.get("plan");

			if (planParam && planParam !== "free") {
				setSuccessScenario({ type: "new", toTier: planParam });
			}

			router.replace("/dashboard", { scroll: false });
		}
	}, [searchParams, router]);

	return (
		<>
			<PageShell
				title={gt("Overview")}
				headerActions={<CreateTrackableDialog />}
			>
				<DashboardMetrics />

				<DashboardTrackablesTable
					title={gt("Trackables")}
					titleVariant="default"
					description={gt("Manage your logs, surveys, and links")}
					showSearch={false}
					showViewOptions={false}
				/>
			</PageShell>

			{successScenario && (
				<BillingSuccessModal
					open={!!successScenario}
					onOpenChange={(open) => {
						if (!open) setSuccessScenario(null);
					}}
					scenario={successScenario}
				/>
			)}
		</>
	);
}
