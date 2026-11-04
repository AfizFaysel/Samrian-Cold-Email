/**
 * Builds the single-file design system (docs/design-system.html) from the running app:
 * the /design page itself, every screen below captured as live HTML (not images) in
 * srcdoc iframes, and the app's CSS and fonts inlined once. Runs in the browser.
 */

export type Screen = {
  id: string;
  flow: string;
  title: string;
  path: string;
  /** Mock state, only when served through the local QA proxy (/__mock/*). */
  state?: "empty" | "error";
  signedOut?: boolean;
  /** Visible texts of buttons or tabs to click, in order, before capturing. */
  clicks?: string[];
  height?: number;
};

const wizard = (step: number, title: string): Screen => ({
  id: `wizard-${step}`,
  flow: "New campaign",
  title,
  path: "/dashboard/campaigns/new/wizard",
  clicks: Array.from({ length: step - 1 }, () => "Continue"),
});

const settings = (tab: string): Screen => ({
  id: `settings-${tab.toLowerCase().replace(/\s+/g, "-")}`,
  flow: "Settings",
  title: tab,
  path: "/dashboard/settings",
  clicks: [tab],
});

export const SCREENS: Screen[] = [
  { id: "landing", flow: "Public", title: "Landing", path: "/", signedOut: true },
  { id: "sign-in", flow: "Public", title: "Sign in", path: "/sign-in", signedOut: true },
  { id: "sign-up", flow: "Public", title: "Sign up", path: "/sign-up", signedOut: true },
  { id: "licensing", flow: "Public", title: "Licensing", path: "/licensing", signedOut: true },
  { id: "overview", flow: "Dashboard", title: "Overview", path: "/dashboard" },
  {
    id: "overview-empty",
    flow: "Dashboard",
    title: "Overview · empty",
    path: "/dashboard",
    state: "empty",
  },
  {
    id: "overview-error",
    flow: "Dashboard",
    title: "Overview · error",
    path: "/dashboard",
    state: "error",
  },
  { id: "analytics", flow: "Dashboard", title: "Analytics", path: "/dashboard/analytics" },
  { id: "inbox", flow: "Dashboard", title: "Inbox", path: "/dashboard/inbox", height: 800 },
  {
    id: "inbox-empty",
    flow: "Dashboard",
    title: "Inbox · empty",
    path: "/dashboard/inbox",
    state: "empty",
    height: 800,
  },
  { id: "campaigns", flow: "Campaigns", title: "Campaigns", path: "/dashboard/campaigns" },
  {
    id: "campaigns-empty",
    flow: "Campaigns",
    title: "Campaigns · empty",
    path: "/dashboard/campaigns",
    state: "empty",
  },
  {
    id: "campaigns-error",
    flow: "Campaigns",
    title: "Campaigns · error",
    path: "/dashboard/campaigns",
    state: "error",
  },
  {
    id: "campaign",
    flow: "Campaigns",
    title: "Campaign detail",
    path: "/dashboard/campaigns/cmp_1",
  },
  wizard(1, "1 · Basics"),
  wizard(2, "2 · Schedule"),
  wizard(3, "3 · Sequence"),
  wizard(4, "4 · Contacts"),
  wizard(5, "5 · Mailboxes"),
  wizard(6, "6 · Review"),
  { id: "contacts", flow: "Contacts", title: "Contacts", path: "/dashboard/contacts" },
  {
    id: "contacts-empty",
    flow: "Contacts",
    title: "Contacts · empty",
    path: "/dashboard/contacts",
    state: "empty",
  },
  { id: "contact", flow: "Contacts", title: "Contact detail", path: "/dashboard/contacts/ct_0" },
  {
    id: "import-method",
    flow: "Add contacts",
    title: "1 · Method",
    path: "/dashboard/contacts/import",
  },
  {
    id: "import-csv",
    flow: "Add contacts",
    title: "2 · Upload CSV",
    path: "/dashboard/contacts/import",
    clicks: ["Upload a CSV", "Continue"],
  },
  {
    id: "import-manual",
    flow: "Add contacts",
    title: "2 · Enter by hand",
    path: "/dashboard/contacts/import",
    clicks: ["Enter by hand", "Continue"],
  },
  { id: "mailboxes", flow: "Sending", title: "Mailboxes", path: "/dashboard/mailboxes" },
  {
    id: "mailboxes-connect",
    flow: "Sending",
    title: "Connect mailbox",
    path: "/dashboard/mailboxes",
    clicks: ["Connect mailbox"],
  },
  { id: "blocklist", flow: "Sending", title: "Blocklist", path: "/dashboard/blocklist" },
  settings("General"),
  settings("Sending"),
  settings("Notifications"),
  settings("Team"),
  settings("API keys"),
];

const VIEWPORT = { width: 1280, height: 800 };
const BUSY = '[data-slot="skeleton"], .animate-pulse, .animate-spin';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function settle(doc: Document) {
  await sleep(600);
  for (let quiet = 0, waited = 0; quiet < 3 && waited < 10_000; waited += 200) {
    quiet = doc.querySelector(BUSY) ? 0 : quiet + 1;
    await sleep(200);
  }
}

function clickText(doc: Document, text: string) {
  const target = [...doc.querySelectorAll<HTMLElement>("button, [role=tab], a")].find(
    (el) => el.textContent?.trim() === text || el.getAttribute("aria-label") === text
  );
  target?.click();
}

