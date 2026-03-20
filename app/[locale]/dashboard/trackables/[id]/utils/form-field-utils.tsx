import { CheckSquare, FileText, FormInput, Star } from "lucide-react";
import type { EditableTrackableFormField } from "@/lib/project-form-builder";

export type RatingConfig = Extract<
	EditableTrackableFormField["config"],
	{ kind: "rating" }
>;
export type CheckboxesConfig = Extract<
	EditableTrackableFormField["config"],
	{ kind: "checkboxes" }
>;
export type NotesConfig = Extract<
	EditableTrackableFormField["config"],
	{ kind: "notes" }
>;
export type ShortTextConfig = Extract<
	EditableTrackableFormField["config"],
	{ kind: "short_text" }
>;

export function isRatingField(
	field: EditableTrackableFormField,
): field is EditableTrackableFormField & { config: RatingConfig } {
	return field.config.kind === "rating";
}

export function isCheckboxesField(
	field: EditableTrackableFormField,
): field is EditableTrackableFormField & { config: CheckboxesConfig } {
	return field.config.kind === "checkboxes";
}

export function isNotesField(
	field: EditableTrackableFormField,
): field is EditableTrackableFormField & { config: NotesConfig } {
	return field.config.kind === "notes";
}

export function isShortTextField(
	field: EditableTrackableFormField,
): field is EditableTrackableFormField & { config: ShortTextConfig } {
	return field.config.kind === "short_text";
}

export function getFieldIcon(kind: EditableTrackableFormField["kind"]) {
	switch (kind) {
		case "rating":
			return <Star className="size-4" />;
		case "checkboxes":
			return <CheckSquare className="size-4" />;
		case "notes":
			return <FileText className="size-4" />;
		case "short_text":
			return <FormInput className="size-4" />;
	}
}

export const FIELD_TYPE_OPTIONS = [
	{ kind: "rating", label: "Quick Rating" },
	{ kind: "short_text", label: "Short Text" },
	{ kind: "notes", label: "Notes / Input" },
	{ kind: "checkboxes", label: "Checkbox" },
] as const;
