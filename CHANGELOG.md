# Changelog

Notable Samrian changes are recorded here. The project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and intends to use semantic versioning
after its first public release.

## [Unreleased]

### Added

- PostgreSQL and Drizzle data layer with tenant RLS and least-privilege runtime roles.
- Better Auth and WorkOS provider-neutral authentication modes.
- Campaign launch, scheduling, mailbox rotation, ramp controls, and durable workers.
- Reply, bounce, unsubscribe, inbox, notification, tracking, and analytics workflows.
- S3-compatible storage and Inngest/BullMQ queue adapters.
- Versioned automation API, typed SDK, CLI, and agent-safe MCP server.
- OpenTelemetry and Better Stack-ready observability foundation.
- Docker/VPS and managed/serverless deployment documentation.
- Security test matrix, rate limits, outbound-network controls, and encrypted credential lifecycle.
- Apache-2.0 application license with MIT contracts, SDK, CLI, and MCP packages.

### Changed

- Relicensed the application from AGPL-3.0-or-later to Apache-2.0. Earlier releases stay available
  under AGPL-3.0-or-later.
- Rebuilt backend architecture around app-owned modules, ports, repos, and provider adapters.
- Standardized product identity as Samrian.
- Replaced npm lock policy with Bun workspaces and `bun.lock`.
- Object storage is now optional, and `/api/health` reports it as disabled when unconfigured.
- Upgraded Better Auth to 1.7. Apply migration `0003_invitations_created_at` before deploying,
  because Better Auth now rejects auth requests when the database schema does not match.

### Removed

- Convex runtime, generated files, dependencies, scripts, and active documentation.
- Bundled MinIO service, the `minio` compose profile, `docker-compose.storage.yml`, and
  `storage:test:up`. MinIO's community images are no longer publicly available, and no feature
  stores objects yet.
