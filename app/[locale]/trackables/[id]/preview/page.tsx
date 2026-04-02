import { auth } from "@clerk/nextjs/server"
import { TRPCError } from "@trpc/server"
import { redirect } from "next/navigation"

import { formService } from "@/server/services/form.service"
import { ensureUserProvisioned } from "@/server/user-provisioning"
import { TrackablePreviewPage } from "./trackable-preview-page"

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return []
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ previewId?: string | string[] }>
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ])
  const previewId = Array.isArray(resolvedSearchParams.previewId)
    ? resolvedSearchParams.previewId[0]
    : resolvedSearchParams.previewId
  const { userId } = await auth()

  if (!userId) {
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(`/trackables/${id}/preview${previewId ? `?previewId=${previewId}` : ""}`)}`
    )
  }

  await ensureUserProvisioned(userId)

  let preview: Awaited<ReturnType<typeof formService.getPreview>>

  try {
    preview = await formService.getPreview(id, userId)
  } catch (error) {
    if (error instanceof TRPCError) {
      redirect("/dashboard")
    }

    throw error
  }

  return (
    <TrackablePreviewPage
      previewId={previewId}
      trackable={{
        ...preview.trackable,
        creatorName: null,
      }}
      initialForm={preview.form}
    />
  )
}
