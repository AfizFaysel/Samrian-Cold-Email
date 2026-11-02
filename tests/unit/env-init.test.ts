import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { buildEnv } from "../../scripts/env-init";

const template = readFileSync(".env.example", "utf8");
const read = (env: string, name: string) =>
  env.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.replace(/^["']|["']$/g, "");

describe("buildEnv", () => {
  const env = buildEnv(template);

  test.each(["BETTER_AUTH_SECRET", "UNSUBSCRIBE_SECRET"])("generates %s", (name) => {
    expect(read(env, name)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("generates a keyring the credential module accepts", () => {
    const id = read(env, "CREDENTIAL_ACTIVE_KEY_ID")!;
    const keys = JSON.parse(read(env, "CREDENTIAL_KEYS_JSON")!) as Record<string, string>;

    expect(keys[id]).toMatch(/^[0-9a-f]{64}$/);
  });

  test("gives each database login its own password, safe inside a URL", () => {
    const passwords = [
      "SAMRIAN_APP_DB_PASSWORD",
      "SAMRIAN_AUTH_DB_PASSWORD",
      "SAMRIAN_WORKER_DB_PASSWORD",
    ].map((name) => read(env, name)!);

    expect(new Set(passwords).size).toBe(3);
    for (const password of passwords) expect(password).toMatch(/^[0-9a-f]{32}$/);
  });

  test("selects the Docker runtime with limits on", () => {
    expect(read(env, "JOB_PROVIDER")).toBe("bullmq");
    expect(read(env, "RATE_LIMIT_MODE")).toBe("enforce");
    expect(read(env, "RATE_LIMIT_PROVIDER")).toBe("redis");
    expect(read(env, "TRUSTED_PROXY_MODE")).toBe("single");
  });

  test("leaves no placeholder password behind", () => {
    expect(env).not.toContain('="change-me"');
  });

  test("two runs never share a secret", () => {
    expect(read(buildEnv(template), "BETTER_AUTH_SECRET")).not.toBe(
      read(env, "BETTER_AUTH_SECRET")
    );
  });
});
