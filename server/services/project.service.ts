import { TRPCError } from "@trpc/server";
import { count, desc, eq, max } from "drizzle-orm";
import "server-only";

import { db } from "@/db";
import {
	apiKeys,
	trackableApiUsageEvents,
	trackableFormSubmissions,
	trackableForms,
	trackableItems,
} from "@/db/schema";
import type { TrackableKind, TrackableSettings } from "@/db/schema/types";
import { accessControlService } from "@/server/services/access-control.service";
import { quotaService } from "@/server/subscriptions/quota.service";

function generateSlug(name: string) {
	const baseSlug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)+/g, "");

	if (!baseSlug) {
		return `trackable-${Math.random().toString(36).substring(2, 8)}`;
	}

	const randomSuffix = Math.random().toString(36).substring(2, 6);
	return `${baseSlug}-${randomSuffix}`;
}

export function assertTrackableKind(
	kind: TrackableKind,
	expected: TrackableKind,
	message: string,
) {
	if (kind !== expected) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message,
		});
	}
}

export class ProjectService {
	async getById(projectId: string, userId: string) {
		await accessControlService.assertProjectAccess(projectId, userId, "view");

		let canManageTrackable = false;

		try {
			await accessControlService.assertProjectAccess(projectId, userId, "manage");
			canManageTrackable = true;
		} catch (error) {
			if (!(error instanceof TRPCError) || error.code !== "NOT_FOUND") {
				throw error;
			}
		}

		const project = await db.query.trackableItems.findFirst({
			where: eq(trackableItems.id, projectId),
			with: {
				activeForm: {
					with: {
						fields: true,
					},
				},
				accessGrants: {
					orderBy: (table, { desc }) => [desc(table.createdAt)],
					with: {
						subjectUser: {
							columns: {
								displayName: true,
								primaryEmail: true,
							},
						},
					},
				},
				shareLinks: {
					orderBy: (table, { desc }) => [desc(table.createdAt)],
				},
			},
		});

		if (!project) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Trackable not found.",
			});
		}

		const permissions = {
			canManageTrackable,
			canManageResponses: canManageTrackable && project.kind === "survey",
			canManageForm: canManageTrackable && project.kind === "survey",
			canManageSettings: canManageTrackable,
			canManageApiKeys:
				canManageTrackable && project.kind === "api_ingestion",
		};

		const [submissions, ownedApiKeys, usageCountsByKey] = await Promise.all([
			db.query.trackableFormSubmissions.findMany({
				where: eq(trackableFormSubmissions.trackableId, project.id),
				orderBy: [desc(trackableFormSubmissions.createdAt)],
				limit: 25,
				with: {
					submittedByUser: {
						columns: {
							displayName: true,
						},
					},
				},
			}),
			db.query.apiKeys.findMany({
				where: eq(apiKeys.projectId, project.id),
				orderBy: [desc(apiKeys.createdAt)],
			}),
			db
				.select({
					apiKeyId: trackableApiUsageEvents.apiKeyId,
					usageCount: count(trackableApiUsageEvents.id),
					lastOccurredAt: max(trackableApiUsageEvents.occurredAt),
				})
				.from(trackableApiUsageEvents)
				.where(eq(trackableApiUsageEvents.trackableId, project.id))
				.groupBy(trackableApiUsageEvents.apiKeyId),
		]);

		const usageByKey = new Map(
			usageCountsByKey.map((entry) => [
				entry.apiKeyId,
				{
					usageCount: Number(entry.usageCount) || 0,
					lastOccurredAt: entry.lastOccurredAt?.toISOString() ?? null,
				},
			]),
		);

		return {
			id: project.id,
			kind: project.kind,
			name: project.name,
			description: project.description,
			permissions,
			settings: project.settings,
			createdAt: project.createdAt.toISOString(),
			submissionCount: project.submissionCount,
			apiUsageCount: project.apiUsageCount,
			lastSubmissionAt: project.lastSubmissionAt?.toISOString() ?? null,
			lastApiUsageAt: project.lastApiUsageAt?.toISOString() ?? null,
			activeForm: project.activeForm
				? {
						id: project.activeForm.id,
						version: project.activeForm.version,
						title: project.activeForm.title,
						description: project.activeForm.description,
						status: project.activeForm.status,
						submitLabel: project.activeForm.submitLabel,
						successMessage: project.activeForm.successMessage,
						fields: [...project.activeForm.fields].sort(
							(left, right) => left.position - right.position,
						),
					}
				: null,
			recentSubmissions: submissions.map((submission) => ({
				id: submission.id,
				createdAt: submission.createdAt.toISOString(),
				source: submission.source,
				submitterLabel:
					submission.submittedByUser?.displayName ??
					submission.submittedEmail ??
					"Anonymous",
				metadata: submission.metadata,
				submissionSnapshot: submission.submissionSnapshot,
			})),
			apiKeys: permissions.canManageApiKeys
				? ownedApiKeys.map((key) => {
						const trackableUsage = usageByKey.get(key.id);

						return {
							id: key.id,
							name: key.name,
							maskedKey: `${key.keyPrefix}...${key.lastFour}`,
							status: key.status,
							expiresAt: key.expiresAt?.toISOString() ?? null,
							trackableUsageCount: trackableUsage?.usageCount ?? 0,
							lastUsedAt:
								trackableUsage?.lastOccurredAt ??
								key.lastUsedAt?.toISOString() ??
								null,
						};
					})
				: [],
			shareSettings: {
				accessGrants: permissions.canManageTrackable
					? project.accessGrants.map((grant) => ({
							id: grant.id,
							subjectType: grant.subjectType,
							subjectLabel:
								grant.subjectUser?.displayName ??
								grant.subjectUser?.primaryEmail ??
								grant.subjectEmail ??
								"Unknown recipient",
							subjectEmail:
								grant.subjectUser?.primaryEmail ?? grant.subjectEmail ?? null,
							role: grant.role,
							acceptedAt: grant.acceptedAt?.toISOString() ?? null,
							revokedAt: grant.revokedAt?.toISOString() ?? null,
							createdAt: grant.createdAt.toISOString(),
						}))
					: [],
				shareLinks: permissions.canManageTrackable
					? project.shareLinks.map((link) => ({
							id: link.id,
							token: link.token,
							role: link.role,
							createdAt: link.createdAt.toISOString(),
							expiresAt: link.expiresAt?.toISOString() ?? null,
							revokedAt: link.revokedAt?.toISOString() ?? null,
							lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
							usageCount: link.usageCount,
						}))
					: [],
			},
		};
	}

	async create(input: {
		kind: TrackableKind;
		name: string;
		description?: string;
		userId: string;
	}) {
		const activeWorkspace = await accessControlService.resolveActiveWorkspace(
			input.userId,
		);
		await quotaService.assertCanCreateTrackable(activeWorkspace.workspaceId);
		const slug = generateSlug(input.name);

		const [newTrackable] = await db.transaction(async (tx) => {
			const [createdTrackable] = await tx
				.insert(trackableItems)
				.values({
					workspaceId: activeWorkspace.workspaceId,
					kind: input.kind,
					name: input.name,
					description: input.description,
					slug,
				})
				.returning();

			if (input.kind === "survey") {
				const [createdForm] = await tx
					.insert(trackableForms)
					.values({
						trackableId: createdTrackable.id,
						version: 1,
						title: `${createdTrackable.name} feedback form`,
						description:
							createdTrackable.description ??
							"Fill out the form below and submit your response.",
						status: "draft",
						submitLabel: "Submit response",
						successMessage: "Thanks for your response.",
					})
					.returning();

				await tx
					.update(trackableItems)
					.set({
						activeFormId: createdForm.id,
					})
					.where(eq(trackableItems.id, createdTrackable.id));
			}

			return [createdTrackable];
		});

		return newTrackable;
	}

	async updateSettings(input: {
		trackableId: string;
		userId: string;
		name: string;
		description?: string;
		allowAnonymousSubmissions?: boolean;
		apiLogRetentionDays?: 3 | 7 | 30 | 90 | null;
	}) {
		const trackable = await accessControlService.assertProjectAccess(
			input.trackableId,
			input.userId,
			"manage",
		);

		const trackableRecord = await db.query.trackableItems.findFirst({
			where: eq(trackableItems.id, trackable.id),
			columns: {
				id: true,
				kind: true,
				settings: true,
			},
		});

		if (!trackableRecord) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Trackable not found.",
			});
		}

		const existingSettings = trackableRecord.settings || {};
		let nextSettings: TrackableSettings;

		if (trackableRecord.kind === "survey") {
			nextSettings = {
				...existingSettings,
				allowAnonymousSubmissions: input.allowAnonymousSubmissions ?? true,
			};
		} else {
			const tierRetention = await quotaService.getEffectiveLogRetentionDays(
				trackable.workspaceId,
			);
			let retention = input.apiLogRetentionDays ?? null;

			if (
				tierRetention !== null &&
				(retention === null || retention > tierRetention)
			) {
				retention = tierRetention as 3 | 7 | 30 | 90;
			}

			nextSettings = {
				...existingSettings,
				apiLogRetentionDays: retention,
			};
		}

		const [updated] = await db
			.update(trackableItems)
			.set({
				name: input.name,
				description: input.description,
				settings: nextSettings,
			})
			.where(eq(trackableItems.id, trackableRecord.id))
			.returning();

		return updated;
	}
}

export const projectService = new ProjectService();
