"use client";

import { useMemo } from "react";
import { ApiKeysTable } from "./api-keys-table";
import { useTrackableDetails } from "./trackable-shell";
import {
	TrackablePageFrame,
	TrackableNarrowContent,
	TrackableSectionHeader,
	UnsupportedPageState,
} from "./components/trackable-page-frame";
import { useGT } from "gt-next";

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
			eyebrow="Current trackable"
			title={gt("Connection")}
			description={gt("Create, review, and revoke the connection keys that authorize log delivery for this trackable.")}
		>
			{trackable.kind !== "api_ingestion" ? (
				<UnsupportedPageState
					title={gt("Connection unavailable")}
					description={gt("Only log trackables can manage connections.")}
				/>
			) : (
				<TrackableNarrowContent>
					<TrackableSectionHeader
						title={gt("Connection")}
						description={gt("Create and manage connection details used to send log events to this trackable.")}
					/>
					<ApiKeysTable
						data={filteredApiKeys}
						trackableId={trackable.id}
						trackableName={trackable.name}
					/>
				</TrackableNarrowContent>
			)}
		</TrackablePageFrame>
	);
}
