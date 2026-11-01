import { Inngest } from "inngest";

export function readInngestConcurrency(env: Record<string, string | undefined> = process.env) {
  const raw = env.INNGEST_CONCURRENCY ?? "5";
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new Error("INNGEST_CONCURRENCY must be a positive integer");
  }

  return {
    limit: Number(raw),
    key: '"samrian"',
    scope: "account" as const,
  };
}

// The SDK accepts any non-empty string as a key, so a placeholder would let anyone sign requests.
const SIGNING_KEY = /^signkey-\w+-[0-9a-f]{32,}$/i;

export function readInngestEndpoint(env: Record<string, string | undefined> = process.env) {
  if ((env.JOB_PROVIDER || "inngest") !== "inngest") return "disabled";
  if (env.NODE_ENV === "production" && !SIGNING_KEY.test(env.INNGEST_SIGNING_KEY ?? "")) {
    return "misconfigured";
  }
  return "open";
}

export const inngestConcurrency = readInngestConcurrency();

export const inngest = new Inngest({
  id: "cold-email",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  // Dev mode skips signature checks, and the SDK would otherwise enable it from INNGEST_DEV.
  ...(process.env.NODE_ENV === "production" && { isDev: false }),
});
