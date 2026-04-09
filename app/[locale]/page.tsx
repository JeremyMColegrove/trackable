import { getAuth } from "@/server/get-auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { createPageMetadata } from "@/lib/seo"
import { siteConfig } from "@/lib/site-config"
import { LandingPage } from "./landing-page"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return createPageMetadata({
    title: siteConfig.homeTitle,
    description: siteConfig.description,
    pathname: "/",
    locale,
    useAbsoluteTitle: true,
  })
}

async function LandingPageRedirect() {
  const { userId } = await getAuth()

  if (userId) {
    redirect("/dashboard")
  }

  return null
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params

  await LandingPageRedirect()

  return <LandingPage />
}
