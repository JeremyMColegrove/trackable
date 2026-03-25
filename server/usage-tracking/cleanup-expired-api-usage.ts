import "server-only";

import type { db } from "@/db";
import { apiKeys, trackableApiUsageEvents, trackableItems } from "@/db/schema";
import { and, count, eq, inArray, lt, max } from "drizzle-orm";
import type { Logger } from "pino";

interface CleanupExpiredApiUsageInput {
	db: typeof db;
	logger: Logger;
	now?: Date;
}

interface CleanupExpiredApiUsageResult {
	scannedTrackables: number;
	affectedTrackables: number;
	deletedEvents: number;
	updatedApiKeys: number;
}

function getRetentionDays(
	settings: (typeof trackableItems.$inferSelect)["settings"],
) {
	const retention = settings?.apiLogRetentionDays;

	return typeof retention === "number" && retention > 0 ? retention : null;
}

function getRetentionCutoff(now: Date, retentionDays: number) {
	const cutoff = new Date(now);
	cutoff.setDate(cutoff.getDate() - retentionDays);
	return cutoff;
}

export async function cleanupExpiredApiUsage(
	input: CleanupExpiredApiUsageInput,
): Promise<CleanupExpiredApiUsageResult> {
	const database = input.db;
	const logger = input.logger;
	const now = input.now ?? new Date();

	const trackables = await database
		.select({
			id: trackableItems.id,
			name: trackableItems.name,
			settings: trackableItems.settings,
		})
		.from(trackableItems)
		.where(eq(trackableItems.kind, "api_ingestion"));

	let affectedTrackables = 0;
	let deletedEvents = 0;
	let updatedApiKeys = 0;

	for (const trackable of trackables) {
		const retentionDays = getRetentionDays(trackable.settings);

		if (!retentionDays) {
			continue;
		}

		const deletedRows = await database
			.delete(trackableApiUsageEvents)
			.where(
				and(
					eq(trackableApiUsageEvents.trackableId, trackable.id),
					lt(
						trackableApiUsageEvents.occurredAt,
						getRetentionCutoff(now, retentionDays),
					),
				),
			)
			.returning({
				id: trackableApiUsageEvents.id,
				apiKeyId: trackableApiUsageEvents.apiKeyId,
			});

		if (deletedRows.length === 0) {
			continue;
		}

		affectedTrackables += 1;
		deletedEvents += deletedRows.length;

		logger.info(
			{
				trackableId: trackable.id,
				trackableName: trackable.name,
				retentionDays,
				deletedEvents: deletedRows.length,
			},
			`Cleared ${deletedRows.length} expired API usage logs.`,
		);

		const [trackableTotals] = await database
			.select({
				usageCount: count(trackableApiUsageEvents.id),
				lastOccurredAt: max(trackableApiUsageEvents.occurredAt),
			})
			.from(trackableApiUsageEvents)
			.where(eq(trackableApiUsageEvents.trackableId, trackable.id));

		await database
			.update(trackableItems)
			.set({
				apiUsageCount: Number(trackableTotals?.usageCount) || 0,
				lastApiUsageAt: trackableTotals?.lastOccurredAt ?? null,
				updatedAt: now,
			})
			.where(eq(trackableItems.id, trackable.id));

		const affectedApiKeyIds = Array.from(
			new Set(deletedRows.map((row) => row.apiKeyId)),
		);

		const apiKeyTotals = affectedApiKeyIds.length
			? await database
					.select({
						apiKeyId: trackableApiUsageEvents.apiKeyId,
						usageCount: count(trackableApiUsageEvents.id),
						lastUsedAt: max(trackableApiUsageEvents.occurredAt),
					})
					.from(trackableApiUsageEvents)
					.where(inArray(trackableApiUsageEvents.apiKeyId, affectedApiKeyIds))
					.groupBy(trackableApiUsageEvents.apiKeyId)
			: [];

		const totalsByApiKeyId = new Map(
			apiKeyTotals.map((row) => [
				row.apiKeyId,
				{
					usageCount: Number(row.usageCount) || 0,
					lastUsedAt: row.lastUsedAt ?? null,
				},
			]),
		);

		for (const apiKeyId of affectedApiKeyIds) {
			const totals = totalsByApiKeyId.get(apiKeyId);

			await database
				.update(apiKeys)
				.set({
					usageCount: totals?.usageCount ?? 0,
					lastUsedAt: totals?.lastUsedAt ?? null,
					updatedAt: now,
				})
				.where(eq(apiKeys.id, apiKeyId));
		}

		updatedApiKeys += affectedApiKeyIds.length;
	}

	return {
		scannedTrackables: trackables.length,
		affectedTrackables,
		deletedEvents,
		updatedApiKeys,
	};
}
