import { trace } from "@opentelemetry/api";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createErrorReporter, normalizeError } from "../../../src/server/observability/errors";
import { redact } from "../../../src/server/observability/redact";
import { createTracer } from "../../../src/server/observability/trace";

const query = 'insert into "threads" ("body", "from_email") values ($1, $2)';
const secrets = ["secret body", "still secret", "bob@example.com"];

function failedQuery() {
  return new DrizzleQueryError(
    query,
    ["Hi, secret body\n    at still secret", "bob@example.com"],
    new Error("duplicate key")
  );
}

function expectNoSecrets(value: unknown) {
  const text = JSON.stringify(value);
  for (const secret of secrets) expect(text).not.toContain(secret);
}

afterEach(() => vi.restoreAllMocks());

describe("failed query errors", () => {
  test("normalizing keeps the query and drops bound values", () => {
    const normalized = normalizeError(failedQuery());

    expectNoSecrets(normalized);
    expect(normalized.message).toBe(`Failed query: ${query}`);
    expect(normalized.stack).toContain("query-errors.test");
  });

  test("redacting an error nested in log fields drops bound values", () => {
    expectNoSecrets(redact({ failure: failedQuery() }));
  });

  test("the error reporter logs no bound values", () => {
    const error = vi.fn();

    createErrorReporter({ logger: { error } }).capture(failedQuery());

    expectNoSecrets(error.mock.calls);
  });

  test("leaves other errors unchanged", () => {
    expect(normalizeError(new Error("provider failed")).message).toBe("provider failed");
  });
});

describe("span telemetry", () => {
  function spanSpy() {
    const span = {
      setAttribute: vi.fn(),
      recordException: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
    };
    vi.spyOn(trace, "getTracer").mockReturnValue({
      startActiveSpan: (_name: string, fn: (value: typeof span) => unknown) => fn(span),
    } as never);
    return span;
  }

  test("records failed queries without bound values", async () => {
    const span = spanSpy();
    const tracer = createTracer({ logger: { debug: vi.fn(), error: vi.fn() } });

    await expect(
      tracer.span("campaign.send", {}, async () => {
        throw failedQuery();
      })
    ).rejects.toThrow();

    expect(span.recordException).toHaveBeenCalledOnce();
    expectNoSecrets(span.recordException.mock.calls);
  });

  test("redacts span attributes", async () => {
    const span = spanSpy();
    const tracer = createTracer({ logger: { debug: vi.fn(), error: vi.fn() } });

    await tracer.span("mailbox.check", { smtpPassword: "hunter2", jobName: "check" }, async () => 1);

    expect(span.setAttribute).toHaveBeenCalledWith("smtpPassword", "[REDACTED]");
    expect(span.setAttribute).toHaveBeenCalledWith("jobName", "check");
  });
});
