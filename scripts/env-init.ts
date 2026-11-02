import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const hex = (bytes: number) => randomBytes(bytes).toString("hex");

export function buildEnv(template: string): string {
  const keyId = new Date().toISOString().slice(0, 7);
  const values: Record<string, string> = {
    BETTER_AUTH_SECRET: hex(32),
    UNSUBSCRIBE_SECRET: hex(32),
    CREDENTIAL_ACTIVE_KEY_ID: keyId,
    CREDENTIAL_KEYS_JSON: `'${JSON.stringify({ [keyId]: hex(32) })}'`,
    SAMRIAN_APP_DB_PASSWORD: hex(16),
    SAMRIAN_AUTH_DB_PASSWORD: hex(16),
    SAMRIAN_WORKER_DB_PASSWORD: hex(16),
    JOB_PROVIDER: "bullmq",
    REDIS_URL: "redis://redis:6379",
    RATE_LIMIT_MODE: "enforce",
    RATE_LIMIT_PROVIDER: "redis",
    TRUSTED_PROXY_MODE: "single",
  };

  return Object.entries(values).reduce(
    (env, [name, value]) => env.replace(new RegExp(`^${name}=.*$`, "m"), `${name}=${value}`),
    template
  );
}

if (process.argv[1]?.endsWith("env-init.ts")) {
  if (existsSync(".env")) {
    process.stderr.write(".env already exists, so nothing was changed.\n");
    process.exit(1);
  }
  writeFileSync(".env", buildEnv(readFileSync(".env.example", "utf8")));
  process.stdout.write(
    "Wrote .env with generated secrets. Set NEXT_PUBLIC_APP_URL for a server.\n"
  );
}
