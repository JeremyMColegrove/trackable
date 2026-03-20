/** biome-ignore-all lint/correctness/useUniqueElementIds: <explanation> */
"use client";

import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { TrackableFormSnapshot } from "@/db/schema/types";
import {
	createDefaultEditableField,
	createDefaultEditableForm,
	createFieldKey,
	type EditableTrackableForm,
	type EditableTrackableFormField,
	editableTrackableFormSchema,
	formSnapshotToEditableForm,
	normalizeEditableForm,
} from "@/lib/project-form-builder";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FieldPreview } from "./components/field-preview";
import { FIELD_TYPE_OPTIONS, getFieldIcon } from "./utils/form-field-utils";
import { T, useGT } from "gt-next";

export function FormBuilder({
	trackableId,
	trackableName,
	trackableDescription,
	activeForm,
}: {
	trackableId: string;
	trackableName: string;
	trackableDescription: string | null;
	activeForm: TrackableFormSnapshot | null;
}) {
    const gt = useGT();
	const addFieldTriggerRef = useRef<HTMLButtonElement | null>(null);
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState<EditableTrackableForm>(() =>
		activeForm
			? formSnapshotToEditableForm(activeForm)
			: createDefaultEditableForm(trackableName),
	);

	const saveForm = useMutation(
		trpc.trackables.saveForm.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.trackables.getById.queryKey({ id: trackableId }),
				});
			},
			onError: (error) => {
				toast.error(error.message);
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
	}

	function handleSave() {
		const result = editableTrackableFormSchema.safeParse(normalizedDraft);

		if (!result.success) {
			toast.error(
				result.error.issues[0]?.message ?? "Unable to save the form.",
			);
			return;
		}

		saveForm.mutate({
			trackableId,
			form: result.data,
		});
	}

	const validationMessage = validationResult.success
		? isDirty
			? "Unsaved changes ready for the next version."
			: "No unpublished changes."
		: "Resolve validation issues before saving.";

	return (
		<div className="flex flex-col gap-6">
			<div className="mx-auto flex w-full max-w-4xl items-center justify-end gap-2">
				<div className="mr-auto">
					<div
						className={cn(
							"hidden text-sm sm:block",
							!validationResult.success
								? "font-medium text-destructive"
								: "text-muted-foreground",
						)}
					>
						{validationMessage}
					</div>
				</div>
				<Button
					type="button"
					variant="outline"
					onClick={resetDraft}
					disabled={!isDirty || saveForm.isPending}
				>
					
                    					<T>Reset</T>
                    				</Button>
				<Button
					type="button"
					onClick={handleSave}
					disabled={!isDirty || saveForm.isPending}
				>
					{saveForm.isPending ? "Saving..." : "Save changes"}
				</Button>
			</div>

			<div className="mx-auto w-full max-w-4xl">
				<div className="flex flex-col gap-8">
					<div className="flex flex-col gap-2">
						<Label
							htmlFor="form-title"
							className="text-xs uppercase tracking-wide text-muted-foreground"
						>
							
                            							<T>Form title</T>
                            						</Label>
						<Input
							id="form-title"
							value={draft.title}
							placeholder={gt("Form title")}
							onChange={(event) =>
								setDraft((currentDraft) => ({
									...currentDraft,
									title: event.target.value,
								}))
							}
						/>
						<Textarea
							value={draft.description ?? ""}
							placeholder={gt("Your form description...")}
							onChange={(event) =>
								setDraft((currentDraft) => ({
									...currentDraft,
									description: event.target.value,
								}))
							}
							rows={2}
						/>
					</div>

					{draft.fields.length > 0
						? draft.fields.map((field, index) => (
								<div key={field.id} className="flex flex-col gap-8">
									<FieldPreview
										field={field}
										index={index}
										total={draft.fields.length}
										onChange={(nextField) => updateField(index, nextField)}
										onMove={moveField}
										onRemove={removeField}
									/>
									{index < draft.fields.length - 1 ? (
										<div className="border-b border-border/50" />
									) : null}
								</div>
							))
						: null}

					<Separator />

					<ContextMenu>
						<ContextMenuTrigger asChild>
							<button
								ref={addFieldTriggerRef}
								type="button"
								className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/50 px-4 py-5 text-sm text-muted-foreground transition-colors hover:bg-muted"
								onClick={(event) => {
									event.preventDefault();
									addFieldTriggerRef.current?.dispatchEvent(
										new MouseEvent("contextmenu", {
											bubbles: true,
											cancelable: true,
											clientX: event.clientX,
											clientY: event.clientY,
											view: window,
										}),
									);
								}}
							>
								<Plus className="size-4" />
								<span><T>Click to add new form field</T></span>
							</button>
						</ContextMenuTrigger>
						<ContextMenuContent>
							<ContextMenuGroup>
								{FIELD_TYPE_OPTIONS.map((entry) => (
									<ContextMenuItem
										key={entry.kind}
										onClick={() => addField(entry.kind)}
									>
										{getFieldIcon(entry.kind)}
										<span>{entry.label}</span>
									</ContextMenuItem>
								))}
							</ContextMenuGroup>
						</ContextMenuContent>
					</ContextMenu>

					<Button disabled type="button" className="self-start">
						{draft.submitLabel ?? "Submit response"}
					</Button>
					{draft.successMessage ? (
						<p className="text-sm text-muted-foreground">
							{draft.successMessage}
						</p>
					) : null}
				</div>
			</div>
		</div>
	);
}
