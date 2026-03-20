"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useAuth } from "@clerk/nextjs"
import { CheckCircle2, Heart, Loader2, ShieldCheck, Star, ThumbsUp } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { FormAnswerValue, TrackableFormFieldSnapshot } from "@/db/schema/types"
import {
  getEmptyAnswerValue,
  getOtherCheckboxValue,
  isCheckboxesField,
  isNotesField,
  isRatingField,
  isShortTextField,
  requiresResponderEmail,
} from "@/lib/trackable-form-submission"
import { getSharedFormCompletionCookieName } from "@/lib/shared-form-completion-cookie"
import { cn } from "@/lib/utils"
import { useTRPC } from "@/trpc/client"
import { T, useGT } from "gt-next";

const otherCheckboxValue = getOtherCheckboxValue()
const sharedFormCompletionCookieMaxAge = 60 * 60 * 24 * 365

function buildInitialAnswers(fields: TrackableFormFieldSnapshot[]) {
  return Object.fromEntries(
    fields.map((field) => [field.id, getEmptyAnswerValue(field)])
  ) as Record<string, FormAnswerValue>
}

function getRatingIcon(icon: "star" | "thumb" | "heart" | undefined) {
  switch (icon) {
    case "thumb":
      return ThumbsUp
    case "heart":
      return Heart
    case "star":
    default:
      return Star
  }
}

function SharedFormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 md:px-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-28 rounded-3xl" />
      <Skeleton className="h-80 rounded-3xl" />
    </div>
  )
}

function SharedFormUnavailable({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-10 md:px-6">
      <Card className="w-full rounded-3xl border-border/60">
        <CardHeader className="space-y-3">
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
            
                                  <T>Shared form</T>
                                </Badge>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
          {children ? <div className="pt-2">{children}</div> : null}
        </CardHeader>
      </Card>
    </div>
  )
}

function SharedFormStatusCard({
  badge,
  title,
  description,
}: {
  badge: string
  title: string
  description: string
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-10 md:px-6">
      <Card className="w-full rounded-3xl border-border/60 bg-card/95 shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600">
            <CheckCircle2 className="size-8" />
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {badge}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </div>
  )
}

type SharedTrackable = {
  id: string
  name: string
  description: string | null
  creatorName: string
}

type SharedSettings = {
  allowAnonymousSubmissions: boolean
  collectResponderEmail: boolean
  requiresAuthentication: boolean
}

type SharedForm = {
  id: string
  title: string
  description: string | null
  status: "draft" | "published" | "archived"
  submitLabel: string | null
  successMessage: string | null
  fields: TrackableFormFieldSnapshot[]
}

export function SharedFormPage({ token }: { token: string }) {
    const gt = useGT();
  const trpc = useTRPC()
  const { isLoaded, userId } = useAuth()
  const lastViewerIdRef = useRef<string | null | undefined>(undefined)
  const sharedFormQuery = useQuery(
    trpc.trackables.getSharedForm.queryOptions(
      { token },
      {
        enabled: isLoaded,
        retry: false,
      }
    )
  )

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    const nextViewerId = userId ?? null

    if (lastViewerIdRef.current === undefined) {
      lastViewerIdRef.current = nextViewerId
      return
    }

    if (lastViewerIdRef.current === nextViewerId) {
      return
    }

    lastViewerIdRef.current = nextViewerId
    void sharedFormQuery.refetch()
  }, [isLoaded, sharedFormQuery.refetch, userId])

  if (!isLoaded || sharedFormQuery.isLoading) {
    return <SharedFormSkeleton />
  }

  if (sharedFormQuery.error?.data?.code === "NOT_FOUND") {
    return (
      <SharedFormUnavailable
        title={gt("Link not found")}
        description={gt("This shared survey link is invalid, expired, or has been turned off.")}
      />
    )
  }

  if (
    sharedFormQuery.error?.data?.code === "PRECONDITION_FAILED" &&
    sharedFormQuery.error.message === "This shared form link is no longer active."
  ) {
    return (
      <SharedFormStatusCard
        badge="Link inactive"
        title={gt("This form link is no longer active.")}
        description={gt("The owner turned off this shared survey link, so it is no longer accepting responses.")}
      />
    )
  }

  if (sharedFormQuery.isError || !sharedFormQuery.data) {
    return (
      <SharedFormUnavailable
        title={gt("Form unavailable")}
        description={
          sharedFormQuery.error?.message ??
          "This shared form is not accepting responses right now."
        }
      />
    )
  }

  return (
      <SharedFormCard
        key={sharedFormQuery.data.form.id}
        token={token}
        isAnonymousVisitor={!userId}
        initialHasSubmitted={sharedFormQuery.data.viewer.hasSubmitted}
        trackable={sharedFormQuery.data.trackable}
        form={sharedFormQuery.data.form}
        settings={sharedFormQuery.data.settings}
      />
  )
}