async function toDataUri(url: string) {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/** Strip runtime-only nodes; inline same-origin images. */
async function serialize(doc: Document) {
  const root = doc.documentElement.cloneNode(true) as HTMLElement;
  root
    .querySelectorAll(
      'script, link, style, noscript, nextjs-portal, next-route-announcer, [data-nextjs-toast], [aria-live="assertive"]'
    )
    .forEach((node) => node.remove());
  for (const img of root.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (src?.startsWith("/")) img.setAttribute("src", await toDataUri(src));
    img.removeAttribute("srcset");
  }
  root.dataset.theme = "light";
  return `<!doctype html>${root.outerHTML}`;
}

async function capture(screen: Screen) {
  const frame = document.createElement("iframe");
  Object.assign(frame.style, {
    position: "fixed",
    left: "-20000px",
    width: `${VIEWPORT.width}px`,
    height: `${VIEWPORT.height}px`,
  });
  frame.src = screen.path;
  document.body.append(frame);
  await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  try {
    // Re-read the document each time: a client redirect can swap it.
    const doc = () => frame.contentDocument;
    if (!doc()) return null; // Framing blocked: run through scripts/design/preview.ts.
    await settle(doc()!);
    for (const text of screen.clicks ?? []) {
      clickText(doc()!, text);
      await settle(doc()!);
    }
    const page = doc()!;
    const height =
      screen.height ?? Math.min(Math.max(page.documentElement.scrollHeight, 640), 2400);
    return { html: await serialize(page), height };
  } finally {
    frame.remove();
  }
}

async function collectCss() {
  let css = "";
  for (const sheet of document.styleSheets) {
    try {
      css += [...sheet.cssRules].map((rule) => rule.cssText).join("\n") + "\n";
    } catch {
      // Cross-origin sheets are not used by the app.
    }
  }
  const fonts = [...new Set(css.match(/\/_next\/static\/media\/[^)"']+/g) ?? [])];
  for (const font of fonts) css = css.split(font).join(await toDataUri(font));
  return css;
}

// Theme switch and CSS sharing for the static file: React does not run there.
const RUNTIME = `
const css = document.getElementById("ds-css").textContent;
function paint(doc, mode) { doc.documentElement.dataset.theme = mode; }
function mode() { return document.documentElement.dataset.theme || "light"; }
function dress(frame) {
  const doc = frame.contentDocument;
  if (!doc || !doc.head || doc.getElementById("ds-css")) return;
  const style = doc.createElement("style");
  style.id = "ds-css";
  style.textContent = css;
  doc.head.append(style);
  paint(doc, mode());
}
const frames = [...document.querySelectorAll("iframe[data-screen]")];
for (const frame of frames) {
  frame.addEventListener("load", () => dress(frame));
  if (frame.contentDocument && frame.contentDocument.readyState === "complete") dress(frame);
}
// Scale each 1280px-wide screen to the width of its card.
function fit() {
  for (const frame of frames) {
    const box = frame.parentElement;
    const scale = box.parentElement.clientWidth / ${VIEWPORT.width};
    frame.style.transform = "scale(" + scale + ")";
    box.style.height = frame.offsetHeight * scale + "px";
  }
}
fit();
addEventListener("resize", fit);
document.addEventListener("click", (event) => {
  const choice = event.target.closest('[aria-label="Theme"] [role=radio]');
  if (!choice) return;
  const label = choice.getAttribute("aria-label").toLowerCase();
  const next = label === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : label;
  paint(document, next);
  document.querySelectorAll("iframe[data-screen]").forEach((f) => f.contentDocument && paint(f.contentDocument, next));
  document.querySelectorAll('[aria-label="Theme"] [role=radio]').forEach((r) => r.setAttribute("aria-checked", String(r === choice)));
});
`;

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

export async function buildDesignSystemHtml(onProgress?: (message: string) => void) {
  const viaProxy = (await fetch("/__mock/signed-in").catch(() => null))?.status === 204;
  const shots = new Map<string, { html: string; height: number }>();

  for (const screen of SCREENS) {
    if (screen.state && !viaProxy) continue;
    onProgress?.(`Capturing ${screen.flow} · ${screen.title}`);
    if (viaProxy) {
      await fetch(screen.signedOut ? "/__mock/signed-out" : "/__mock/signed-in");
      await fetch(`/__mock/${screen.state ?? "data"}`, { redirect: "manual" });
    }
    const shot = await capture(screen);
    if (shot) shots.set(screen.id, shot);
  }
  if (viaProxy) {
    await fetch("/__mock/signed-in");
    await fetch("/__mock/data", { redirect: "manual" });
  }

  onProgress?.("Inlining CSS and fonts");
  const css = await collectCss();
  const page = await serialize(document);
  const parsed = new DOMParser().parseFromString(page, "text/html");
  parsed.querySelectorAll("[data-export-only=false]").forEach((node) => node.remove());
  for (const slot of parsed.querySelectorAll<HTMLElement>("[data-screen-slot]")) {
    const shot = shots.get(slot.dataset.screenSlot!);
    if (!shot) {
      slot.closest("[data-screen-card]")?.remove();
      continue;
    }
    const scale = 0.45;
    slot.innerHTML = `<div style="height:${shot.height * scale}px;overflow:hidden"><iframe data-screen loading="lazy" title="${slot.dataset.screenSlot}" style="width:${VIEWPORT.width}px;height:${shot.height}px;border:0;transform:scale(${scale});transform-origin:0 0" srcdoc="${escapeAttr(shot.html)}"></iframe></div>`;
  }
  const head = parsed.head;
  head.insertAdjacentHTML(
    "afterbegin",
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
  );
  const style = parsed.createElement("style");
  style.id = "ds-css";
  style.textContent = css;
  head.append(style);
  const script = parsed.createElement("script");
  script.textContent = RUNTIME;
  parsed.body.append(script);
  return `<!doctype html>\n${parsed.documentElement.outerHTML}`;
}
