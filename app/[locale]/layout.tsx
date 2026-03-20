import { ThemeProvider } from "@/components/theme-provider"
import { TRPCReactProvider } from "@/components/trpc-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getClerkLocalization } from "@/lib/clerk-localization"
import { buildAbsoluteUrl, siteConfig } from "@/lib/site-config"
import { cn } from "@/lib/utils"
import { ClerkProvider } from "@clerk/nextjs"
import { GTProvider } from "gt-next"
import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import { Toaster } from "sonner"
import "../globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

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
    card: "summary",
    title: siteConfig.title,
    description: siteConfig.description,
  },
}

export default async function RootLayout({
  auth,
  children,
  params,
}: Readonly<{
  auth?: React.ReactNode
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/sign-in"
  const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "/sign-up"
  const clerkLocalization = getClerkLocalization(locale)

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body className="min-h-svh bg-background">
        <ClerkProvider
          localization={clerkLocalization}
          signInUrl={signInUrl}
          signUpUrl={signUpUrl}
        >
          <GTProvider>
            <TRPCReactProvider>
              <TooltipProvider>
                <ThemeProvider>
                  {children}
                  {auth}
                  <Toaster position="top-center" />
                </ThemeProvider>
              </TooltipProvider>
            </TRPCReactProvider>
          </GTProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
