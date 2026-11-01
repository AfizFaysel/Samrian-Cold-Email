import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// getDb() returns the tenant transaction only inside createApiRoute, so a client captured before
// it runs outside RLS scope. Tests on an owner connection cannot see the difference.
describe("v1 routes", () => {
  const root = "src/app/api/v1";
  const routes = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith("route.ts"))
    .map((file) => join(root, file));

  test("are found", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  test.each(routes)("%s reads the database only inside createApiRoute", (route) => {
    const source = readFileSync(route, "utf8");
    const handlers = source.split("export async function ").slice(1);

    for (const handler of handlers) {
      expect(handler.split("createApiRoute(")[0]).not.toContain("getDb()");
    }
  });
});
