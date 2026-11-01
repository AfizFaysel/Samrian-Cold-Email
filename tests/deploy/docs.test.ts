import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

describe("deployment artifacts", () => {
  test("production artifacts use deploy services without local build or secret state", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");
    const dockerignore = await readFile(".dockerignore", "utf8");

    for (const service of ["app:", "postgres:", "redis:", "worker:", "minio:"]) {
      expect(compose).toContain(service);
    }
    expect(compose).toContain("profiles:");
    expect(compose).toContain("samrian-app");
    expect(compose).not.toContain("bun run dev");

    for (const entry of [".next", "node_modules", ".env.local", "*.log"]) {
      expect(dockerignore).toContain(entry);
    }
  });

  test("production compose never publishes object storage or ships its credentials", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");

    expect(compose).not.toContain("minio-password");
    expect(compose).not.toMatch(/MINIO_ROOT_(USER|PASSWORD):/);
    expect(compose).not.toMatch(/"\d+:900[01]"/);
  });

  test.each([
    "docker-compose.db.yml",
    "docker-compose.inngest.yml",
    "docker-compose.security.yml",
    "docker-compose.storage.yml",
    "docker-compose.worker.yml",
  ])("%s publishes ports to this machine only", async (file) => {
    const compose = await readFile(file, "utf8");

    expect(compose.match(/^\s+- "\d+:\d+"$/gm) ?? []).toEqual([]);
  });
});
