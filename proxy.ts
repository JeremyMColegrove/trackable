import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { createNextMiddleware } from "gt-next/middleware"

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/:locale/dashboard(.*)",
])

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect()
  }

  const gtMiddleware = createNextMiddleware({
    prefixDefaultLocale: false,
  })

  return gtMiddleware(request)
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
