import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// Turbopack cannot parse some Google font URLs, so next/font/google fails builds at random.
describe("production builds", () => {
  test("do not fetch fonts from Google", () => {
    const sources = readdirSync("src", { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => readFileSync(join("src", file), "utf8").includes("next/font/google"));

    expect(sources).toEqual([]);
  });
});
