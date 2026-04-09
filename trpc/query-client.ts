import {
  isServer,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"

let isRedirectingForAuth = false

export function resetAuthRedirectState() {
  isRedirectingForAuth = false
}

function isUnauthorizedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const data =
    "data" in error && error.data && typeof error.data === "object"
      ? error.data
      : null

  if (data && "code" in data && data.code === "UNAUTHORIZED") {
    return true
  }

  return "message" in error && error.message === "UNAUTHORIZED"
}

function redirectToSignIn() {
  if (isServer || isRedirectingForAuth) {
    return
  }

  isRedirectingForAuth = true

  const redirectUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const signInUrl = "/sign-in"

  window.location.assign(
    `${signInUrl}?redirect_url=${encodeURIComponent(redirectUrl)}`
  )
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isUnauthorizedError(error)) {
          redirectToSignIn()
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isUnauthorizedError(error)) {
          redirectToSignIn()
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: (failureCount, error) => {
          if (isUnauthorizedError(error)) {
            return false
          }

          return failureCount < 3
        },
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient()
  }

  browserQueryClient ??= makeQueryClient()

  return browserQueryClient
}
