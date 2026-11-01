import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

describe("deployment artifacts", () => {
  test("production artifacts use deploy services without local build or secret state", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");
    const dockerignore = await readFile(".dockerignore", "utf8");

    for (const service of ["app:", "postgres:", "redis:", "worker:"]) {
      expect(compose).toContain(service);
    }
    expect(compose).toContain("samrian-app");
    expect(compose).not.toContain("bun run dev");

    for (const entry of [".next", "node_modules", ".env.local", "*.log"]) {
      expect(dockerignore).toContain(entry);
    }
  });

  test("self-hosting needs no bundled object storage", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(existsSync("docker-compose.storage.yml")).toBe(false);
    expect(packageJson.scripts["storage:test:up"]).toBeUndefined();
    for (const file of ["docker-compose.yml", ".env.example", "README.md", "docs/DEPLOYMENT.md"]) {
      expect(await readFile(file, "utf8")).not.toMatch(/minio/i);
    }
  });

  test.each([
    "docker-compose.db.yml",
    "docker-compose.inngest.yml",
    "docker-compose.security.yml",
    "docker-compose.worker.yml",
  ])("%s publishes ports to this machine only", async (file) => {
    const compose = await readFile(file, "utf8");

    expect(compose.match(/^\s+- "\d+:\d+"$/gm) ?? []).toEqual([]);
  });
});
