/** biome-ignore-all lint/correctness/useUniqueElementIds: <explanation> */
/** biome-ignore-all lint/a11y/noLabelWithoutControl: <explanation> */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
	FormAnswerValue,
	TrackableFormFieldSnapshot,
} from "@/db/schema/types";
import { getSharedFormCompletionCookieName } from "@/lib/shared-form-completion-cookie";
import { isSurveyResponseLimitMessage } from "@/lib/subscription-limit-messages";
import {
	getEmptyAnswerValue,
	getOtherCheckboxValue,
	isAnswerableField,
	isCheckboxesField,
	isNotesField,
	isRatingField,
	isShortTextField,
	isYouTubeVideoField,
	requiresResponderEmail,
} from "@/lib/trackable-form-submission";
import { cn } from "@/lib/utils";
import { buildYouTubeEmbedUrl } from "@/lib/youtube";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { T, useGT } from "gt-next";
import { Eye, Heart, Loader2, ShieldCheck, Star, ThumbsUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
	SharedFormResponseLimitCard,
	SharedFormStatusCard,
	SharedFormUnavailable,
} from "./shared-form-status";

const otherCheckboxValue = getOtherCheckboxValue();
const sharedFormCompletionCookieMaxAge = 60 * 60 * 24 * 365;

export type SharedTrackable = {
	id: string;
	name: string;
	description: string | null;
	creatorName?: string | null;
};

export type SharedSettings = {
	allowAnonymousSubmissions: boolean;
	collectResponderEmail: boolean;
	requiresAuthentication: boolean;
};

export type SharedForm = {
	id: string;
	title: string;
	description: string | null;
	status: "draft" | "published" | "archived";
	submitLabel: string | null;
	successMessage: string | null;
	fields: TrackableFormFieldSnapshot[];
};

function buildInitialAnswers(fields: TrackableFormFieldSnapshot[]) {
	return Object.fromEntries(
		fields
			.filter(isAnswerableField)
			.map((field) => [field.id, getEmptyAnswerValue(field)]),
	) as Partial<Record<string, FormAnswerValue>>;
}

function getRatingIcon(icon: "star" | "thumb" | "heart" | undefined) {
	switch (icon) {
		case "thumb":
			return ThumbsUp;
		case "heart":
			return Heart;
		case "star":
		default:
			return Star;
	}
}

