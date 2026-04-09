import { AppBrand } from "@/components/app-brand";
import {
	LandingAuthActions,
	LandingAuthActionsSkeleton,
} from "@/components/auth/landing-auth-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { getSelfHostingExamples } from "@/lib/self-hosting-examples";
import { createPageMetadata } from "@/lib/seo";
import { T } from "gt-next";
import {
	ArrowRight,
	CheckCircle2,
	ChevronRight,
	Clock,
	Package,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CodeBlock } from "./code-block";
import { SelfHostingTOC } from "./self-hosting-toc";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;

	return createPageMetadata({
		title: "Self-Hosting Guide",
		description:
			"Learn how to self-host Trackables on your own infrastructure.",
		pathname: "/self-hosting",
		locale,
	});
}

function Step({
	id,
	number,
	title,
	children,
}: {
	id: string;
	number: string;
	title: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div id={id} className="relative scroll-mt-24 pl-8 md:pl-12">
			<div className="absolute top-4 -left-[14px] flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background md:-left-[17px] md:h-8 md:w-8">
				<span className="text-xs font-bold md:text-sm">{number}</span>
			</div>
			<div className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
				<h3 className="mb-3 text-lg font-semibold text-foreground">{title}</h3>
				<div className="prose prose-zinc dark:prose-invert max-w-none text-muted-foreground">
					{children}
				</div>
			</div>
		</div>
	);
}

function SelfHostingGuideExamplesSkeleton() {
	return (
		<>
			{([48, 56, 48, 24] as number[]).map((codeHeight, i) => (
				<div key={i} className="relative pl-8 md:pl-12">
					<div className="absolute top-4 -left-[14px] h-7 w-7 rounded-full bg-muted ring-4 ring-background md:-left-[17px] md:h-8 md:w-8" />
					<div className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
						<Skeleton className="mb-3 h-6 w-48" />
						<Skeleton className="h-4 w-full max-w-sm" />
						<Skeleton
							className="mt-4 rounded-xl"
							style={{ height: `${codeHeight * 4}px` }}
						/>
					</div>
				</div>
			))}
		</>
	);
}

async function SelfHostingGuideExamples() {
	const { envExample, runtimeConfigExample, dockerComposeExample } =
		await getSelfHostingExamples();

	return (
		<>
			<Step id="step-5" number="5" title={<T>Configure .env</T>}>
				<p>
					Create a <code>.env</code> file in your deployment directory. Keep it
					focused on secrets and wiring: database connection, auth keys, Redis,
					and app URL. Docker Compose loads this file directly with{" "}
					<code>env_file: .env</code>.
				</p>
				<CodeBlock code={envExample} label=".env.example" />
			</Step>

			<Step id="step-6" number="6" title={<T>Configure config.json</T>}>
				<p>
					Create a <code>config.json</code> file alongside your{" "}
					<code>.env</code> file. This is where deploy-time app behavior lives:
					plan metadata, limits, usage settings, billing flags, webhook queue
					settings, and other runtime product configuration.
				</p>
				<CodeBlock
					code={runtimeConfigExample}
					label="trackables.config.example.json"
				/>
				<p>
					<T>See the</T>{" "}
					<Link
						href="/self-hosting/config"
						className="font-medium text-primary underline underline-offset-4 hover:no-underline"
					>
						<T>Config Field Reference</T>
					</Link>{" "}
					<T>
						for a full description of every field and how to configure billing
						tiers, limits, and webhooks.
					</T>
				</p>
			</Step>

			<Step id="step-7" number="7" title={<T>Configure docker-compose.yml</T>}>
				<p>
					Create a <code>docker-compose.yml</code> file alongside your{" "}
					<code>.env</code> and <code>config.json</code> files. The standard
					configuration loads all environment variables from <code>.env</code>,
					mounts <code>config.json</code> into the container at{" "}
					<code>/config.json</code>, pulls the latest image, and orchestrates
					the database and Redis containers automatically.
				</p>
				<CodeBlock code={dockerComposeExample} label="docker-compose.yml" />
			</Step>

			<Step id="step-8" number="8" title={<T>Start & Verify</T>}>
				<p>With all three files prepared, start the stack in detached mode:</p>
				<CodeBlock code="docker compose up -d" label="bash" />
				<div className="mt-6 flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-primary">
					<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
					<p className="text-sm font-medium">
						Once initialized, visit{" "}
						<code className="rounded bg-primary/10 px-1 py-0.5">
							http://localhost:3000
						</code>{" "}
						to sign up and sign in. Your first account will be created and
						provisioned in the local database automatically!
					</p>
				</div>
			</Step>
		</>
	);
}

