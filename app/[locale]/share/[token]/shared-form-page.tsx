/** biome-ignore-all lint/correctness/useUniqueElementIds: <explanation> */
/** biome-ignore-all lint/a11y/noLabelWithoutControl: <explanation> */
"use client"

import { isSurveyResponseLimitMessage } from "@/lib/subscription-limit-messages"
import { useTRPC } from "@/trpc/client"
import { useAuth } from "@clerk/nextjs"
import { useQuery } from "@tanstack/react-query"
import { useGT } from "gt-next"
import { useEffect, useRef } from "react"
import { SharedFormCard } from "./shared-form-card"
import {
  SharedFormResponseLimitCard,
  SharedFormSkeleton,
  SharedFormStatusCard,
  SharedFormUnavailable,
} from "./shared-form-status"

export function SharedFormPage({ token }: { token: string }) {
  const gt = useGT()
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
        description={gt(
          "This shared survey link is invalid, expired, or has been turned off."
        )}
      />
    )
  }

  if (
    sharedFormQuery.error?.data?.code === "PRECONDITION_FAILED" &&
    sharedFormQuery.error.message ===
      "This shared form link is no longer active."
  ) {
    return (
      <SharedFormStatusCard
        badge="Link inactive"
        title={gt("This form link is no longer active.")}
        description={gt(
          "The owner turned off this shared survey link, so it is no longer accepting responses."
        )}
      />
    )
  }

  if (
    sharedFormQuery.error?.data?.code === "PRECONDITION_FAILED" &&
    sharedFormQuery.error.message &&
    isSurveyResponseLimitMessage(sharedFormQuery.error.message)
  ) {
    return <SharedFormResponseLimitCard />
  }

  if (sharedFormQuery.isError || !sharedFormQuery.data) {
    return (
      <SharedFormStatusCard
        badge="Failed to load"
        title={gt("Form unavailable")}
        description={
          sharedFormQuery.error?.message ??
          "This shared form is not accepting responses right now."
        }
        variant="error"
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