export function SharedFormCard({
	token,
	initialHasSubmitted,
	isAnonymousVisitor,
	trackable,
	form,
	settings,
	mode = "shared",
}: {
	token?: string;
	initialHasSubmitted: boolean;
	isAnonymousVisitor: boolean;
	trackable: SharedTrackable;
	form: SharedForm;
	settings: SharedSettings;
	mode?: "shared" | "preview";
}) {
	const gt = useGT();
	const trpc = useTRPC();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const isPreview = mode === "preview";
	const [submissionStatus, setSubmissionStatus] = useState<
		"idle" | "submitted" | "already-submitted" | "limit-reached"
	>(() => {
		if (isPreview) {
			return "idle";
		}

		if (initialHasSubmitted) {
			return "already-submitted";
		}

		if (!isAnonymousVisitor || typeof document === "undefined") {
			return "idle";
		}

		if (!token) {
			return "idle";
		}

		const cookieName = getSharedFormCompletionCookieName(token);
		const hasCompletionCookie = document.cookie
			.split("; ")
			.some((entry) => entry.startsWith(`${cookieName}=true`));

		return hasCompletionCookie ? "already-submitted" : "idle";
	});
	const [responderEmail, setResponderEmail] = useState("");
	const [answers, setAnswers] = useState<
		Partial<Record<string, FormAnswerValue>>
	>(() => buildInitialAnswers(form.fields));
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	useEffect(() => {
		setAnswers(buildInitialAnswers(form.fields));
	}, [form]);

	useEffect(() => {
		if (
			isPreview ||
			!token ||
			submissionStatus === "idle" ||
			!isAnonymousVisitor
		) {
			return;
		}

		document.cookie = `${getSharedFormCompletionCookieName(token)}=true; path=/share/${encodeURIComponent(token)}; max-age=${sharedFormCompletionCookieMaxAge}; samesite=lax`;
	}, [isAnonymousVisitor, isPreview, submissionStatus, token]);

	const submitSharedForm = useMutation(
		trpc.trackables.submitSharedForm.mutationOptions({
			onMutate: () => {
				setSubmissionError(null);
			},
			onSuccess: () => {
				setSubmissionStatus("submitted");
			},
			onError: (error) => {
				if (isSurveyResponseLimitMessage(error.message)) {
					setSubmissionStatus("limit-reached");
					return;
				}

				setSubmissionError(error.message);
			},
		}),
	);

	const emailIsRequired = useMemo(
		() => requiresResponderEmail(settings),
		[settings],
	);

	useEffect(() => {
		if (isPreview || !settings.requiresAuthentication || !isAnonymousVisitor) {
			return;
		}

		const redirectUrl = `${pathname}${
			searchParams.size > 0 ? `?${searchParams.toString()}` : ""
		}`;

		router.replace(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
	}, [
		isPreview,
		isAnonymousVisitor,
		pathname,
		router,
		searchParams,
		settings.requiresAuthentication,
	]);

	if (settings.requiresAuthentication && isAnonymousVisitor) {
		return (
			<SharedFormUnavailable
				title={gt("Sign in required")}
				description={gt(
					"Redirecting you to sign in so you can continue to this shared form.",
				)}
			/>
		);
	}

	function updateAnswer(fieldId: string, value: FormAnswerValue) {
		setAnswers((current) => ({
			...current,
			[fieldId]: value,
		}));
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (isPreview) {
			setSubmissionError(null);
			return;
		}

		if (!token) {
			setSubmissionError("This form preview is missing a valid token.");
			return;
		}

		if (emailIsRequired && responderEmail.trim().length === 0) {
			setSubmissionError("Email is required before you can submit this form.");
			return;
		}

		submitSharedForm.mutate({
			token,
			responderEmail: responderEmail.trim() || undefined,
			metadata: {
				locale: navigator.language,
				userAgent: navigator.userAgent,
				referrer: document.referrer || undefined,
			},
			answers: form.fields.filter(isAnswerableField).map((field) => ({
				fieldId: field.id,
				value: (answers[field.id] ?? getEmptyAnswerValue(field)).value,
			})),
		});
	}

	if (submissionStatus !== "idle") {
		if (submissionStatus === "limit-reached") {
			return <SharedFormResponseLimitCard />;
		}

		const isRepeatVisit = submissionStatus === "already-submitted";

		return (
			<SharedFormStatusCard
				badge={isRepeatVisit ? "Already submitted" : "Response recorded"}
				title={
					isRepeatVisit
						? gt("You already submitted this form.")
						: (form.successMessage ?? gt("Thanks for your response."))
				}
				description={
					isRepeatVisit
						? `Your response for ${trackable.name} has already been recorded.`
						: `Your submission for ${trackable.name} has been saved.`
				}
			/>
		);
	}

	return (
		<div className="relative min-h-screen overflow-hidden bg-background">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_38%)] dark:bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.14),transparent_34%)]" />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-muted/60 via-background/40 to-transparent dark:from-muted/40 dark:via-background/10" />
			<div className="relative mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
				{isPreview ? (
					<div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
						<Eye className="size-4" />
						<T>Preview</T>
					</div>
				) : (
					<div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
						<ShieldCheck className="size-4" />
						<T>Shared form by</T> {trackable.creatorName}
					</div>
				)}

				<Card className="rounded-3xl border-border/60 bg-card/95 shadow-sm backdrop-blur dark:bg-card/90">
					<CardHeader className="space-y-4 border-b border-border/50 px-6 py-6">
						<div className="flex flex-wrap items-center gap-3">
							<Badge variant="outline" className="rounded-full px-3 py-1">
								{trackable.name}
							</Badge>
						</div>
						<div className="space-y-2">
							<h1 className="text-3xl font-semibold tracking-tight">
								{form.title}
							</h1>
							<p className="text-sm leading-6 text-muted-foreground">
								{form.description ??
									gt("Fill out the form below and submit your response.")}
							</p>
						</div>
					</CardHeader>

					<CardContent className="px-6 py-6">
						<form onSubmit={handleSubmit} className="space-y-8">
							{emailIsRequired ? (
								<div className="space-y-3">
									<Label
										htmlFor="responder-email"
										className="text-base font-medium"
									>
										<T>Email address</T>
									</Label>
									<Input
										id="responder-email"
										type="email"
										value={responderEmail}
										onChange={(event) => setResponderEmail(event.target.value)}
										placeholder={gt("name@example.com")}
									/>
									<p className="text-sm text-muted-foreground">
										<T>This form requires an email with each response.</T>
									</p>
								</div>
							) : null}

							{form.fields.map((field) => {
								const answer = isAnswerableField(field)
									? (answers[field.id] ?? getEmptyAnswerValue(field))
									: undefined;
								const youtubeEmbedUrl = isYouTubeVideoField(field)
									? buildYouTubeEmbedUrl(field.config.url)
									: null;

								return (
									<div
										key={field.id}
										className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-5"
									>
										<div className="space-y-2">
											<div className="flex flex-wrap items-center gap-2">
												<h2 className="text-lg font-medium">{field.label}</h2>
												{field.required ? (
													<Badge variant="outline" className="rounded-full">
														<T>Required</T>
													</Badge>
												) : null}
											</div>
											{field.description ? (
												<p className="text-sm text-muted-foreground">
													{field.description}
												</p>
											) : null}
										</div>

										{isRatingField(field) ? (
											<div className="space-y-3">
												<div className="flex flex-wrap gap-2">
													{Array.from({ length: field.config.scale }).map(
														(_, index) => {
															const value = index + 1;
															const Icon = getRatingIcon(field.config.icon);
															const isActive =
																answer?.kind === "rating" &&
																answer.value >= value;

															return (
																<button
																	key={value}
																	type="button"
																	onClick={() =>
																		updateAnswer(field.id, {
																			kind: "rating",
																			value,
																		})
																	}
																	className={cn(
																		"flex size-11 items-center justify-center rounded-full border transition-colors",
																		isActive
																			? "border-foreground bg-foreground text-background"
																			: "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
																	)}
																	aria-label={`${field.label}: ${value}`}
																>
																	<Icon className="size-4" />
																</button>
															);
														},
													)}
												</div>
												{field.config.labels ? (
													<div className="flex justify-between text-xs text-muted-foreground">
														<span>{field.config.labels.low ?? gt("Low")}</span>
														<span>
															{field.config.labels.high ?? gt("High")}
														</span>
													</div>
												) : null}
											</div>
										) : null}

										{isCheckboxesField(field) ? (
											<div className="space-y-3">
												{field.config.options.map((option) => {
													const selected =
														answer?.kind === "checkboxes" &&
														answer.value.includes(option.value);

													return (
														<label
															key={option.id}
															className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 bg-background px-4 py-3 text-sm transition-colors hover:border-border"
														>
															<Checkbox
																checked={selected}
																onCheckedChange={(checked) => {
																	const currentValues =
																		answer?.kind === "checkboxes"
																			? answer.value
																			: [];

																	updateAnswer(field.id, {
																		kind: "checkboxes",
																		value: checked
																			? Array.from(
																					new Set([
																						...currentValues,
																						option.value,
																					]),
																				)
																			: currentValues.filter(
																					(value) => value !== option.value,
																				),
																	});
																}}
															/>
															<span>{option.label}</span>
														</label>
													);
												})}

												{field.config.allowOther ? (
													<label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 bg-background px-4 py-3 text-sm transition-colors hover:border-border">
														<Checkbox
															checked={
																answer?.kind === "checkboxes" &&
																answer.value.includes(otherCheckboxValue)
															}
															onCheckedChange={(checked) => {
																const currentValues =
																	answer?.kind === "checkboxes"
																		? answer.value
																		: [];

																updateAnswer(field.id, {
																	kind: "checkboxes",
																	value: checked
																		? Array.from(
																				new Set([
																					...currentValues,
																					otherCheckboxValue,
																				]),
																			)
																		: currentValues.filter(
																				(value) => value !== otherCheckboxValue,
																			),
																});
															}}
														/>
														<span>
															<T>Other</T>
														</span>
													</label>
												) : null}
											</div>
										) : null}

										{isNotesField(field) ? (
											<div className="space-y-3">
												<Textarea
													value={answer?.kind === "notes" ? answer.value : ""}
													onChange={(event) =>
														updateAnswer(field.id, {
															kind: "notes",
															value: event.target.value,
														})
													}
													placeholder={
														field.config.placeholder ??
														gt("Write your response...")
													}
													maxLength={field.config.maxLength}
													className="min-h-32 resize-y"
												/>
												{field.config.maxLength ? (
													<div className="text-right text-xs text-muted-foreground">
														{answer?.kind === "notes" ? answer.value.length : 0}
														/{field.config.maxLength}
													</div>
												) : null}
											</div>
										) : null}

										{isShortTextField(field) ? (
											<div className="space-y-3">
												<Input
													value={
														answer?.kind === "short_text" ? answer.value : ""
													}
													onChange={(event) =>
														updateAnswer(field.id, {
															kind: "short_text",
															value: event.target.value,
														})
													}
													placeholder={
														field.config.placeholder ??
														gt("Type your answer...")
													}
													maxLength={field.config.maxLength}
												/>
												{field.config.maxLength ? (
													<div className="text-right text-xs text-muted-foreground">
														{answer?.kind === "short_text"
															? answer.value.length
															: 0}
														/{field.config.maxLength}
													</div>
												) : null}
											</div>
										) : null}

										{isYouTubeVideoField(field) ? (
											youtubeEmbedUrl ? (
												<div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
													<div className="aspect-video w-full">
														<iframe
															src={youtubeEmbedUrl}
															title={field.label || "Embedded YouTube video"}
															className="size-full border-0"
															allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
															referrerPolicy="strict-origin-when-cross-origin"
															allowFullScreen
														/>
													</div>
												</div>
											) : (
												<div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
													<T>This YouTube link is invalid.</T>
												</div>
											)
										) : null}
									</div>
								);
							})}

							{submissionError ? (
								<div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
									{submissionError}
								</div>
							) : null}

							<div className="flex flex-col gap-3 border-t border-border/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-sm text-muted-foreground">
									{isPreview ? (
										<T>Preview mode only. Responses are not saved.</T>
									) : (
										<>
											<T>Your response will be recorded for</T> {trackable.name}
											.
										</>
									)}
								</p>
								<Button
									type={isPreview ? "button" : "submit"}
									size="lg"
									className="rounded-full px-6"
									disabled={submitSharedForm.isPending}
								>
									{submitSharedForm.isPending ? (
										<>
											<Loader2 className="size-4 animate-spin" />
											<T>Submitting...</T>
										</>
									) : isPreview ? (
										<T>Preview only</T>
									) : (
										(form.submitLabel ?? gt("Submit response"))
									)}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