export default async function SelfHostingPage() {
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
				<div className="mx-auto max-w-4xl px-6 text-center sm:px-8">
					<nav className="mb-5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
						<Link href="/" className="transition-colors hover:text-foreground">
							<T>Home</T>
						</Link>
						<ChevronRight className="h-3.5 w-3.5 shrink-0" />
						<span className="font-medium text-foreground">
							<T>Self-Hosting Guide</T>
						</span>
					</nav>
					<h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
						<T>Self-Hosting Guide</T>
					</h1>
					<p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
						<T>
							Deploy Trackables on your own infrastructure in minutes using
							Docker targetting local environments or simple single-server
							setups.
						</T>
					</p>
					<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
						<span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
							<Clock className="h-3.5 w-3.5" />
							<T>~10 min setup</T>
						</span>
						<span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
							<Package className="h-3.5 w-3.5" />
							<T>Docker required</T>
						</span>
					</div>
				</div>
			</section>

			{/* Guide Content */}
			<div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-24 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
				{/* Sticky TOC — desktop only */}
				<aside className="hidden lg:block">
					<div className="sticky top-24">
						<SelfHostingTOC />
					</div>
				</aside>

				{/* Timeline */}
				<div className="relative border-l-2 border-muted md:ml-4">
					<Step id="step-1" number="1" title={<T>What you need</T>}>
						<p>
							To get started locally, you&apos;ll need <strong>Docker</strong>{" "}
							installed along with <strong>Docker Compose</strong>.
							Authentication is fully self-hosted using{" "}
							<strong>better-auth</strong> — no external auth provider required,
							making Trackables suitable for air-gapped or VPN environments.
						</p>
					</Step>

					<Step id="step-2" number="2" title={<T>Auth configuration</T>}>
						<p>
							Trackables uses <strong>better-auth</strong> for email + password
							sign-in and Microsoft (Azure AD) OAuth. Set the following required
							env vars in your <code>.env</code> file:
						</p>
						<ul className="mt-4 list-disc space-y-2 pl-6">
							<li>
								<code>BETTER_AUTH_SECRET</code> — a random 32-byte secret (e.g.{" "}
								<code>openssl rand -hex 32</code>).
							</li>
							<li>
								<code>BETTER_AUTH_URL</code> — your app&apos;s public URL (same
								as <code>NEXT_PUBLIC_APP_URL</code>).
							</li>
							<li>
								<code>MICROSOFT_CLIENT_ID</code>,{" "}
								<code>MICROSOFT_CLIENT_SECRET</code>, and optionally{" "}
								<code>MICROSOFT_TENANT_ID</code> — from your Azure AD app
								registration. Set the redirect URI to{" "}
								<code>{"{your-domain}"}/api/auth/callback/microsoft</code>.
							</li>
						</ul>
					</Step>

					<Step id="step-3" number="3" title={<T>Email (optional)</T>}>
						<p>
							Email verification, password reset, and change-email confirmation
							can be enabled by turning on <code>auth.emailServiceEnabled</code>{" "}
							in <code>config.json</code>. Trackables renders the email HTML and
							enqueues it into Redis for a separate worker or sidecar to send.
						</p>
						<ul className="mt-4 list-disc space-y-2 pl-6">
							<li>
								<code>REDIS_URL</code> must be configured and reachable by both
								this app and your email-sender worker.
							</li>
							<li>
								Default BullMQ queue name: <code>email-queue</code>. Override
								with <code>EMAIL_QUEUE_NAME</code> if your worker expects a
								different queue.
							</li>
							<li>
								Default BullMQ job name: <code>email-queue-job</code>. Override
								with <code>EMAIL_QUEUE_JOB_NAME</code> if needed.
							</li>
						</ul>
						<p className="mt-4">
							In development, Trackables also logs the rendered HTML so you can
							inspect templates locally without running the sender.
						</p>
						<div className="mt-4">
							<CodeBlock
								label="typescript"
								code={`
type EmailQueueJobData = {
  to: string
  subject: string
  html: string
  text: string
  template: "auth.verify-email" | "auth.reset-password" | "auth.change-email"
  metadata: Record<string, unknown> | null
}`}
							/>
						</div>
						<p className="mt-4">
							A sender service only needs to consume that Redis queue, pull the
							rendered HTML/text content, and hand it off to your transport
							provider. Trackables does not enqueue SMTP credentials or sender
							identity in the job payload.
						</p>
						<p className="mt-4">
							For self-hosted deployments, the recommended starting point is to
							fork{" "}
							<a
								href="https://github.com/JeremyMColegrove/trackables-email"
								target="_blank"
								rel="noreferrer"
							>
								trackables-email
							</a>{" "}
							and run it as a sideloaded worker that watches the Redis queue
							and forwards messages to your SMTP server or email provider.
						</p>
					</Step>

					<Step
						id="step-4"
						number="4"
						title={<T>Database & Redis connection</T>}
					>
						<p>
							Trackables requires <strong>PostgreSQL</strong> as the primary
							data store and <strong>Redis</strong> for caching and job queuing.
							The provided Docker Compose handles both automatically, mapping
							them respectively to default ports. For production, you may choose
							to use managed services.
						</p>
					</Step>

					<Suspense fallback={<SelfHostingGuideExamplesSkeleton />}>
						<SelfHostingGuideExamples />
					</Suspense>

					{/* Next step CTA */}
					<div className="mt-4 ml-8 md:ml-12">
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
							<h3 className="text-base font-semibold text-foreground">
								<T>Configure your deployment</T>
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								<T>
									Review every config.json field — limits, billing tiers,
									webhooks, and feature flags.
								</T>
							</p>
							<Link
								href="/self-hosting/config"
								className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
							>
								<T>Config Field Reference</T>
								<ArrowRight className="h-4 w-4" />
							</Link>
						</div>
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
							href="/self-hosting/config"
							className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							<T>Config Reference</T>
						</Link>
					</div>
				</div>
			</footer>
		</main>
	);
}
