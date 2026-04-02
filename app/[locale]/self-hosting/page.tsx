import { T } from "gt-next"
import { CheckCircle2 } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { AppBrand } from "@/components/app-brand"
import { LandingAuthActions } from "@/components/auth/landing-auth-actions"
import { createPageMetadata } from "@/lib/seo"
import { getSelfHostingExamples } from "@/lib/self-hosting-examples"
import { siteConfig } from "@/lib/site-config"
import { CodeBlock } from "./code-block"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return createPageMetadata({
    title: "Self-Hosting Guide",
    description: "Learn how to self-host Trackables on your own infrastructure.",
    pathname: "/self-hosting",
    locale,
  })
}

function Step({
  number,
  title,
  children,
}: {
  number: string
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative pl-8 md:pl-12">
      <div className="absolute -left-[13px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background ring-4 ring-background md:-left-[17px] md:h-8 md:w-8">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary md:text-sm">
          {number}
        </div>
      </div>
      <h3 className="mb-3 text-xl font-semibold text-foreground">{title}</h3>
      <div className="prose prose-zinc mb-12 max-w-none text-muted-foreground dark:prose-invert">
        {children}
      </div>
    </div>
  )
}

export default async function SelfHostingPage() {
  const { envExample, dockerComposeExample } = await getSelfHostingExamples()

  return (
    <main className="flex min-h-svh flex-col bg-background selection:bg-primary/10">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
          <AppBrand className="text-lg font-bold tracking-tight" />
          <div className="flex items-center gap-4">
            <LandingAuthActions section="navbar" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative border-b bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center sm:px-8">
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            <T>Self-Hosting Guide</T>
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
            <T>
              Deploy Trackables on your own infrastructure in minutes using Docker targetting local environments or simple single-server setups.
            </T>
          </p>
        </div>
      </section>

      {/* Guide Content */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16 sm:px-8 sm:py-24">
        <div className="relative border-l-2 border-muted md:ml-4">
          
          <Step number="1" title={<T>What you need</T>}>
            <p>
              To get started locally, you&apos;ll need <strong>Docker</strong> installed along with <strong>Docker Compose</strong>. You will also need a free <strong>Clerk</strong> account for user authentication, even for private deployments. Trackables uses Clerk to handle secure sessions, 2FA, and identity administration out of the box.
            </p>
          </Step>

          <Step number="2" title={<T>Clerk Setup</T>}>
            <p>
              Create a new application in your Clerk dashboard. Once created, locate your <strong>Publishable Key</strong> and <strong>Secret Key</strong> from the API Keys page. Keep these handy for the <code>.env</code> file.
            </p>
          </Step>

          <Step number="3" title={<T>Clerk Webhook for User Sync</T>}>
            <p>
              Trackables syncs user data to its local database using webhooks. In the Clerk dashboard, navigate to <strong>Webhooks</strong> and create a new endpoint.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li><strong>Endpoint URL</strong>: <code>https://&lt;your-domain&gt;/api/clerk/webhook</code> (If testing fully local without a tunnel, you can use a tool like ngrok or localtunnel, or disable local webhook validation during dev).</li>
              <li><strong>Events to listen to</strong>: <code>user.created</code>, <code>user.updated</code>, <code>user.deleted</code>.</li>
            </ul>
            <p className="mt-4">
              Upon saving, reveal the <strong>Signing Secret</strong> starting with <code>whsec_</code> and save it for the <code>.env</code> file.
            </p>
          </Step>

          <Step number="4" title={<T>Database & Redis connection</T>}>
            <p>
              Trackables requires <strong>PostgreSQL</strong> as the primary data store and <strong>Redis</strong> for caching and job queuing. The provided Docker Compose handles both automatically, mapping them respectively to default ports. For production, you may choose to use managed services.
            </p>
          </Step>

          <Step number="5" title={<T>Configure .env</T>}>
            <p>
              Create a <code>.env</code> file in your directory. Populate it with the Clerk keys you gathered. Make sure the <code>NEXT_PUBLIC_APP_URL</code> perfectly matches exactly how you access the app.
            </p>
            <CodeBlock code={envExample} label=".env.example" />
          </Step>

          <Step number="6" title={<T>Configure docker-compose.yml</T>}>
            <p>
              Create a <code>docker-compose.yml</code> file alongside your <code>.env</code> file. The standard configuration pulls the latest image and orchestrates the database and redis containers automatically.
            </p>
            <CodeBlock code={dockerComposeExample} label="docker-compose.yml" />
          </Step>

          <Step number="7" title={<T>Start & Verify</T>}>
            <p>
              With both files prepared, start the stack in detached mode:
            </p>
            <CodeBlock code="docker compose up -d" label="bash" />
            <div className="mt-6 flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-primary">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">
                Once initialized, visit <code className="rounded bg-primary/10 px-1 py-0.5">http://localhost:3000</code> to sign in using your Clerk configuration. Your first authentication will seamlessly propagate to the local database!
              </p>
            </div>
          </Step>

        </div>
      </section>

      {/* Footer (Simplified) */}
      <footer className="mt-auto border-t bg-muted/20 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:px-8 md:flex-row">
          <div className="flex items-center gap-2">
            <AppBrand className="text-xl font-bold tracking-tight opacity-80 grayscale" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Trackables. <T>All rights reserved.</T>
          </p>
          <div className="flex gap-6">
            <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              <T>Home</T>
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
