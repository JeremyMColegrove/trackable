"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SignOutButton, useAuth } from "@clerk/nextjs";
import { T } from "gt-next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

type LandingAuthActionsProps = {
	section: "navbar" | "hero";
};

export function LandingAuthActions({ section }: LandingAuthActionsProps) {
	const { isLoaded, userId } = useAuth();
	const isSignedIn = isLoaded && Boolean(userId);
	const homeHref = `/`;
	const dashboardHref = `/dashboard`;
	const signInHref = `/sign-in`;
	const signUpHref = `/sign-up`;

	if (!isLoaded) {
		return null;
	}

	if (section === "navbar") {
		return (
			<div className="flex items-center gap-4">
				{isSignedIn ? (
					<>
						<Button asChild size="sm" variant="ghost">
							<Link href={dashboardHref}>
								<T>Dashboard</T>
							</Link>
						</Button>
						<SignOutButton redirectUrl={homeHref}>
							<button
								type="button"
								className={cn(
									buttonVariants({ variant: "default", size: "sm" }),
								)}
							>
								<T>Sign out</T>
							</button>
						</SignOutButton>
					</>
				) : (
					<>
						<Button asChild size="sm" variant="ghost">
							<Link href={signInHref}>
								<T>Sign in</T>
							</Link>
						</Button>
						<Button asChild size="sm">
							<Link href={signUpHref}>
								<T>Sign up</T>
							</Link>
						</Button>
					</>
				)}
			</div>
		);
	}

	return (
		<div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
			{isSignedIn ? (
				<>
					<Button asChild size="lg">
						<Link href={dashboardHref}>
							<T>Open dashboard</T>
							<ArrowRight className="ml-2 size-4" />
						</Link>
					</Button>
					<SignOutButton redirectUrl={homeHref}>
						<Button size="lg" variant="outline">
							<T>Sign out</T>
						</Button>
					</SignOutButton>
				</>
			) : (
				<>
					<Button asChild size="lg">
						<Link href={signUpHref}>
							<T>Start tracking now</T>
							<ArrowRight className="ml-2 size-4" />
						</Link>
					</Button>
					<Button asChild size="lg" variant="outline">
						<Link href={signInHref}>
							<T>Log in to account</T>
						</Link>
					</Button>
				</>
			)}
		</div>
	);
}
