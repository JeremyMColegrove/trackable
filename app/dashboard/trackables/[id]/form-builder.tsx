"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowUp,
	CheckSquare,
	Edit3,
	Eye,
	FileText,
	FormInput,
	Plus,
	Star,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TrackableFormSnapshot } from "@/db/schema/types";
import {
	createCheckboxOption,
	createDefaultEditableField,
	createDefaultEditableForm,
	createFieldKey,
	createOptionValue,
	type EditableTrackableForm,
	type EditableTrackableFormField,
	editableTrackableFormSchema,
	formSnapshotToEditableForm,
	normalizeEditableForm,
} from "@/lib/project-form-builder";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

import { formatFieldConfigSummary, formatFieldKind } from "./display-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

type RatingConfig = Extract<
	EditableTrackableFormField["config"],
	{ kind: "rating" }
>;
type CheckboxesConfig = Extract<
	EditableTrackableFormField["config"],
	{ kind: "checkboxes" }
>;
type NotesConfig = Extract<
	EditableTrackableFormField["config"],
	{ kind: "notes" }
>;
type ShortTextConfig = Extract<
	EditableTrackableFormField["config"],
	{ kind: "short_text" }
>;

function isRatingField(
	field: EditableTrackableFormField,
): field is EditableTrackableFormField & { config: RatingConfig } {
	return field.config.kind === "rating";
}

function isCheckboxesField(
	field: EditableTrackableFormField,
): field is EditableTrackableFormField & { config: CheckboxesConfig } {
	return field.config.kind === "checkboxes";
}

function isNotesField(
	field: EditableTrackableFormField,
): field is EditableTrackableFormField & { config: NotesConfig } {
	return field.config.kind === "notes";
}

function isShortTextField(
	field: EditableTrackableFormField,
): field is EditableTrackableFormField & { config: ShortTextConfig } {
	return field.config.kind === "short_text";
}

