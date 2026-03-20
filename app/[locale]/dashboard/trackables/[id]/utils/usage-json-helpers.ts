import type { UsageEventRow } from "../table-types";
import { formatUsageFieldLabel } from "../display-utils";

export function buildSimilarLogsQuery(
	usageEvent: UsageEventRow,
	metadata: Record<string, unknown>,
) {
	const parts: string[] = [];

	if (usageEvent.event?.trim()) {
		parts.push(`event:${quoteLiqeString(usageEvent.event.trim())}`);
	}

	if (usageEvent.level) {
		parts.push(`level:${quoteLiqeString(usageEvent.level)}`);
	}

	const route = metadata.route ?? metadata.path;
	if (typeof route === "string" && route.trim()) {
		parts.push(`route:${quoteLiqeString(route.trim())}`);
	}

	return parts.length > 0 ? parts.join(" ") : null;
}

export function getSourceLabel(usageEvent: UsageEventRow) {
	if (usageEvent.apiKey?.name?.trim()) {
		return usageEvent.apiKey.name.trim();
	}

	if (usageEvent.apiKeyCount > 1) {
		return `${usageEvent.apiKeyCount} API keys`;
	}

	if (usageEvent.aggregation === "payload_field" && usageEvent.groupField) {
		return `Grouped by ${formatUsageFieldLabel(usageEvent.groupField)}`;
	}

	return "Unknown source";
}

export function parseMetadata(metadata: string | null) {
	if (!metadata) {
		return {};
	}

	try {
		const parsed = JSON.parse(metadata) as unknown;
		return isPlainObject(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

export function buildGroupFilterQuery(field: string, value: unknown) {
	if (value === null || value === undefined) {
		return `-${field}:*`;
	}

	if (typeof value === "string") {
		const normalizedValue = value.trim();

		if (!normalizedValue) {
			return `${field}:""`;
		}

		return `${field}:${quoteLiqeString(normalizedValue)}`;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return `${field}:${String(value)}`;
	}

	return `${field}:${quoteLiqeString(JSON.stringify(value))}`;
}

export function quoteLiqeString(value: string) {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function formatPayloadJson(value: unknown) {
	return formatJsonValue(value, 0);
}

function formatJsonValue(value: unknown, depth: number): string {
	if (Array.isArray(value)) {
		return formatJsonArray(value, depth);
	}

	if (isPlainObject(value)) {
		return formatJsonObject(value, depth);
	}

	return JSON.stringify(value);
}

function formatJsonArray(value: unknown[], depth: number) {
	if (value.length === 0) {
		return "[]";
	}

	const inlineValues = value.map((item) =>
		isInlineJsonValue(item) ? JSON.stringify(item) : null,
	);
	const canInline =
		inlineValues.every((item) => item !== null) &&
		`[${inlineValues.join(", ")}]`.length <= 80;

	if (canInline) {
		return `[ ${inlineValues.join(", ")} ]`;
	}

	const indent = "  ".repeat(depth);
	const nextIndent = "  ".repeat(depth + 1);
	const lines = value.map(
		(item) => `${nextIndent}${formatJsonValue(item, depth + 1)}`,
	);

	return `[\n${lines.join(",\n")}\n${indent}]`;
}

function formatJsonObject(value: Record<string, unknown>, depth: number) {
	const entries = Object.entries(value);

	if (entries.length === 0) {
		return "{}";
	}

	const indent = "  ".repeat(depth);
	const nextIndent = "  ".repeat(depth + 1);
	const lines = entries.map(
		([key, entryValue]) =>
			`${nextIndent}${JSON.stringify(key)}: ${formatJsonValue(entryValue, depth + 1)}`,
	);

	return `{\n${lines.join(",\n")}\n${indent}}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInlineJsonValue(value: unknown) {
	return (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	);
}

export function tokenizeJson(json: string) {
	const tokens: Array<{ value: string; className?: string }> = [];
	let index = 0;

	while (index < json.length) {
		const char = json[index];

		if (char === '"') {
			let endIndex = index + 1;
			let isEscaped = false;

			while (endIndex < json.length) {
				const currentChar = json[endIndex];
				if (currentChar === '"' && !isEscaped) {
					break;
				}
				isEscaped = currentChar === "\\" ? !isEscaped : false;
				endIndex += 1;
			}

			const value = json.slice(index, endIndex + 1);
			const remainder = json.slice(endIndex + 1);
			const className = /^\s*:/.test(remainder)
				? "text-sky-700 dark:text-sky-300"
				: "text-emerald-700 dark:text-emerald-300";

			tokens.push({ value, className });
			index = endIndex + 1;
			continue;
		}

		const literalMatch = /^(true|false|null)\b/.exec(json.slice(index));
		if (literalMatch) {
			tokens.push({
				value: literalMatch[0],
				className: "text-violet-700 dark:text-violet-300",
			});
			index += literalMatch[0].length;
			continue;
		}

		const numberMatch = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(json.slice(index));
		if (numberMatch) {
			tokens.push({
				value: numberMatch[0],
				className: "text-amber-700 dark:text-amber-300",
			});
			index += numberMatch[0].length;
			continue;
		}

		tokens.push({ value: char, className: "text-foreground/80" });
		index += 1;
	}

	return tokens;
}
