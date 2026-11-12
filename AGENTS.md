# Samrian Agent Guide

Samrian is self-hostable cold-email outreach software built with Next.js 16, PostgreSQL, Drizzle,
Better Auth or WorkOS, Inngest or BullMQ, and S3-compatible storage.

## Read First

1. `README.md`
2. `CONTRIBUTING.md`
3. `docs/DEVELOPMENT.md`
4. `docs/DEPLOYMENT.md`
5. `src/server/db/schema/index.ts`
6. `docs/SECURITY_WORKFLOW.md` for security checks

## Architecture

```text
UI / API routes / workers
  -> server modules and jobs
  -> app-owned ports
  -> repos and provider adapters
```

- UI and routes never import Drizzle, queue clients, or provider SDKs directly.
- Modules own business rules, validation, authorization intent, and state transitions.
- Repos own PostgreSQL mechanics and tenant-scoped data access.
- Provider SDKs stay in auth, connector, queue, storage, and observability adapters.
- Shared handlers serve Inngest and BullMQ.
- `packages/contracts`, `sdk`, `cli`, and `mcp` remain independent from server implementation.

## Security And Data Boundaries

- Use app-owned auth helpers under `src/server/auth`.
- Enforce org ownership without revealing cross-tenant resource existence.
- Use `withTenant` or approved system context for tenant DB work.
- Keep external network calls outside DB transactions.
- Validate every path, query, body, header, webhook, and provider payload at trust boundaries.
- Never log credentials, authorization headers, raw MIME, message bodies, or secrets.
- Keep API v1 behavior behind contracts and domain modules.

## Code Rules

- Read touched flow before editing.
- Add a test only where it makes a difference: risky logic, security boundaries, or a bug that
  existing tests missed. Write it RED first. Skip new tests for UI, styling, copy, and small
  wiring changes; run the existing suites instead.
- Prefer smallest working change.
- Extract shared logic after three real repetitions.
- Use short domain names. Avoid `utils`, `helpers`, `manager`, and broad `service` files.
- Keep comments for non-obvious invariants only.
- Do not modify generated Drizzle metadata manually.
- Do not restore removed Convex code or dependencies.
- Build UI from Astryx, not `@/components/ui/*` (legacy shadcn). Lint blocks new imports; when a
  file stops importing it, remove the file from the allowlist in `eslint.config.mjs`.

## Naming

- Files: lowercase kebab-case or established short domain name.
- React components and types: PascalCase.
- Functions and variables: camelCase.
- Constants: UPPER_SNAKE_CASE only for true constants.
- Database tables and columns: lowercase snake_case.

## Tests

Use focused project tests while working:

```powershell
bun run test --project unit
bun run test --project api
bun run test --project components
bun run test:db
```

Final gate:

```powershell
bun run format
bun run validate
bun run test
bun run test:db
bun run build
docker compose config --quiet
```

Docker integration tests need the documented `TEST_*` environment values and local Postgres or
Redis services.

## Git

Use Conventional Commits. Keep commits coherent. Never discard unrelated dirty-worktree changes.
Do not commit `.env.local`, generated reports, build output, local logs, or provider credentials.

## Licensing

Root application code is Apache-2.0. Public contracts, SDK, CLI, and MCP packages are MIT.
See `LICENSING.md` before moving code across those boundaries.

<!-- ASTRYX:START -->

Astryx v0.7.7 · 90+ components
CLI: run every command as `bunx @astryxdesign/cli@0.7.7 <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:

1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx template <Block>` for parts it lacks; `astryx component <Name>` to read props before using one.
   Changing an existing page? Keep it: skip step 2 and add blocks/components inside its sections.
   Before you deliver a build, run `astryx doctor --built <dir>`; don't deliver it if it fails.

RULES:

- No <div> — components handle all layout and spacing.
- Read `astryx docs layout` before changing a template's frame.
- Dense data = rows (Table, List/Item), not Card-wrapped lists. Badge = counts only.
- Style with component props first, then Tailwind utilities backed by tokens. No raw hex/px.
- Palettes and custom colors go through the theme, never :root overrides. Run `astryx theme add <slug>` to import; `theme eject <slug>` only forks source. See `astryx docs theme`.
- SELF-CHECK: re-read the file; replace any style={{…}}, raw <div>/<span>, imported .css/@apply, or hardcoded/arbitrary value (bg-[#fff], p-[13px]) with the component or a token-backed utility.

`astryx help` lists every command. Key ones beyond the workflow:
search "<query>" find any component / hook / doc / template
discover <words> integrations you could add
docs <topic> getting-started, principles, tokens, theme … (`astryx docs` lists all)
docs cli commands and API reference
docs authoring build an integration package, and every field it holds
upgrade --from <old version> --apply run after a dependency bump
<!-- ASTRYX:END -->