function getFieldIcon(kind: EditableTrackableFormField["kind"]) {
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

function PreviewDialog({ draft }: { draft: EditableTrackableForm }) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline" type="button">
					<Eye className="size-4" />
					Preview
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{draft.title}</DialogTitle>
					<DialogDescription>
						Preview the current form draft before saving a new version.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-5">
					{draft.fields.length === 0 ? (
						<div className="rounded-lg border border-dashed bg-muted/50 p-8 text-center text-sm text-muted-foreground">
							This form does not have any fields yet.
						</div>
					) : (
						draft.fields.map((field) => (
							<Card
								key={field.id}
								className="p-4 shadow-none"
							>
								<div className="mb-3 flex items-start justify-between gap-4">
									<div>
										<p className="font-medium">{field.label}</p>
										{field.description ? (
											<p className="text-sm text-muted-foreground">
												{field.description}
											</p>
										) : null}
									</div>
									<Badge variant="outline">{formatFieldKind(field.kind)}</Badge>
								</div>
								{isRatingField(field) ? (
									<div className="flex gap-2">
										{Array.from({ length: field.config.scale }).map(
											(_, index) => (
												<button
													key={index}
													type="button"
													disabled
													className="rounded-full border border-border p-2 text-muted-foreground"
												>
													<Star className="size-4" />
												</button>
											),
										)}
									</div>
								) : null}
								{isCheckboxesField(field) ? (
									<div className="space-y-2">
										{field.config.options.map((option) => (
											<label
												key={option.id}
												className="flex items-center gap-3 text-sm"
											>
												<Checkbox disabled />
												<span>{option.label}</span>
											</label>
										))}
										{field.config.allowOther ? (
											<label className="flex items-center gap-3 text-sm">
												<Checkbox disabled />
												<span>Other</span>
											</label>
										) : null}
									</div>
								) : null}
								{isNotesField(field) ? (
									<Textarea
										disabled
										placeholder={
											field.config.placeholder ?? "Write your response..."
										}
										className="min-h-24 resize-none"
									/>
								) : null}
								{isShortTextField(field) ? (
									<Input
										disabled
										placeholder={
											field.config.placeholder ?? "Type your answer..."
										}
									/>
								) : null}
							</Card>
						))
					)}
					<Button disabled type="button">
						{draft.submitLabel ?? "Submit response"}
					</Button>
					{draft.successMessage ? (
						<p className="text-sm text-muted-foreground">
							{draft.successMessage}
						</p>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function FormSettingsDialog({
	draft,
	onChange,
}: {
	draft: EditableTrackableForm;
	onChange: (nextDraft: EditableTrackableForm) => void;
}) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button type="button" variant="outline">
					<Edit3 className="size-3.5" />
					Edit
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Edit form settings</DialogTitle>
				</DialogHeader>

				<div className="grid gap-4">
					<div className="space-y-2">
						<Label>Form title</Label>
						<p className="text-xs text-muted-foreground">
							The heading shown at the top of the form.
						</p>
						<Input
							value={draft.title}
							placeholder="Form title"
							onChange={(event) =>
								onChange({
									...draft,
									title: event.target.value,
								})
							}
						/>
					</div>
					<div className="space-y-2">
						<Label>Submit button label</Label>
						<p className="text-xs text-muted-foreground">
							The text people click to send their response.
						</p>
						<Input
							value={draft.submitLabel ?? ""}
							placeholder="Submit button label"
							onChange={(event) =>
								onChange({
									...draft,
									submitLabel: event.target.value,
								})
							}
						/>
					</div>
					<div className="space-y-2">
						<Label>Success message</Label>
						<p className="text-xs text-muted-foreground">
							The confirmation message shown after submission.
						</p>
						<Textarea
							value={draft.successMessage ?? ""}
							placeholder="Success message"
							onChange={(event) =>
								onChange({
									...draft,
									successMessage: event.target.value,
								})
							}
							className="min-h-24 resize-none"
						/>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function FieldPreview({
	field,
	index,
	total,
	onChange,
	onMove,
	onRemove,
}: {
	field: EditableTrackableFormField;
	index: number;
	total: number;
	onChange: (nextField: EditableTrackableFormField) => void;
	onMove: (index: number, direction: -1 | 1) => void;
	onRemove: (index: number) => void;
}) {
	return (
		<Card className="p-4 shadow-sm">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1">
					<label className="block text-sm font-medium">
						{field.label || "Untitled field"}
					</label>
					{field.description ? (
						<p className="line-clamp-2 text-xs text-muted-foreground">
							{field.description}
						</p>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="capitalize">
						{formatFieldKind(field.kind)}
					</Badge>
					<Dialog>
						<DialogTrigger asChild>
							<Button type="button" size="sm" variant="outline">
								<Edit3 className="size-3.5" />
								Edit
							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
							<DialogHeader>
								<DialogTitle>Edit field</DialogTitle>
							</DialogHeader>

							<div className="grid gap-3">
								<div className="space-y-2">
									<Label>Field label</Label>
									<p className="text-xs text-muted-foreground">
										The question or prompt shown to the responder.
									</p>
									<Input
										value={field.label}
										placeholder="Field label"
										onChange={(event) =>
											onChange({ ...field, label: event.target.value })
										}
									/>
								</div>
								<div className="space-y-2">
									<Label>Description</Label>
									<p className="text-xs text-muted-foreground">
										Optional helper text shown under the field.
									</p>
									<Textarea
										value={field.description ?? ""}
										placeholder="Description"
										onChange={(event) =>
											onChange({
												...field,
												description: event.target.value || null,
											})
										}
										className="min-h-20 resize-none"
									/>
								</div>
								<div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
									<div className="space-y-0.5">
										<Label>Required</Label>
										<p className="text-xs text-muted-foreground">
											Require a response before the form can be submitted.
										</p>
									</div>
									<Switch
										checked={field.required}
										onCheckedChange={(checked) =>
											onChange({ ...field, required: checked })
										}
									/>
								</div>

								{isRatingField(field) ? (
									<div className="space-y-2">
										<Label>Rating scale</Label>
										<p className="text-xs text-muted-foreground">
											How many points are available in the rating.
										</p>
										<Input
											type="number"
											min={3}
											max={10}
											value={field.config.scale}
											placeholder="Scale"
											onChange={(event) =>
												onChange({
													...field,
													config: {
														...field.config,
														scale: Number(event.target.value) || 3,
													},
												})
											}
										/>
									</div>
								) : null}

								{isNotesField(field) || isShortTextField(field) ? (
									<div className="space-y-2">
										<Label>Placeholder</Label>
										<p className="text-xs text-muted-foreground">
											Optional example text shown inside the field.
										</p>
										<Input
											value={field.config.placeholder ?? ""}
											placeholder="Placeholder"
											onChange={(event) =>
												onChange({
													...field,
													config: {
														...field.config,
														placeholder: event.target.value,
													},
												})
											}
										/>
									</div>
								) : null}

								{isCheckboxesField(field) ? (
									<div className="space-y-2">
										<div className="space-y-1">
											<Label>Options</Label>
											<p className="text-xs text-muted-foreground">
												Add the choices people can select for this field.
											</p>
										</div>
										{field.config.options.map((option, optionIndex) => (
											<div
												key={option.id}
												className="grid gap-2 md:grid-cols-[1fr_auto]"
											>
												<Input
													value={option.label}
													placeholder={`Option ${optionIndex + 1}`}
													onChange={(event) => {
														const nextOptions = [...field.config.options];
														const nextLabel = event.target.value;

														nextOptions[optionIndex] = {
															...nextOptions[optionIndex],
															label: nextLabel,
															value: createOptionValue(nextLabel),
														};

														onChange({
															...field,
															config: {
																...field.config,
																options: nextOptions,
															},
														});
													}}
												/>
												<Button
													type="button"
													variant="destructive"
													size="icon-sm"
													onClick={() => {
														const nextOptions = field.config.options.filter(
															(_, indexToKeep) => indexToKeep !== optionIndex,
														);

														onChange({
															...field,
															config: {
																...field.config,
																options:
																	nextOptions.length > 0
																		? nextOptions
																		: [createCheckboxOption("Option 1")],
															},
														});
													}}
												>
													<Trash2 className="size-4" />
												</Button>
											</div>
										))}
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												onChange({
													...field,
													config: {
														...field.config,
														options: [
															...field.config.options,
															createCheckboxOption(
																`Option ${field.config.options.length + 1}`,
															),
														],
													},
												})
											}
										>
											<Plus className="size-4" />
											Add option
										</Button>
									</div>
								) : null}
							</div>
						</DialogContent>
					</Dialog>
					<Button
						type="button"
						size="icon-sm"
						variant="outline"
						onClick={() => onMove(index, -1)}
						disabled={index === 0}
					>
						<ArrowUp className="size-4" />
					</Button>
					<Button
						type="button"
						size="icon-sm"
						variant="outline"
						onClick={() => onMove(index, 1)}
						disabled={index === total - 1}
					>
						<ArrowDown className="size-4" />
					</Button>
					<Button
						type="button"
						size="icon-sm"
						variant="destructive"
						onClick={() => onRemove(index)}
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			</div>

			<div className="mt-4 rounded-md border border-dashed bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
				{formatFieldConfigSummary(field.config)}
				{field.required ? " · Required" : " · Optional"}
			</div>

			{isRatingField(field) ? (
				<div className="mt-3 flex gap-1.5">
					{Array.from({ length: field.config.scale }).map((_, indexValue) => (
						<div
							key={indexValue}
							className="rounded-full border border-border p-1.5 text-muted-foreground"
						>
							<Star className="size-3.5" />
						</div>
					))}
				</div>
			) : null}

			{isCheckboxesField(field) ? (
				<div className="mt-3 space-y-1.5">
					{field.config.options.slice(0, 3).map((option) => (
						<label
							key={option.id}
							className="flex items-center gap-2.5 text-xs"
						>
							<Checkbox disabled />
							<span>{option.label}</span>
						</label>
					))}
					{field.config.options.length > 3 ? (
						<p className="text-xs text-muted-foreground">
							+{field.config.options.length - 3} more options
						</p>
					) : null}
				</div>
			) : null}

			{isNotesField(field) ? (
				<Textarea
					disabled
					className="mt-3 min-h-16 resize-none text-sm"
					placeholder={field.config.placeholder ?? "Write your response..."}
				/>
			) : null}

			{isShortTextField(field) ? (
				<Input
					disabled
					className="mt-3 text-sm"
					placeholder={field.config.placeholder ?? "Type your answer..."}
				/>
			) : null}
		</Card>
	);
}

export function FormBuilder({
	trackableId,
	trackableName,
	activeForm,
}: {
	trackableId: string;
	trackableName: string;
	activeForm: TrackableFormSnapshot | null;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [saveError, setSaveError] = useState<string | null>(null);
	const [draft, setDraft] = useState<EditableTrackableForm>(() =>
		activeForm
			? formSnapshotToEditableForm(activeForm)
			: createDefaultEditableForm(trackableName),
	);

	const saveForm = useMutation(
		trpc.trackables.saveForm.mutationOptions({
			onSuccess: async () => {
				setSaveError(null);
				await queryClient.invalidateQueries({
					queryKey: trpc.trackables.getById.queryKey({ id: trackableId }),
				});
			},
			onError: (error) => {
				setSaveError(error.message);
			},
		}),
	);

	const normalizedDraft = useMemo(() => normalizeEditableForm(draft), [draft]);
	const initialDraft = useMemo(
		() =>
			activeForm
				? normalizeEditableForm(formSnapshotToEditableForm(activeForm))
				: normalizeEditableForm(createDefaultEditableForm(trackableName)),
		[activeForm, trackableName],
	);
	const validationResult = useMemo(
		() => editableTrackableFormSchema.safeParse(normalizedDraft),
		[normalizedDraft],
	);
	const isDirty =
		JSON.stringify(normalizedDraft) !== JSON.stringify(initialDraft);

	function addField(kind: EditableTrackableFormField["kind"]) {
		setDraft((currentDraft) => ({
			...currentDraft,
			fields: [
				...currentDraft.fields,
				createDefaultEditableField(kind, currentDraft.fields.length),
			].map((field, index) => ({
				...field,
				key:
					field.key === createFieldKey(field.kind, field.position)
						? createFieldKey(field.kind, index)
						: field.key,
				position: index,
			})),
		}));
	}

	function updateField(index: number, nextField: EditableTrackableFormField) {
		setDraft((currentDraft) => ({
			...currentDraft,
			fields: currentDraft.fields.map((field, fieldIndex) =>
				fieldIndex === index ? { ...nextField, position: index } : field,
			),
		}));
	}

	function moveField(index: number, direction: -1 | 1) {
		setDraft((currentDraft) => {
			const nextIndex = index + direction;

			if (nextIndex < 0 || nextIndex >= currentDraft.fields.length) {
				return currentDraft;
			}

			const nextFields = [...currentDraft.fields];
			const [field] = nextFields.splice(index, 1);
			nextFields.splice(nextIndex, 0, field);

			return {
				...currentDraft,
				fields: nextFields.map((entry, entryIndex) => ({
					...entry,
					position: entryIndex,
				})),
			};
		});
	}

	function removeField(index: number) {
		setDraft((currentDraft) => ({
			...currentDraft,
			fields: currentDraft.fields
				.filter((_, fieldIndex) => fieldIndex !== index)
				.map((field, fieldIndex) => ({
					...field,
					position: fieldIndex,
				})),
		}));
	}

	function resetDraft() {
		setDraft(
			activeForm
				? formSnapshotToEditableForm(activeForm)
				: createDefaultEditableForm(trackableName),
		);
		setSaveError(null);
	}

	function handleSave() {
		const result = editableTrackableFormSchema.safeParse(normalizedDraft);

		if (!result.success) {
			setSaveError(
				result.error.issues[0]?.message ?? "Unable to save the form.",
			);
			return;
		}

		saveForm.mutate({
			trackableId,
			form: result.data,
		});
	}

	const validationMessage = saveError
		? saveError
		: validationResult.success
			? isDirty
				? "Unsaved changes ready for the next version."
				: "No unpublished changes."
			: validationResult.error.issues[0]?.message;

	return (
		<Card className="shadow-sm">
			<CardHeader className="flex flex-row items-center justify-between border-b pb-4">
				<div>
					<CardTitle className="text-lg">{draft.title}</CardTitle>
					<CardDescription>
						{activeForm
							? `Version ${activeForm.version}`
							: "Draft form ready to configure."}
					</CardDescription>
				</div>
				<div className="flex items-center gap-2">
					<div
						className={cn(
							"mr-2 hidden text-sm sm:block",
							saveError || !validationResult.success
								? "font-medium text-destructive"
								: "text-muted-foreground",
						)}
					>
						{validationMessage}
					</div>
					<PreviewDialog draft={normalizedDraft} />
					<FormSettingsDialog
						draft={draft}
						onChange={(nextDraft) => setDraft(nextDraft)}
					/>
					<Button
						type="button"
						variant="outline"
						onClick={resetDraft}
						disabled={!isDirty || saveForm.isPending}
					>
						Reset
					</Button>
					<Button
						type="button"
						onClick={handleSave}
						disabled={!isDirty || saveForm.isPending}
					>
						{saveForm.isPending ? "Saving..." : "Save changes"}
					</Button>
				</div>
			</CardHeader>

			<div className="p-0">
				<div className="grid grid-cols-1 divide-y md:grid-cols-4 md:divide-x md:divide-y-0">
					<div className="space-y-4 bg-muted/20 p-6">
						<div className="space-y-2">
							<h3 className="text-sm font-medium text-muted-foreground">
								Available Fields
							</h3>
							{(
								[
									{ kind: "rating", label: "Quick Rating" },
									{ kind: "short_text", label: "Short Text" },
									{ kind: "notes", label: "Notes / Input" },
									{ kind: "checkboxes", label: "Checkbox" },
								] as const
							).map((entry) => (
								<button
									key={entry.kind}
									type="button"
									onClick={() => addField(entry.kind)}
									className="flex w-full items-center gap-2 rounded-lg border bg-background p-3 text-sm shadow-sm transition-colors hover:bg-muted/50"
								>
									{getFieldIcon(entry.kind)}
									{entry.label}
								</button>
							))}
						</div>
					</div>

					<div className="col-span-1 space-y-6 bg-muted/5 p-6 md:col-span-3 md:p-8">
						<div className="mx-auto max-w-2xl space-y-4">
							{draft.fields.length === 0 ? (
								<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center text-sm text-muted-foreground">
									No form fields yet. Add a field from the palette on the left.
								</div>
							) : (
								draft.fields.map((field, index) => (
									<FieldPreview
										key={field.id}
										field={field}
										index={index}
										total={draft.fields.length}
										onChange={(nextField) => updateField(index, nextField)}
										onMove={moveField}
										onRemove={removeField}
									/>
								))
							)}
						</div>
					</div>
				</div>
			</div>
		</Card>
	);
}
