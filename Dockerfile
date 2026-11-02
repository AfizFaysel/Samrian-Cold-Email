FROM oven/bun:1.4.0 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
RUN bun install --frozen-lockfile

FROM oven/bun:1.4.0 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js fixes NEXT_PUBLIC_ values at build time, so they cannot arrive only at runtime.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SOURCE_URL
ARG NEXT_PUBLIC_AUTH_PROVIDER
ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SOURCE_URL=$NEXT_PUBLIC_SOURCE_URL
ENV NEXT_PUBLIC_AUTH_PROVIDER=$NEXT_PUBLIC_AUTH_PROVIDER
ENV NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=$NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN bun run build

FROM oven/bun:1.4.0 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/server/worker ./src/server/worker
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/LICENSE ./LICENSE
COPY --from=builder /app/LICENSING.md ./LICENSING.md
COPY --from=builder /app/NOTICE ./NOTICE
USER bun
EXPOSE 3000
CMD ["bun", "run", "start"]
