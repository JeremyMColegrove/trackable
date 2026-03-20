import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { buildAbsoluteUrl, siteConfig } from "@/lib/site-config"
import { LandingPage } from "./landing-page"

export const dynamic = "force-dynamic"

export function generateMetadata(): Metadata {
  const homePageUrl = buildAbsoluteUrl("/")

  return {
    title: siteConfig.title,
    description: siteConfig.description,
    alternates: {
      canonical: homePageUrl,
    },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      url: homePageUrl,
      title: siteConfig.title,
      description: siteConfig.description,
    },
    twitter: {
      card: "summary",
      title: siteConfig.title,
      description: siteConfig.description,
    },
  }
}

export default async function Page() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard")
  }

  return <LandingPage />
}
