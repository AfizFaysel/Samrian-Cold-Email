import { isIP } from "node:net";

import type { LimitGuard, RateLimiter } from "../modules/limits";
import { getLimitGuard } from "./index";
import { RateLimitUnavailableError } from "./degraded";
import { MemoryRateLimiter } from "./memory";

export type TrustedProxyMode = "none" | "single";

const TRACKING_FALLBACK_PER_MINUTE = 6000;
const trackingFallback = new MemoryRateLimiter();

export function getClientIp(headers: Headers, mode: TrustedProxyMode): string {
  if (mode === "none") return "unknown";
  const value = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return value && isIP(value) ? value : "unknown";
}

export function limitHeaders(
  decision: Awaited<ReturnType<LimitGuard["checkPublic"]>>,
  now: () => number = Date.now
): Record<string, string> {
  return {
    "ratelimit-policy": decision.policyId,
    "ratelimit-limit": String(decision.limit),
    "ratelimit-remaining": String(decision.remaining),
    "ratelimit-reset": String(Math.max(0, Math.ceil((decision.resetAt - now()) / 1000))),
    ...(decision.allowed
      ? {}
      : { "retry-after": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))) }),
  };
}

export function rateLimitResponse(
  decision: Awaited<ReturnType<LimitGuard["checkPublic"]>>
): Response {
  return Response.json(
    { error: { code: "RATE_LIMITED", message: "Rate limit exceeded" } },
    { status: 429, headers: limitHeaders(decision) }
  );
}

// A recipient clicking a link is not abuse, so when limits say no the link still works and only
// the analytics are skipped. The per-process cap keeps that lookup bounded.
export async function withTrackingLimit(
  request: Request,
  operationId: string,
  handler: (record: boolean) => Promise<Response>,
  options: {
    guard?: LimitGuard;
    proxyMode?: TrustedProxyMode;
    fallback?: RateLimiter;
    fallbackPerMinute?: number;
  } = {}
): Promise<Response> {
  const guard = options.guard ?? getLimitGuard();
  const subject = getClientIp(
    request.headers,
    options.proxyMode ?? (process.env.TRUSTED_PROXY_MODE === "single" ? "single" : "none")
  );

  let refused: Response;
  try {
    const decision = await guard.checkPublic({ operationId, subject });
    if (decision.allowed) {
      const response = await handler(true);
      for (const [name, value] of Object.entries(limitHeaders(decision))) {
        response.headers.set(name, value);
      }
      return response;
    }
    refused = rateLimitResponse(decision);
  } catch (error) {
    if (!(error instanceof RateLimitUnavailableError)) throw error;
    refused = Response.json(
      { error: { code: "PROVIDER_UNAVAILABLE", message: error.message } },
      { status: 503 }
    );
  }

  const spare = await (options.fallback ?? trackingFallback).consume({
    policyId: "tracking.fallback",
    subject: "process",
    limit: options.fallbackPerMinute ?? TRACKING_FALLBACK_PER_MINUTE,
    windowMs: 60_000,
    cost: 1,
  });
  return spare.allowed ? handler(false) : refused;
}

export async function withPublicLimit(
  request: Request,
  operationId: string,
  handler: (request: Request) => Promise<Response>,
  options: {
    guard?: LimitGuard;
    proxyMode?: TrustedProxyMode;
    penalizeStatuses?: number[];
  } = {}
): Promise<Response> {
  const guard = options.guard ?? getLimitGuard();
  const subject = getClientIp(
    request.headers,
    options.proxyMode ?? (process.env.TRUSTED_PROXY_MODE === "single" ? "single" : "none")
  );
  let decision;
  try {
    decision = await guard.checkPublic({ operationId, subject });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return Response.json(
        { error: { code: "PROVIDER_UNAVAILABLE", message: error.message } },
        { status: 503 }
      );
    }
    throw error;
  }
  if (!decision.allowed) {
    return rateLimitResponse(decision);
  }

  const response = await handler(request);
  if (options.penalizeStatuses?.includes(response.status)) {
    await guard.checkPublic({ operationId, subject, penalty: true });
  }
  for (const [name, value] of Object.entries(limitHeaders(decision))) {
    response.headers.set(name, value);
  }
  return response;
}
