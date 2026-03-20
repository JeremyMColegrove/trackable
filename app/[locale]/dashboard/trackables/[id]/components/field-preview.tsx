import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	createCheckboxOption,
	createOptionValue,
	type EditableTrackableFormField,
} from "@/lib/project-form-builder";
import { ArrowDown, ArrowUp, Edit3, Plus, Star, Trash2 } from "lucide-react";
import { formatFieldKind } from "../display-utils";
import {
	isCheckboxesField,
	isNotesField,
	isRatingField,
	isShortTextField,
} from "../utils/form-field-utils";
import { T, useGT } from "gt-next";

export function FieldPreview({
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
    const gt = useGT();
	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<label className="block text-lg font-medium">
							{field.label || "Untitled field"}
						</label>
						<Badge variant="outline" className="rounded-full">
							{field.required ? "Required" : formatFieldKind(field.kind)}
						</Badge>
					</div>
					{field.description ? (
						<p className="text-sm text-muted-foreground">{field.description}</p>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					<Dialog>
						<DialogTrigger asChild>
							<Button type="button" size="sm" variant="outline">
								<Edit3 className="size-3.5" />
								
                                								<T>Edit</T>
                                							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
							<DialogHeader>
								<DialogTitle><T>Field</T></DialogTitle>
							</DialogHeader>

							<div className="grid gap-3">
								<div className="space-y-2">
									<Label><T>Label</T></Label>
									<Input
										value={field.label}
										placeholder={gt("Field label")}
										onChange={(event) =>
											onChange({ ...field, label: event.target.value })
										}
									/>
								</div>
								<div className="space-y-2">
									<Label><T>Description</T></Label>
									<Textarea
										value={field.description ?? ""}
										placeholder={gt("Description")}
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
									<Label><T>Required</T></Label>
									<Switch
										checked={field.required}
										onCheckedChange={(checked) =>
											onChange({ ...field, required: checked })
										}
									/>
								</div>

								{isRatingField(field) ? (
									<div className="space-y-2">
										<Label><T>Scale</T></Label>
										<Input
											type="number"
											min={3}
											max={10}
											value={field.config.scale}
											placeholder={gt("Scale")}
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
										<Label><T>Placeholder</T></Label>
										<Input
											value={field.config.placeholder ?? ""}
											placeholder={gt("Placeholder")}
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
										<Label><T>Options</T></Label>
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
											
                                            											<T>Add option</T>
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

			{isRatingField(field) ? (
				<div className="flex flex-wrap gap-2">
					{Array.from({ length: field.config.scale }).map((_, indexValue) => (
						<button
							key={indexValue}
							type="button"
							disabled
							className="flex size-11 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
						>
							<Star className="size-4" />
						</button>
					))}
				</div>
			) : null}

			{isCheckboxesField(field) ? (
				<div className="space-y-2">
					{field.config.options.map((option) => (
						<label key={option.id} className="flex items-center gap-3 text-sm">
							<Checkbox disabled />
							<span>{option.label}</span>
						</label>
					))}
					{field.config.allowOther ? (
						<label className="flex items-center gap-3 text-sm">
							<Checkbox disabled />
							<span><T>Other</T></span>
						</label>
					) : null}
				</div>
			) : null}

			{isNotesField(field) ? (
				<Textarea
					disabled
					className="min-h-24 resize-none"
					placeholder={field.config.placeholder ?? "Write your response..."}
				/>
			) : null}

			{isShortTextField(field) ? (
				<Input
					disabled
					placeholder={field.config.placeholder ?? "Type your answer..."}
				/>
			) : null}
		</div>
	);
}
