"use client";

import { useGT } from "gt-next";
import { useMemo } from "react";
import { ApiKeysTable } from "./api-keys-table";
import {
	TrackablePageFrame,
	UnsupportedPageState,
} from "./components/trackable-page-frame";
import { useTrackableDetails } from "./trackable-shell";

export function TrackableApiKeysSection() {
	const gt = useGT();
	const trackable = useTrackableDetails();
	const searchQuery = "";
	const filteredApiKeys = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		if (normalizedQuery.length === 0) {
			return trackable.apiKeys;
		}

		return trackable.apiKeys.filter((apiKey) =>
			[
				apiKey.name,
				apiKey.maskedKey,
				apiKey.status,
				apiKey.expiresAt ?? "",
				apiKey.lastUsedAt ?? "",
			]
				.join(" ")
				.toLowerCase()
				.includes(normalizedQuery),
		);
	}, [searchQuery, trackable.apiKeys]);

	return (
		<TrackablePageFrame
			title={gt("Connection")}
			description={gt(
				"Create, review, and revoke the connection keys that authorize log delivery for this trackable.",
			)}
		>
			{trackable.kind !== "api_ingestion" ? (
				<UnsupportedPageState
					title={gt("Connection unavailable")}
					description={gt("Only log trackables can manage connections.")}
				/>
			) : !trackable.permissions.canManageApiKeys ? (
				<UnsupportedPageState
					title={gt("Connection restricted")}
					description={gt(
						"You have view access to this trackable, but only editors can manage API keys.",
					)}
				/>
			) : (
				<>
					<ApiKeysTable
						data={filteredApiKeys}
						trackableId={trackable.id}
						trackableName={trackable.name}
					/>
				</>
			)}
		</TrackablePageFrame>
	);
}
