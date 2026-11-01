import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const handler = vi.hoisted(() => vi.fn(async () => new Response("served")));

vi.mock("inngest/next", () => ({
  serve: () => ({ GET: handler, POST: handler, PUT: handler }),
}));
vi.mock("../../inngest/functions/index", () => ({ functions: [] }));

const realKey = `signkey-prod-${"ab".repeat(32)}`;

async function call(method: "GET" | "POST" | "PUT") {
  const route = await import("../../src/app/api/inngest/route");
  return route[method](new Request("http://app.test/api/inngest", { method }), {});
}

beforeEach(() => {
  vi.resetModules();
  handler.mockClear();
  vi.stubEnv("INNGEST_DEV", "");
  vi.stubEnv("JOB_PROVIDER", "");
  vi.stubEnv("INNGEST_SIGNING_KEY", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("Inngest endpoint", () => {
  test.each(["GET", "POST", "PUT"] as const)("is closed for %s under BullMQ", async (method) => {
    vi.stubEnv("JOB_PROVIDER", "bullmq");
    vi.stubEnv("INNGEST_SIGNING_KEY", realKey);

    const response = await call(method);

    expect(response.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  test.each([
    ["the shipped placeholder", "local"],
    ["an empty key", ""],
    ["a key with no secret", "signkey-prod-"],
    ["a non-hex secret", "signkey-prod-change-me"],
  ])("refuses to serve production with %s", async (_name, key) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INNGEST_SIGNING_KEY", key);

    const response = await call("POST");

    expect(response.status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
  });

  test("serves production with a real signing key", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JOB_PROVIDER", "inngest");
    vi.stubEnv("INNGEST_SIGNING_KEY", realKey);

    const response = await call("POST");

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  test("keeps local development working without a signing key", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INNGEST_DEV", "1");

    const response = await call("POST");

    expect(response.status).toBe(200);
  });
});

describe("Inngest client mode", () => {
  test("production ignores INNGEST_DEV, which would skip signature checks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INNGEST_DEV", "1");

    const { inngest } = await import("../../inngest/client");

    expect(inngest.mode).toBe("cloud");
  });

  test("development still honours INNGEST_DEV", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INNGEST_DEV", "1");

    const { inngest } = await import("../../inngest/client");

    expect(inngest.mode).toBe("dev");
  });
});
