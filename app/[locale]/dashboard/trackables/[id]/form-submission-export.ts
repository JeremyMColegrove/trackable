import type {
  FormAnswerValue,
  TrackableFormFieldSnapshot,
} from "@/db/schema/types"
import type { TableExportPayload } from "@/lib/table-export"

import { formatDateTime } from "./display-utils"
import type { SubmissionRow } from "./table-types"

type VersionedFieldColumn = {
  id: string
  label: string
  signature: string
  key: string
  version: number
  position: number
  firstSeenAt: number
}

export function buildFormSubmissionExportPayload({
  fileName,
  submissions,
}: {
  fileName: string
  submissions: SubmissionRow[]
}): TableExportPayload {
  const columns: VersionedFieldColumn[] = []
  const columnsById = new Map<string, VersionedFieldColumn>()

  for (const [submissionIndex, submission] of submissions.entries()) {
    for (const field of getOrderedFields(submission)) {
      const signature = getFieldSignature(field)
      const columnId = `${field.key}:${signature}`

      if (columnsById.has(columnId)) {
        continue
      }

      const column = {
        id: columnId,
        label: field.label,
        signature,
        key: field.key,
        version: submission.submissionSnapshot.form.version,
        position: field.position,
        firstSeenAt: submissionIndex,
      }

      columnsById.set(columnId, column)
      columns.push(column)
    }
  }

  const keyOrder = new Map<
    string,
    { position: number; firstSeenAt: number }
  >()

  for (const column of columns) {
    const existing = keyOrder.get(column.key)

    if (
      !existing ||
      column.position < existing.position ||
      (column.position === existing.position &&
        column.firstSeenAt < existing.firstSeenAt)
    ) {
      keyOrder.set(column.key, {
        position: column.position,
        firstSeenAt: column.firstSeenAt,
      })
    }
  }

  columns.sort((left, right) => {
    const leftOrder = keyOrder.get(left.key)
    const rightOrder = keyOrder.get(right.key)

    if (leftOrder && rightOrder) {
      if (leftOrder.position !== rightOrder.position) {
        return leftOrder.position - rightOrder.position
      }

      if (leftOrder.firstSeenAt !== rightOrder.firstSeenAt) {
        return leftOrder.firstSeenAt - rightOrder.firstSeenAt
      }
    }

    if (left.key !== right.key) {
      return left.key.localeCompare(right.key)
    }

    if (left.version !== right.version) {
      return left.version - right.version
    }

    return left.label.localeCompare(right.label)
  })

  const versionCountByKey = new Map<string, number>()

  for (const column of columns) {
    versionCountByKey.set(
      column.key,
      (versionCountByKey.get(column.key) ?? 0) + 1
    )
  }

  return {
    fileName,
    columns: [
      { id: "submittedAt", label: "Submitted At" },
      { id: "submittedBy", label: "Submitted By" },
      ...columns.map((column) => ({
        id: column.id,
        label:
          (versionCountByKey.get(column.key) ?? 0) > 1
            ? `${column.label} (v${column.version})`
            : column.label,
      })),
    ],
    rows: submissions.map((submission) => {
      const valuesByColumnId = new Map<string, string>()

      for (const field of getOrderedFields(submission)) {
        const answer = submission.submissionSnapshot.answers.find(
          (entry) => entry.fieldId === field.id
        )
        const signature = getFieldSignature(field)

        valuesByColumnId.set(
          `${field.key}:${signature}`,
          formatExportAnswerValue(answer?.value)
        )
      }

      return {
        values: [
          formatDateTime(submission.createdAt),
          submission.submitterLabel,
          ...columns.map((column) => valuesByColumnId.get(column.id) ?? ""),
        ],
      }
    }),
  }
}

function getOrderedFields(submission: SubmissionRow) {
  return [...submission.submissionSnapshot.form.fields].sort(
    (left, right) => left.position - right.position
  )
}

function getFieldSignature(field: TrackableFormFieldSnapshot) {
  return JSON.stringify({
    kind: field.kind,
    label: field.label,
    description: field.description,
    required: field.required,
    config: field.config,
  })
}

function formatExportAnswerValue(value: FormAnswerValue | undefined) {
  if (!value) {
    return ""
  }

  switch (value.kind) {
    case "rating":
      return String(value.value)
    case "checkboxes":
      return value.value.join(", ")
    case "notes":
      return value.value.trim()
    case "short_text":
      return value.value.trim()
    default:
      return ""
  }
}
