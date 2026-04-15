import { T } from "gt-next"
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react"
import { ConfigTOC } from "./config-toc"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { AppBrand } from "@/components/app-brand"
import {
  LandingAuthActions,
  LandingAuthActionsSkeleton,
} from "@/components/auth/landing-auth-actions"
import { Skeleton } from "@/components/ui/skeleton"
import { createPageMetadata } from "@/lib/seo"
import { getSelfHostingExamples } from "@/lib/self-hosting-examples"
import { CodeBlock } from "../code-block"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return createPageMetadata({
    title: "Config Field Reference",
    description:
      "Complete reference for every field in the Trackables config.json file.",
    pathname: "/self-hosting/config",
    locale,
  })
}

type FieldRow = {
  field: string
  type: string
  required: "Required" | "Optional"
  description: React.ReactNode
}

function FieldTable({ rows }: { rows: FieldRow[] }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-semibold text-foreground">
              <T>Field</T>
            </th>
            <th className="px-4 py-3 text-left font-semibold text-foreground">
              <T>Type</T>
            </th>
            <th className="px-4 py-3 text-left font-semibold text-foreground">
              <T>Required</T>
            </th>
            <th className="px-4 py-3 text-left font-semibold text-foreground">
              <T>Description</T>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.field}
              className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
            >
              <td className="px-4 py-3 font-mono text-xs text-primary">
                {row.field}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {row.type}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    row.required === "Required"
                      ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {row.required === "Required" ? (
                    <T>Required</T>
                  ) : (
                    <T>Optional</T>
                  )}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="group mb-1 flex items-center gap-2 text-2xl font-bold text-foreground">
        {title}
        <a
          href={`#${id}`}
          className="text-lg text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
          aria-label={`Link to ${id} section`}
        >
          #
        </a>
      </h2>
      <hr className="mb-6 border-muted" />
      {children}
    </section>
  )
}

function ConfigExampleSkeleton() {
  return <Skeleton className="h-48 rounded-xl" />
}

async function ConfigExample() {
  const { runtimeConfigExample } = await getSelfHostingExamples()
  return (
    <CodeBlock
      code={runtimeConfigExample}
      label="trackables.config.example.json"
    />
  )
}

