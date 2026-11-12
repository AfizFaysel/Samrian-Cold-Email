/**
 * Design preview server for local QA and the design-system export. Development only.
 *
 * Proxies pages from the dev server and answers /api/* with sample data, signed in as a
 * sample user, so every screen renders without a database. Run `bun run dev`, then
 * `bun run design:preview`, then open http://localhost:3101/design and click Export HTML
 * (or http://localhost:3101/dashboard to click around).
 *
 * States: /__mock/data | /__mock/empty | /__mock/error, /__mock/signed-out | /__mock/signed-in.
 * Demo: /__demo/reply drops a new reply into the inbox, /__demo/reset starts over.
 * Sample data lives in demo-data.ts. Replies, read state and notifications are kept in memory;
 * other writes are accepted and discarded. The app's X-Frame-Options header is dropped here only,
 * so the export can capture screens in same-origin frames.
 */

import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { connect } from "node:net";

import { fixtures, injectReply, recordWrite, resetDemo } from "./demo-data";

const UPSTREAM = process.env.DESIGN_UPSTREAM ?? "http://localhost:3000";
const PORT = Number(process.env.DESIGN_PORT ?? 3101);
const OUTPUT = new URL("../../docs/design-system.html", import.meta.url);
let mode: "data" | "empty" | "error" = "data";
let signedOut = false;

function emptied(body: unknown): unknown {
  const out = JSON.parse(JSON.stringify(body), (key, value) =>
    Array.isArray(value) && key !== "permissions" && key !== "daysAllowed" ? [] : value
  );
  if (out && typeof out === "object") {
    if ("totalSent" in out)
      Object.assign(out, {
        totalSent: 0,
        replyRate: 0,
        bounceRate: 0,
        unsubscribeRate: 0,
        clickRate: 0,
      });
    if ("unreadCount" in out) out.unreadCount = 0;
  }
  return out;
}

function mockApi(method: string, path: string, body = ""): Response {
  if (method !== "GET") {
    recordWrite(method, path, body);
    return Response.json({ ok: true, id: "mock_" + Date.now() });
  }
  const routes = fixtures();
  if (path.startsWith("/api/auth/session")) {
    return signedOut
      ? Response.json(null)
      : Response.json(routes[0][1]([] as unknown as RegExpMatchArray));
  }
  if (mode === "error" && !path.startsWith("/api/notifications")) {
    return Response.json({ error: "Mock failure" }, { status: 500 });
  }
  for (const [pattern, handler] of routes) {
    const match = path.match(pattern);
    if (match) {
      const body = handler(match);
      return Response.json(mode === "empty" ? emptied(body) : body);
    }
  }
  return Response.json({}, { status: 404 });
}

const upstream = new URL(UPSTREAM);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname + url.search;
  const send = async (response: Response) => {
    const headers = Object.fromEntries(response.headers);
    delete headers["content-encoding"];
    delete headers["content-length"];
    delete headers["x-frame-options"];
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  };
  const body = async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  };

  const switchTo = url.pathname.match(/^\/__mock\/(data|empty|error)$/);
  if (switchTo) {
    mode = switchTo[1] as typeof mode;
    return send(new Response(null, { status: 302, headers: { Location: "/dashboard" } }));
  }
  if (url.pathname === "/__mock/signed-out" || url.pathname === "/__mock/signed-in") {
    signedOut = url.pathname.endsWith("out");
    return send(new Response(null, { status: 204 }));
  }
  // The /design export hands its finished file to disk here.
  if (url.pathname === "/__save" && req.method === "POST") {
    await writeFile(OUTPUT, await body());
    return send(Response.json({ saved: OUTPUT.pathname }));
  }
  // Demo controls for recordings: drop a fresh reply into the inbox, or start over.
  if (url.pathname === "/__demo/reply") {
    injectReply();
    return send(new Response("A new reply landed in the inbox.\n"));
  }
  if (url.pathname === "/__demo/reset") {
    resetDemo();
    return send(new Response("Demo data reset.\n"));
  }
  if (url.pathname.startsWith("/api/")) {
    const method = req.method ?? "GET";
    const payload = method === "GET" ? "" : (await body()).toString("utf8");
    return send(mockApi(method, path, payload));
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }
  headers.set("host", upstream.host);
  headers.delete("origin");
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  send(
    await fetch(UPSTREAM + path, {
      method: req.method,
      headers,
      body: hasBody ? new Uint8Array(await body()) : undefined,
      redirect: "manual",
    })
  );
});

// Hot reload and other websockets pass straight through as raw TCP.
server.on("upgrade", (req, socket, head) => {
  const target = connect(Number(upstream.port || 80), upstream.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i];
      lines.push(`${key}: ${key.toLowerCase() === "host" ? upstream.host : req.rawHeaders[i + 1]}`);
    }
    target.write(lines.join("\r\n") + "\r\n\r\n");
    target.write(head);
    socket.pipe(target).pipe(socket);
  });
  target.on("error", () => socket.destroy());
  socket.on("error", () => target.destroy());
});

server.listen(PORT, () => {
  console.log(`Design preview on http://localhost:${PORT} (proxying ${UPSTREAM})`);
});
