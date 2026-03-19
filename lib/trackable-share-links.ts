import { db } from "@/db"

export function getShareLinkQuery() {
  return {
    with: {
      trackable: {
        with: {
          workspace: {
            columns: {
              name: true,
            },
          },
          activeForm: {
            with: {
              fields: true,
            },
          },
        },
      },
    },
  } as const
}

export async function getShareLinkByToken(token: string) {
  return db.query.trackableShareLinks.findFirst({
    where: (table, { eq }) => eq(table.token, token),
    ...getShareLinkQuery(),
  })
}

export async function getActiveShareLink(token: string) {
  return db.query.trackableShareLinks.findFirst({
    where: (table, { and, eq, isNull, or, gt }) =>
      and(
        eq(table.token, token),
        isNull(table.revokedAt),
        or(isNull(table.expiresAt), gt(table.expiresAt, new Date()))
      ),
    ...getShareLinkQuery(),
  })
}

export function requiresAuthenticatedSharedFormAccess(
  settings: {
    allowAnonymousSubmissions?: boolean
  } | null
) {
  return settings?.allowAnonymousSubmissions === false
}