export default async function ConfigReferencePage() {
  return (
    <main className="flex min-h-svh flex-col bg-background selection:bg-primary/10">
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
      <section className="relative border-b bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 sm:px-8">
          <nav className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              <T>Home</T>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <Link
              href="/self-hosting"
              className="transition-colors hover:text-foreground"
            >
              <T>Self-Hosting Guide</T>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">
              <T>Config Reference</T>
            </span>
          </nav>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            <T>Config Field Reference</T>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            <T>Complete reference for every field in</T>{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-medium text-foreground">
              config.json
            </code>
            {". "}
            <T>
              This file controls runtime product behavior — plan limits, auth
              email delivery, billing, webhooks, and feature flags. It is
              separate from
            </T>{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-medium text-foreground">
              .env
            </code>
            <T>, which holds secrets and infrastructure wiring.</T>
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        {/* Sticky TOC — desktop only */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <ConfigTOC />
          </div>
        </aside>

        {/* Sections */}
        <div className="space-y-16">
          {/* Quick Start Example */}
          <div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              <T>Starter Example</T>
            </h2>
            <hr className="mb-6 border-muted" />
            <p className="mb-2 text-muted-foreground">
              <T>
                This is the recommended starting point for a self-hosted
                deployment with no billing configured. All limits are set to
              </T>{" "}
              <code>null</code>{" "}
              <T>(unlimited), and billing features are disabled. Replace</T>{" "}
              <code>your-email@example.com</code> <T>with your own address.</T>
            </p>
            <Suspense fallback={<ConfigExampleSkeleton />}>
              <ConfigExample />
            </Suspense>
          </div>

          {/* admins */}
          <Section id="admins" title={<T>admins</T>}>
            <p className="mb-4 text-muted-foreground">
              <T>
                An array of email addresses that are granted site admin access.
                Admins can access privileged pages such as the batch process
                scheduler and system-wide usage dashboards.
              </T>
            </p>
            <FieldTable
              rows={[
                {
                  field: "admins",
                  type: "string[]",
                  required: "Required",
                  description: (
                    <T>
                      List of email addresses with admin access. Must match the
                      email associated with the user&apos;s Trackables account.
                    </T>
                  ),
                },
              ]}
            />
          </Section>

          {/* features */}
          <Section id="auth" title={<T>auth</T>}>
            <p className="mb-4 text-muted-foreground">
              <T>
                Auth-specific runtime settings. Email delivery is opt-in and
                uses a Redis-backed queue rather than direct SMTP delivery from
                the app process.
              </T>
            </p>
            <FieldTable
              rows={[
                {
                  field: "emailServiceEnabled",
                  type: "boolean",
                  required: "Required",
                  description: (
                    <T>
                      When true, auth emails are rendered with React Email and
                      enqueued into Redis for a separate sender process or
                      sideloaded worker. When false, verification, password
                      reset, and change-email flows are disabled.
                    </T>
                  ),
                },
              ]}
            />
          </Section>

          {/* features */}
          <Section id="features" title={<T>features</T>}>
            <p className="mb-4 text-muted-foreground">
              <T>
                Feature flags that control which parts of the product UI are
                active. For simple self-hosted deployments, you can disable all
                billing features and leave only the scheduler flag if needed.
              </T>
            </p>
            <FieldTable
              rows={[
                {
                  field: "subscriptionEnforcementEnabled",
                  type: "boolean",
                  required: "Required",
                  description: (
                    <T>
                      When true, users can view and upgrade to paid plans. When
                      false, the upgrade UI shows a billing coming soon
                      placeholder instead.
                    </T>
                  ),
                },
                {
                  field: "workspaceBillingEnabled",
                  type: "boolean",
                  required: "Required",
                  description: (
                    <T>
                      When true, billing tiers and plan information appear in
                      the sidebar and workspace settings. Set to false to hide
                      all billing UI entirely.
                    </T>
                  ),
                },
                {
                  field: "batchSchedulerEnabled",
                  type: "boolean",
                  required: "Required",
                  description: (
                    <T>
                      When true, the batch process scheduler is active and
                      admin-accessible. Requires Redis and BullMQ to be running.
                    </T>
                  ),
                },
                {
                  field: "customMCPServerTokens",
                  type: "boolean",
                  required: "Required",
                  description: (
                    <T>
                      When false, the MCP server authenticates using the
                      built-in OAuth bearer tokens issued by Trackables. When
                      true, self-managed API tokens are used instead — useful
                      for environments where you want MCP access to bypass the
                      built-in OAuth flow.
                    </T>
                  ),
                },
                {
                  field: "webhooks",
                  type: 'boolean | ("teams" | "general" | "discord")[]',
                  required: "Required",
                  description: (
                    <T>
                      Controls which webhook provider types are available. Set
                      to true to enable all providers (generic, Microsoft Teams,
                      Discord), false to disable webhooks entirely, or an array
                      of provider names to enable a specific subset.
                    </T>
                  ),
                },
              ]}
            />
          </Section>

          {/* limits */}
          <Section id="limits" title={<T>limits</T>}>
            <p className="mb-4 text-muted-foreground">
              <T>
                An array of limit sets that control resource usage. Each entry
                can be tied to a billing tier via
              </T>{" "}
              <code>billingTier</code>
              <T>, or set to</T> <code>null</code>{" "}
              <T>
                to apply to all users regardless of plan. For simple deployments
                with no billing, a single entry with
              </T>{" "}
              <code>&quot;billingTier&quot;: null</code> <T>is sufficient.</T>{" "}
              <code>null</code> <T>values for numeric limits mean unlimited.</T>
            </p>
            <FieldTable
              rows={[
                {
                  field: "id",
                  type: "string",
                  required: "Required",
                  description: (
                    <T>
                      Unique identifier for this limit set (e.g. free, pro,
                      default).
                    </T>
                  ),
                },
                {
                  field: "maxTrackableItems",
                  type: "number",
                  required: "Required",
                  description: (
                    <T>
                      Maximum number of trackable items (forms + API endpoints)
                      a user can create per workspace.
                    </T>
                  ),
                },
                {
                  field: "maxResponsesPerSurvey",
                  type: "number | null",
                  required: "Required",
                  description: (
                    <T>
                      Maximum number of responses allowed per survey/form. null
                      means unlimited.
                    </T>
                  ),
                },
                {
                  field: "maxWorkspaceMembers",
                  type: "number | null",
                  required: "Required",
                  description: (
                    <T>
                      Maximum number of members in a workspace. null means
                      unlimited.
                    </T>
                  ),
                },
                {
                  field: "maxApiLogsPerMinute",
                  type: "number",
                  required: "Required",
                  description: (
                    <T>
                      Maximum number of log events that can be ingested per
                      minute per trackable item. Excess requests are
                      rate-limited.
                    </T>
                  ),
                },
                {
                  field: "maxApiPayloadBytes",
                  type: "number",
                  required: "Required",
                  description: (
                    <T>
                      Maximum size in bytes of a single log payload. Requests
                      larger than this are rejected.
                    </T>
                  ),
                },
                {
                  field: "logRetentionDays",
                  type: "number",
                  required: "Required",
                  description: (
                    <T>
                      Number of days log entries are retained before being
                      purged. Applies to all logs within this tier.
                    </T>
                  ),
                },
                {
                  field: "maxCreatedWorkspaces",
                  type: "number | null",
                  required: "Required",
                  description: (
                    <T>
                      Maximum number of workspaces a single user can create.
                      null means unlimited.
                    </T>
                  ),
                },
                {
                  field: "billingTier",
                  type: "string | null",
                  required: "Required",
                  description: (
                    <T>
                      The billing tier ID this limit applies to. Must match an
                      id in the billing.tiers array. Set to null to apply this
                      limit to all users regardless of plan.
                    </T>
                  ),
                },
              ]}
            />
          </Section>

          {/* billing */}
          <Section id="billing" title={<T>billing</T>}>
            <p className="mb-4 text-muted-foreground">
              <T>
                Optional billing configuration for Lemon Squeezy integration. If
                you are not using paid plans, set
              </T>{" "}
              <code>lemonSqueezyStoreId</code> <T>and</T> <code>manageUrl</code>{" "}
              <T>to</T> <code>null</code> <T>and leave</T> <code>tiers</code>{" "}
              <T>
                as an empty array. Tier id values are referenced by
                limits[].billingTier — they must match exactly.
              </T>
            </p>
            <FieldTable
              rows={[
                {
                  field: "lemonSqueezyStoreId",
                  type: "string | null",
                  required: "Optional",
                  description: (
                    <T>
                      Your Lemon Squeezy store ID. Required if you are
                      processing payments through Lemon Squeezy.
                    </T>
                  ),
                },
                {
                  field: "manageUrl",
                  type: "string | null",
                  required: "Optional",
                  description: (
                    <T>
                      URL to the billing management page shown to users.
                      Typically your Lemon Squeezy customer portal URL.
                    </T>
                  ),
                },
              ]}
            />

            <h3 className="mt-8 mb-4 text-lg font-semibold text-foreground">
              billing.tiers[]
            </h3>
            <p className="mb-4 text-muted-foreground">
              <T>
                Array of billing tiers displayed in the upgrade UI. Each tier
                must have a unique id that matches a corresponding entry in
                limits[].billingTier.
              </T>
            </p>
            <FieldTable
              rows={[
                {
                  field: "id",
                  type: "string",
                  required: "Required",
                  description: (
                    <T>
                      Unique tier identifier. Referenced by
                      limits[].billingTier.
                    </T>
                  ),
                },
                {
                  field: "name",
                  type: "string",
                  required: "Required",
                  description: (
                    <T>Display name shown to users (e.g. Pro, Team).</T>
                  ),
                },
                {
                  field: "priceLabel",
                  type: "string",
                  required: "Required",
                  description: <T>Price string shown in the UI (e.g. $25).</T>,
                },
                {
                  field: "priceInterval",
                  type: "string",
                  required: "Required",
                  description: (
                    <T>
                      Billing interval shown below the price (e.g. per month).
                    </T>
                  ),
                },
                {
                  field: "description",
                  type: "string",
                  required: "Required",
                  description: (
                    <T>Short description of what this tier includes.</T>
                  ),
                },
                {
                  field: "tone",
                  type: '"neutral" | "accent" | "strong"',
                  required: "Required",
                  description: (
                    <T>
                      Visual theme of the tier card. accent and strong are
                      highlighted styles; neutral is the default.
                    </T>
                  ),
                },
                {
                  field: "mostPopular",
                  type: "boolean",
                  required: "Required",
                  description: (
                    <T>
                      When true, shows a Most Popular badge on this tier card.
                    </T>
                  ),
                },
                {
                  field: "lemonSqueezyVariantId",
                  type: "string | null",
                  required: "Optional",
                  description: (
                    <T>
                      Lemon Squeezy product variant ID for this tier. Required
                      for checkout to work.
                    </T>
                  ),
                },
                {
                  field: "enabled",
                  type: "boolean",
                  required: "Required",
                  description: (
                    <T>
                      When false, this tier is hidden from the upgrade UI even
                      if billing is enabled.
                    </T>
                  ),
                },
              ]}
            />
          </Section>

          {/* webhooks */}
          <Section id="webhooks" title={<T>webhooks</T>}>
            <p className="mb-4 text-muted-foreground">
              <T>
                Controls the outbound webhook delivery queue backed by Redis and
                BullMQ. Rate limiting here applies to the queue consumer, not to
                inbound log ingestion.
              </T>
            </p>
            <FieldTable
              rows={[
                {
                  field: "queue.enabled",
                  type: "boolean",
                  required: "Required",
                  description: (
                    <T>
                      When true, outbound webhooks are queued in Redis and
                      delivered asynchronously. Requires Redis to be running.
                    </T>
                  ),
                },
                {
                  field: "queue.rateLimitMs",
                  type: "number",
                  required: "Required",
                  description: (
                    <T>
                      Minimum milliseconds to wait between consecutive webhook
                      deliveries from the queue.
                    </T>
                  ),
                },
                {
                  field: "queue.rateLimitMax",
                  type: "number",
                  required: "Required",
                  description: (
                    <T>
                      Maximum number of webhook events that can be sent within
                      the rateLimitMs window.
                    </T>
                  ),
                },
              ]}
            />
          </Section>

          {/* batch */}
          <Section id="batch" title={<T>batch</T>}>
            <p className="mb-4 text-muted-foreground">
              <T>
                Configuration for the background batch scheduler. The scheduler
                must also be enabled via
              </T>{" "}
              <code>features.batchSchedulerEnabled</code>
              <T>.</T>
            </p>
            <FieldTable
              rows={[
                {
                  field: "schedulerTimeZone",
                  type: "string",
                  required: "Required",
                  description: (
                    <T>
                      IANA timezone string used for scheduling batch jobs (e.g.
                      UTC, America/New_York). Affects when cron-based jobs
                      trigger.
                    </T>
                  ),
                },
              ]}
            />
          </Section>

          {/* Bottom nav */}
          <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center">
            <Link
              href="/self-hosting"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <T>Back to Self-Hosting Guide</T>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline sm:ml-auto"
            >
              <T>Go to Dashboard</T>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <footer className="mt-auto border-t bg-muted/20 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:px-8 md:flex-row">
          <div className="flex items-center gap-2">
            <AppBrand className="text-xl font-bold tracking-tight opacity-80 grayscale" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Trackables. <T>All rights reserved.</T>
          </p>
          <div className="flex gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <T>Home</T>
            </Link>
            <Link
              href="/self-hosting"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <T>Self-Hosting Guide</T>
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
