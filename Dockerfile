FROM node:24.14.1-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts  

FROM deps AS builder
WORKDIR /app
COPY . .

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS=--disable-proto=throw
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system nodejs && useradd --system --gid nodejs --shell /usr/sbin/nologin nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --chown=nextjs:nodejs scripts/run-migrations.mjs ./scripts/run-migrations.mjs

RUN chmod +x /app/scripts/docker-entrypoint.sh && mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["./scripts/docker-entrypoint.sh"]
