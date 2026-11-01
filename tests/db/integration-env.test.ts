import { describe, expect, test } from "vitest";

const required = [
  "TEST_DATABASE_URL",
  "TEST_APP_DATABASE_URL",
  "TEST_AUTH_DATABASE_URL",
  "TEST_WORKER_DATABASE_URL",
];

// Database suites skip when these are unset, which reads as green unless CI demands them.
describe.runIf(process.env.REQUIRE_DB_TESTS === "1")("integration test environment", () => {
  test.each(required)("%s is set", (name) => {
    expect(process.env[name]).toBeTruthy();
  });
});
