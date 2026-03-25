import { AppBrand } from "@/components/app-brand";
import { LandingAuthActions } from "@/components/auth/landing-auth-actions";
import { T } from "gt-next";
import Link from "next/link";

export function LandingPage() {
	return (
		<main className="flex min-h-svh flex-col bg-background">
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
				<div className="flex h-16 w-full items-center justify-between px-6 sm:px-8">
					<AppBrand className="text-lg font-bold tracking-tighter" />
					<div className="flex items-center gap-4">
						<LandingAuthActions section="navbar" />
					</div>
				</div>
			</header>

			<div className="relative flex flex-col items-center justify-center border-b py-24 sm:py-32">
				<div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[32px_32px] opacity-20" />
				<div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 text-center lg:px-8">
					<h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tighter text-foreground sm:gap-4 sm:text-6xl md:text-7xl">
						<span>
							<T>Tracking for your team.</T>
						</span>
					</h1>

					<LandingAuthActions section="hero" />
				</div>
			</div>

			<section className="bg-background py-16 sm:py-24">
				<div className="mx-auto max-w-6xl px-6 sm:px-8">
					<div className="grid gap-12 md:grid-cols-3 md:gap-8">
						<div className="flex flex-col border-l-2 border-primary/30 pl-6">
							<span className="text-3xl font-bold tracking-tighter text-foreground">
								<T>01</T>
							</span>
							<h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
								<T>Simple interface</T>
							</h3>
							<p className="mt-2 text-base leading-relaxed text-muted-foreground">
								<T>
									A clean dashboard that keeps trackables, responses, and usage
									easy to manage without extra complexity.
								</T>
							</p>
						</div>
						<div className="flex flex-col border-l-2 border-border pl-6">
							<span className="text-3xl font-bold tracking-tighter text-muted-foreground">
								<T>02</T>
							</span>
							<h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
								<T>Fast surveys and tracking</T>
							</h3>
							<p className="mt-2 text-base leading-relaxed text-muted-foreground">
								<T>
									Create surveys or log ingestion trackables quickly, so each
									response and event stream has a focused home.
								</T>
							</p>
						</div>
						<div className="flex flex-col border-l-2 border-border pl-6">
							<span className="text-3xl font-bold tracking-tighter text-muted-foreground">
								<T>03</T>
							</span>
							<h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
								<T>Share with your team</T>
							</h3>
							<p className="mt-2 text-base leading-relaxed text-muted-foreground">
								<T>
									Invite teammates, share access where needed, and keep everyone
									aligned around the same trackable items.
								</T>
							</p>
						</div>
					</div>
				</div>
			</section>

			<footer className="border-t py-12">
				<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row sm:px-8">
					<p className="text-sm text-muted-foreground">
						© {new Date().getFullYear()}{" "}
						<T>Trackable Inc. All rights reserved.</T>
					</p>
					<div className="flex gap-4">
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
							href="https://github.com/JeremyMColegrove/trackable"
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
	);
}
