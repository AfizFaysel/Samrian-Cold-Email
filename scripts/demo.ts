/**
 * Product demo with sample data, no database or accounts needed. Development only.
 *
 *   bun run demo
 *
 * Starts the app and the sample-data server, then prints the URL to open. Data is fictional and
 * kept in memory. For recordings: open /__demo/reply to drop a new reply into the inbox, and
 * /__demo/reset to start over.
 */

import { spawn, spawnSync } from "node:child_process";

const APP_PORT = Number(process.env.DEMO_APP_PORT ?? 3000);
const DEMO_PORT = Number(process.env.PORT ?? 3101);

// Better Auth mode keeps sign-in inside the app, where the sample server answers as a demo user.
const app = spawn("bun", ["x", "next", "dev", "--turbopack", "--port", String(APP_PORT)], {
  env: {
    ...process.env,
    PORT: String(APP_PORT),
    AUTH_PROVIDER: "better-auth",
    NEXT_PUBLIC_AUTH_PROVIDER: "better-auth",
    SAMRIAN_DEMO: "1",
  },
  stdio: "inherit",
});

// Windows does not pass a kill on to grandchildren, so take down the whole tree.
function stop(code = 0) {
  if (app.pid && app.exitCode === null) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(app.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      app.kill();
    }
  }
  process.exit(code);
}
app.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

async function waitForApp() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${APP_PORT}/`, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`The app did not start on port ${APP_PORT}`);
}

await waitForApp();
process.env.DESIGN_PORT = String(DEMO_PORT);
process.env.DESIGN_UPSTREAM = `http://localhost:${APP_PORT}`;
await import("./design/preview");

console.log(`
  Samrian demo is running with sample data.

  Open      http://localhost:${DEMO_PORT}/dashboard
  New reply http://localhost:${DEMO_PORT}/__demo/reply
  Reset     http://localhost:${DEMO_PORT}/__demo/reset

  Press Ctrl+C to stop.
`);