function SharedFormCard({
  token,
  initialHasSubmitted,
  isAnonymousVisitor,
  trackable,
  form,
  settings,
}: {
  token: string
  initialHasSubmitted: boolean
  isAnonymousVisitor: boolean
  trackable: SharedTrackable
  form: SharedForm
  settings: SharedSettings
}) {
    const gt = useGT();
  const trpc = useTRPC()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [submissionStatus, setSubmissionStatus] = useState<
    "idle" | "submitted" | "already-submitted"
  >(() => {
    if (initialHasSubmitted) {
      return "already-submitted"
    }

    if (!isAnonymousVisitor || typeof document === "undefined") {
      return "idle"
    }

    const cookieName = getSharedFormCompletionCookieName(token)
    const hasCompletionCookie = document.cookie
      .split("; ")
      .some((entry) => entry.startsWith(`${cookieName}=true`))

    return hasCompletionCookie ? "already-submitted" : "idle"
  })
  const [responderEmail, setResponderEmail] = useState("")
  const [answers, setAnswers] = useState<Record<string, FormAnswerValue>>(() =>
    buildInitialAnswers(form.fields)
  )
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  useEffect(() => {
    if (submissionStatus === "idle" || !isAnonymousVisitor) {
      return
    }

    document.cookie = `${getSharedFormCompletionCookieName(token)}=true; path=/share/${encodeURIComponent(token)}; max-age=${sharedFormCompletionCookieMaxAge}; samesite=lax`
  }, [submissionStatus, isAnonymousVisitor, token])

  const submitSharedForm = useMutation(
    trpc.trackables.submitSharedForm.mutationOptions({
      onMutate: () => {
        setSubmissionError(null)
      },
      onSuccess: () => {
        setSubmissionStatus("submitted")
      },
      onError: (error) => {
        setSubmissionError(error.message)
      },
    })
  )

  const emailIsRequired = useMemo(
    () => requiresResponderEmail(settings),
    [settings]
  )

  useEffect(() => {
    if (!settings.requiresAuthentication || !isAnonymousVisitor) {
      return
    }

    const redirectUrl = `${pathname}${
      searchParams.size > 0 ? `?${searchParams.toString()}` : ""
    }`

    router.replace(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`)
  }, [
    isAnonymousVisitor,
    pathname,
    router,
    searchParams,
    settings.requiresAuthentication,
  ])

  if (settings.requiresAuthentication && isAnonymousVisitor) {
    return (
      <SharedFormUnavailable
        title={gt("Sign in required")}
        description={gt("Redirecting you to sign in so you can continue to this shared form.")}
      />
    )
  }

  function updateAnswer(fieldId: string, value: FormAnswerValue) {
    setAnswers((current) => ({
      ...current,
      [fieldId]: value,
    }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (emailIsRequired && responderEmail.trim().length === 0) {
      setSubmissionError("Email is required before you can submit this form.")
      return
    }

    submitSharedForm.mutate({
      token,
      responderEmail: responderEmail.trim() || undefined,
      metadata: {
        locale: navigator.language,
        userAgent: navigator.userAgent,
        referrer: document.referrer || undefined,
      },
      answers: form.fields.map((field) => ({
        fieldId: field.id,
        value: answers[field.id]?.value ?? getEmptyAnswerValue(field).value,
      })),
    })
  }

  if (submissionStatus !== "idle") {
    const isRepeatVisit = submissionStatus === "already-submitted"

    return (
      <SharedFormStatusCard
        badge={isRepeatVisit ? "Already submitted" : "Response recorded"}
        title={
          isRepeatVisit
            ? "You already submitted this form."
            : form.successMessage ?? "Thanks for your response."
        }
        description={
          isRepeatVisit
            ? `Your response for ${trackable.name} has already been recorded.`
            : `Your submission for ${trackable.name} has been saved.`
        }
      />
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_38%)] dark:bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_34%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-muted/60 via-background/40 to-transparent dark:from-muted/40 dark:via-background/10" />
      <div className="relative mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" />
          
                            <T>Shared form by</T> {trackable.creatorName}
        </div>

        <Card className="rounded-3xl border-border/60 bg-card/95 shadow-sm backdrop-blur dark:bg-card/90">
          <CardHeader className="space-y-4 border-b border-border/50 px-6 py-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {trackable.name}
              </Badge>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">{form.title}</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {form.description ??
                  "Fill out the form below and submit your response."}
              </p>
            </div>
          </CardHeader>

          <CardContent className="px-6 py-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {emailIsRequired ? (
                <div className="space-y-3">
                  <Label htmlFor="responder-email" className="text-base font-medium">
                    
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
                const answer = answers[field.id] ?? getEmptyAnswerValue(field)

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
                          {Array.from({ length: field.config.scale }).map((_, index) => {
                            const value = index + 1
                            const Icon = getRatingIcon(field.config.icon)
                            const isActive = answer.kind === "rating" && answer.value >= value

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
                                    : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                                )}
                                aria-label={`${field.label}: ${value}`}
                              >
                                <Icon className="size-4" />
                              </button>
                            )
                          })}
                        </div>
                        {field.config.labels ? (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{field.config.labels.low ?? "Low"}</span>
                            <span>{field.config.labels.high ?? "High"}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {isCheckboxesField(field) ? (
                      <div className="space-y-3">
                        {field.config.options.map((option) => {
                          const selected =
                            answer.kind === "checkboxes" &&
                            answer.value.includes(option.value)

                          return (
                            <label
                              key={option.id}
                              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 bg-background px-4 py-3 text-sm transition-colors hover:border-border"
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={(checked) => {
                                  const currentValues =
                                    answer.kind === "checkboxes" ? answer.value : []

                                  updateAnswer(field.id, {
                                    kind: "checkboxes",
                                    value: checked
                                      ? Array.from(
                                          new Set([...currentValues, option.value])
                                        )
                                      : currentValues.filter(
                                          (value) => value !== option.value
                                        ),
                                  })
                                }}
                              />
                              <span>{option.label}</span>
                            </label>
                          )
                        })}

                        {field.config.allowOther ? (
                          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 bg-background px-4 py-3 text-sm transition-colors hover:border-border">
                            <Checkbox
                              checked={
                                answer.kind === "checkboxes" &&
                                answer.value.includes(otherCheckboxValue)
                              }
                              onCheckedChange={(checked) => {
                                const currentValues =
                                  answer.kind === "checkboxes" ? answer.value : []

                                updateAnswer(field.id, {
                                  kind: "checkboxes",
                                  value: checked
                                    ? Array.from(
                                        new Set([
                                          ...currentValues,
                                          otherCheckboxValue,
                                        ])
                                      )
                                    : currentValues.filter(
                                        (value) => value !== otherCheckboxValue
                                      ),
                                })
                              }}
                            />
                            <span><T>Other</T></span>
                          </label>
                        ) : null}
                      </div>
                    ) : null}

                    {isNotesField(field) ? (
                      <div className="space-y-3">
                        <Textarea
                          value={answer.kind === "notes" ? answer.value : ""}
                          onChange={(event) =>
                            updateAnswer(field.id, {
                              kind: "notes",
                              value: event.target.value,
                            })
                          }
                          placeholder={
                            field.config.placeholder ?? "Write your response..."
                          }
                          maxLength={field.config.maxLength}
                          className="min-h-32 resize-y"
                        />
                        {field.config.maxLength ? (
                          <div className="text-right text-xs text-muted-foreground">
                            {(answer.kind === "notes" ? answer.value.length : 0)}/
                            {field.config.maxLength}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {isShortTextField(field) ? (
                      <div className="space-y-3">
                        <Input
                          value={answer.kind === "short_text" ? answer.value : ""}
                          onChange={(event) =>
                            updateAnswer(field.id, {
                              kind: "short_text",
                              value: event.target.value,
                            })
                          }
                          placeholder={
                            field.config.placeholder ?? "Type your answer..."
                          }
                          maxLength={field.config.maxLength}
                        />
                        {field.config.maxLength ? (
                          <div className="text-right text-xs text-muted-foreground">
                            {(answer.kind === "short_text" ? answer.value.length : 0)}/
                            {field.config.maxLength}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}

              {submissionError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {submissionError}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-border/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  
                                                    <T>Your response will be recorded for</T> {trackable.name}.
                </p>
                <Button
                  type="submit"
                  size="lg"
                  className="rounded-full px-6"
                  disabled={submitSharedForm.isPending}
                >
                  {submitSharedForm.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      
                                                                <T>Submitting...</T>
                                                              </>
                  ) : (
                    form.submitLabel ?? "Submit response"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
