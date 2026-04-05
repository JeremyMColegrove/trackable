import { T } from "gt-next"
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  FormInput,
  MessageSquare,
  Search,
  Server,
} from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

import { AppBrand } from "@/components/app-brand"
import {
  LandingAuthActions,
  LandingAuthActionsSkeleton,
} from "@/components/auth/landing-auth-actions"
import { LandingDashboardPreview } from "@/components/landing-dashboard-preview"
import { siteConfig } from "@/lib/site-config"

const landingCardClassName =
  "translate-y-0 rounded-2xl border border-border/80 bg-card shadow-sm transition-transform transition-shadow transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md hover:border-border"

export async function LandingPage() {
  return (
    <main className="flex min-h-svh flex-col bg-background selection:bg-muted/20 [&>section:nth-of-type(even)]:bg-muted/20 [&>section:nth-of-type(odd)]:bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
          <AppBrand className="text-lg font-bold tracking-tight" />
          <div className="flex items-center gap-4">
            <Suspense
              fallback={<LandingAuthActionsSkeleton section="navbar" />}
            >
              <LandingAuthActions section="navbar" />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Modern Background */}
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 text-center lg:px-8">
          <h1 className="max-w-4xl text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl lg:leading-[1.1]">
            <T>Forms, responses, and API usage in one place.</T>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            <T>
              Create one trackable item, choose how it collects data, and review
              every submission or usage event in one dashboard.
            </T>
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Suspense fallback={<LandingAuthActionsSkeleton section="hero" />}>
              <LandingAuthActions section="hero" />
            </Suspense>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="relative border-t py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              <T>How Trackables Works</T>
            </h2>
            <p className="text-lg text-muted-foreground">
              <T>
                Create an item, decide how data is collected, and review it in
                one unified dashboard.
              </T>
            </p>
          </div>

          <div className="relative grid gap-8 md:grid-cols-3">
            {/* Connecting line for desktop */}
            <div className="absolute top-12 right-[10%] left-[10%] -z-10 hidden h-[2px] bg-gradient-to-r from-muted/0 via-border to-muted/0 md:block" />

            {[
              {
                key: "create-item",
                step: <T>01</T>,
                title: <T>Create a Trackable Item</T>,
                desc: (
                  <T>
                    Start with a title, description, and the fields or events
                    you want to track. Each item generates a secure destination.
                  </T>
                ),
                icon: <FormInput className="h-6 w-6" />,
              },
              {
                key: "send-data",
                step: <T>02</T>,
                title: <T>Send Data Contextually</T>,
                desc: (
                  <T>
                    Share a clean, dynamic form for manual submissions, or use a
                    secure API key to automatically ingest events and metadata.
                  </T>
                ),
                icon: <Activity className="h-6 w-6" />,
              },
              {
                key: "review-analyse",
                step: <T>03</T>,
                title: <T>Review & Analyze</T>,
                desc: (
                  <T>
                    Monitor event history, aggregate counts, and structured
                    feedback from a single, unified dashboard view.
                  </T>
                ),
                icon: <BarChart3 className="h-6 w-6" />,
              },
            ].map((item) => (
              <div
                key={item.key}
                className={`${landingCardClassName} group relative p-8`}
              >
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {item.icon}
                </div>
                <span className="absolute top-8 right-8 text-4xl font-black text-muted-foreground transition-colors">
                  {item.step}
                </span>
                <h3 className="mb-3 text-xl font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="border-t py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                <T>A flexible platform for any data workflow</T>
              </h2>
              <p className="mb-10 text-lg text-muted-foreground">
                <T>
                  Stop switching between different tools for surveys, feedback
                  forms, and product analytics. Trackables unifies everything
                  using a consistent collection model.
                </T>
              </p>

              <div className="space-y-8">
                {[
                  {
                    key: "structred-response",
                    title: <T>Structured Responses</T>,
                    desc: (
                      <T>
                        Easily capture ratings, booleans, unstructured text, and
                        more from customizable public forms.
                      </T>
                    ),
                  },
                  {
                    key: "api-ingestion",
                    title: <T>Direct API Ingestion</T>,
                    desc: (
                      <T>
                        Integrate deeply into your application to log background
                        events and track granular product usage.
                      </T>
                    ),
                  },
                  {
                    key: "analysis",
                    title: <T>Unified Analysis</T>,
                    desc: (
                      <T>
                        Instantly view all historical submissions and raw usage
                        counts without managing fragmented dashboards.
                      </T>
                    ),
                  },
                ].map((feature, i) => (
                  <div key={feature.key} className="flex gap-4">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="mb-1 text-lg font-semibold text-foreground">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-tr from-primary/20 to-transparent blur-3xl" />
              <div className="overflow-hidden rounded-2xl border bg-muted/20 shadow-xl ring-1 ring-border/50 backdrop-blur">
                <LandingDashboardPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Collection Styles
			<section className="relative overflow-hidden border-t py-24 sm:py-32">
				<div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8">
					<div className="mx-auto mb-16 max-w-3xl text-center">
						<h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
							<T>Engineered for both worlds</T>
						</h2>
						<p className="text-lg text-muted-foreground">
							<T>
								Maintain a consistent data structure regardless of where your
								inputs originate from.
							</T>
						</p>
					</div>

					<div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto">
						{[
							{
								key: "share-form",
								title: <T>Shareable Forms</T>,
								desc: (
									<T>
										Deploy public forms instantly to gather qualitative feedback
										from your audience.
									</T>
								),
								icon: <LayoutTemplate className="h-5 w-5" />,
							},
							{
								key: "send-api-ingestion",
								title: <T>API Ingestion</T>,
								desc: (
									<T>
										Hook directly into your app backend or frontend to
										automatically send usage logs.
									</T>
								),
								icon: <Server className="h-5 w-5" />,
							},
						].map((item, i) => (
							<div
								key={item.key}
								className={`${landingCardClassName} rounded-xl p-6`}
							>
								<div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
									{item.icon}
								</div>
								<h3 className="mb-2 text-lg font-semibold text-foreground">
									{item.title}
								</h3>
								<p className="text-sm text-muted-foreground">{item.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section> */}

      {/* MCP Server Section */}
      <section className="border-t py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              <T>Connect your AI assistant, instantly</T>
            </h2>
            <p className="text-lg text-muted-foreground">
              <T>
                Trackables ships with a built-in MCP server, letting tools like
                Claude and ChatGPT query your data, search logs, and analyze
                survey responses — no custom integration required.
              </T>
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                key: "log-search",
                icon: <Search className="h-5 w-5" />,
                title: <T>Intelligent Log Search</T>,
                desc: (
                  <T>
                    Ask your AI assistant to find specific events, filter by
                    date or field value, and surface patterns across thousands
                    of log entries — all in plain language.
                  </T>
                ),
                example: <T>"Find all errors logged in the last 7 days"</T>,
              },
              {
                key: "survey-sentiment",
                icon: <MessageSquare className="h-5 w-5" />,
                title: <T>Survey Sentiment Analysis</T>,
                desc: (
                  <T>
                    Let AI read and interpret open-ended survey responses at
                    scale. Identify positive trends, recurring complaints, and
                    key themes without reading every reply.
                  </T>
                ),
                example: (
                  <T>"What are customers saying about our checkout flow?"</T>
                ),
              },
              {
                key: "response-summary",
                icon: <Bot className="h-5 w-5" />,
                title: <T>Automated Summarization</T>,
                desc: (
                  <T>
                    Generate concise summaries of your survey results or usage
                    reports on demand. Share AI-written digests with your team
                    directly from your chat interface.
                  </T>
                ),
                example: (
                  <T>"Summarize this week's NPS responses into a report"</T>
                ),
              },
            ].map((item) => (
              <div
                key={item.key}
                className={`${landingCardClassName} group flex flex-col gap-4 p-8`}
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {item.icon}
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-auto rounded-lg border border-dashed border-border bg-muted/40 px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {item.example}
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-border/60 bg-muted/20 p-8 text-center">
            <p className="mb-1 text-sm font-medium text-foreground">
              <T>Works with any MCP-compatible client</T>
            </p>
            <p className="text-sm text-muted-foreground">
              <T>
                Claude, ChatGPT, Cursor, and any tool that supports the Model
                Context Protocol can connect to your Trackables data in seconds.
              </T>
            </p>
          </div>
        </div>
      </section>

      {/* Self Hosting CTA */}
      <section className="border-t py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center sm:px-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-sm">
            <Server className="h-8 w-8" />
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            <T>Deploy to your own infrastructure</T>
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            <T>
              Trackables is fully open-source. For teams requiring strict data
              ownership or isolated network deployments, self-host in minutes
              using Docker.
            </T>
          </p>
          <Link
            href="/self-hosting"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <T>View Self-Hosting Guide</T>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/20 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:px-8 md:flex-row">
          <div className="flex items-center gap-2">
            <AppBrand className="text-xl font-bold tracking-tight opacity-80 grayscale" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Trackables. <T>All rights reserved.</T>
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <T>Terms</T>
            </Link>
            <Link
              href="/privacy"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <T>Privacy</T>
            </Link>
            <Link
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <T>GitHub</T>
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
