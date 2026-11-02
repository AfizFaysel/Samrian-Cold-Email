import { beforeEach, describe, expect, test, vi } from "vitest";

import { GET as click } from "../../src/app/api/track/click/[token]/route";
import { GET as open } from "../../src/app/api/track/open/[token]/route";
import { withTenant, withTrackingToken } from "../../src/server/db/tenant";
import { RateLimitUnavailableError } from "../../src/server/limits/degraded";
import { withTrackingLimit } from "../../src/server/limits/http";
import { MemoryRateLimiter } from "../../src/server/limits/memory";

const guard = vi.hoisted(() => ({ checkPublic: vi.fn() }));
const originalUrl = "https://example.com/offer";

vi.mock("../../src/server/limits", async (original) => ({
  ...(await original<typeof import("../../src/server/limits")>()),
  getLimitGuard: () => guard,
}));
vi.mock("../../src/server/db/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("../../src/server/db/tenant", () => ({
  withTenant: vi.fn(async () => undefined),
  withTrackingToken: vi.fn(),
}));

const allowed = {
  allowed: true,
  policyId: "public.tracking",
  limit: 120,
  remaining: 119,
  retryAfterMs: 0,
  resetAt: 0,
};
const denied = { ...allowed, allowed: false, remaining: 0, retryAfterMs: 1000 };

const context = { params: Promise.resolve({ token: "token_1" }) };
const request = (path: string) => new Request(`http://localhost/api/track/${path}/token_1`);

describe("tracking when the limiter says no", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTrackingToken).mockResolvedValue({ orgId: "org_1", originalUrl } as never);
  });

  test("records and redirects normally", async () => {
    guard.checkPublic.mockResolvedValue(allowed);

    const response = await click(request("click"), context);

    expect(response.headers.get("location")).toBe(originalUrl);
    expect(withTenant).toHaveBeenCalled();
  });

  test.each([
    ["an outage", () => guard.checkPublic.mockRejectedValue(new RateLimitUnavailableError())],
    ["a busy address", () => guard.checkPublic.mockResolvedValue(denied)],
  ])("a recipient's click still reaches the link during %s", async (_name, arrange) => {
    arrange();

    const response = await click(request("click"), context);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(originalUrl);
    expect(withTenant).not.toHaveBeenCalled();
  });

  test("an unknown token stays a 404 even during an outage", async () => {
    guard.checkPublic.mockRejectedValue(new RateLimitUnavailableError());
    vi.mocked(withTrackingToken).mockResolvedValue(null as never);

    expect((await click(request("click"), context)).status).toBe(404);
  });

  test("the pixel still loads and costs no database work", async () => {
    guard.checkPublic.mockRejectedValue(new RateLimitUnavailableError());

    const response = await open(request("open"), context);

    expect(response.headers.get("content-type")).toBe("image/gif");
    expect(withTrackingToken).not.toHaveBeenCalled();
  });

  test("unrecorded fallback work is capped", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    const options = {
      guard: { checkPublic: vi.fn(async () => denied) } as never,
      fallback: new MemoryRateLimiter(),
      fallbackPerMinute: 1,
    };

    const first = await withTrackingLimit(request("click"), "tracking.click", handler, options);
    const second = await withTrackingLimit(request("click"), "tracking.click", handler, options);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(false);
  });
});
