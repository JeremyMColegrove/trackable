import { AppSettingsProvider } from "@/components/app-settings-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { TRPCReactProvider } from "@/components/trpc-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { supportedLocales } from "@/lib/discovery-files"
import { buildAbsoluteUrl, siteConfig } from "@/lib/site-config"
import { cn } from "@/lib/utils"
import { GTProvider } from "gt-next"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Toaster } from "sonner"
import "../globals.css"

export const metadata: Metadata = {
  metadataBase: buildAbsoluteUrl("/"),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name,
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
}

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }))
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params

  if (!supportedLocales.includes(locale)) {
    notFound()
  }

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("antialiased", "font-sans")}
    >
      <body className="min-h-svh bg-background">
        <GTProvider>
          <TRPCReactProvider>
            <AppSettingsProvider>
              <TooltipProvider>
                <ThemeProvider>
                  {children}
                  <Toaster position="top-center" />
                </ThemeProvider>
              </TooltipProvider>
            </AppSettingsProvider>
          </TRPCReactProvider>
        </GTProvider>
      </body>
    </html>
  )
}
