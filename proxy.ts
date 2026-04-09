import { getSessionCookie } from "better-auth/cookies";
import { createNextMiddleware } from "gt-next/middleware";
import { type NextRequest, NextResponse } from "next/server";

const isProtectedRoute = (pathname: string) =>
	/^\/dashboard(\/.*)?$/.test(pathname) ||
	/^\/[^/]+\/dashboard(\/.*)?$/.test(pathname);

export default async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Keep locale middleware off API handlers, well-known endpoints, and docs.
	if (
		pathname.startsWith("/api/") ||
		pathname === "/api" ||
		pathname.startsWith("/.well-known/") ||
		pathname.startsWith("/docs/")
	) {
		return NextResponse.next();
	}

	if (isProtectedRoute(pathname)) {
		const sessionCookie = getSessionCookie(request);
		if (!sessionCookie) {
			const signInUrl = new URL("/sign-in", request.url);
			signInUrl.searchParams.set("redirect_url", pathname);
			return NextResponse.redirect(signInUrl);
		}
	}

	const gtMiddleware = createNextMiddleware({
		prefixDefaultLocale: false,
	});

	return gtMiddleware(request);
}

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|txt|xml|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		"/(api|trpc)(.*)",
	],
};
