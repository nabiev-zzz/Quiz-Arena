# QUIZ ARENA — Railway scale-readiness plan

Status: preparation only. This document does not authorize a plan upgrade, production deployment, database migration, or production configuration change.

## Current verified deployment context

- Railway staging project: `quiz-arena-staging`.
- Staging environment currently contains only the PostgreSQL service.
- The staging PostgreSQL deployment previously reached `SUCCESS`.
- Staging Redis and API could not be provisioned because the Railway workspace hit its free-plan resource provisioning limit.
- Production Railway project and production data must remain untouched until an explicit release approval.
- API package location: `apps/api/api`.
- API production start script: `npm run start:prod` (runs `node dist/main`).
- API listens on `process.env.PORT` and binds to `0.0.0.0`.
- TypeORM currently uses explicit `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_DATABASE` variables; schema synchronization is disabled and migrations currently run during application startup.

## Important scale blockers found in code

### 1. Battle state is process-local

`BattleGateway` keeps active matches, queued sockets, private rooms, timers, and reconnect state in in-memory `Map` instances. This is safe only while a single API process owns the live Battle state. It is not safe to scale the API horizontally: two replicas would have different maps and timers.

Before enabling multiple API replicas:
- Move authoritative Battle room/match/queue state to Redis or another shared, atomic state store.
- Use Redis-backed Socket.IO adapter so room broadcasts reach sockets connected to every API replica.
- Make match transitions atomic/idempotent (answer, timeout, reconnect, finish, rewards).
- Persist durable match results in PostgreSQL; Redis should hold short-lived live state, not replace durable history.
- Add cross-replica tests with two API instances and multiple Socket.IO clients.
- Keep a single API replica until these checks pass.

### 2. Health checks are not yet production-grade

The current root GET handler returns a greeting, not a readiness check. Before production rollout add:
- `/health/live`: process is alive; no dependency checks.
- `/health/ready`: verifies required dependencies (PostgreSQL and Redis) are reachable with short timeouts.
- Configure Railway health checks against readiness, and graceful shutdown for HTTP and Socket.IO connections.

### 3. Database migrations run during API startup

TypeORM has `migrationsRun: true`. Before running multiple replicas, change deployment flow so exactly one release/migration job applies migrations before API rollout; API replicas must not race to run schema changes. Continue additive migrations only, take a verified backup before production schema changes, and never use destructive rollback.

### 4. API and background work need separate capacity

Keep latency-sensitive HTTP and Battle Socket.IO traffic responsive. Move heavy document parsing, PDF generation, AI calls, and other long tasks to a separately deployable worker with bounded concurrency, retries, idempotency, and queue visibility. Do not create the worker until its queue semantics and retry safety are implemented.

## Railway service layout

Initial staging layout (after workspace capacity is available):
1. `api` — NestJS API, root directory `apps/api/api`, build `npm ci && npm run build`, start `npm run start:prod`.
2. `postgres` — Railway PostgreSQL; staging-only database.
3. `redis` — Railway Redis; staging-only live state, cache, rate-limit and queue backend.
4. `worker` — add only after background jobs are implemented and independently testable.
5. Railway Bucket — add when document/avatar/report object storage is implemented; do not store uploaded files on an ephemeral container filesystem.

Use Railway's private service networking for API-to-Postgres/Redis connections. Store secrets only in Railway service variables and reference staging service variables from staging API. Never copy production credentials into staging, commit secrets, print secret values, or ask the user to paste them into chat.

## Scale-up sequence

### Phase A — no extra spend
- Keep current production untouched.
- Keep PR #55 open as draft.
- Finish code-level readiness work and automated tests.
- Document exact staging service settings and required variable names (not values).
- Add CI checks for API build/tests and mobile type/dependency validation.
- Review PostgreSQL connection pool limits, request timeouts, upload limits, and graceful shutdown.

### Phase B — after workspace capacity/plan is upgraded
- Provision staging Redis and API only in `quiz-arena-staging`.
- Configure staging-only variables.
- Run migrations against the isolated staging database and verify the schema.
- Verify API health, authentication, subscription entitlements, PDF export, document-to-quiz, private Battle, reconnect, quota refunds, and two-client socket behavior.
- Test Android and iOS builds and sharing/document-picker flows.
- Load-test HTTP and Battle separately; record p95 latency, error rate, CPU, memory, DB connections, Redis memory, and queue depth.

### Phase C — production release (explicit approval required)
- Take and verify a production database backup.
- Review migration plan and rollback/recovery steps.
- Set production-only variables in Railway; never reuse staging secrets.
- Deploy during a controlled release window, verify health and logs, and monitor metrics.
- Increase API replicas only after Battle state is shared and multi-instance tests pass.
- Keep PR draft until all staging and device QA passes. Do not merge or deploy production without the user's explicit authorization.

## Scaling principles

- Start with one API replica and conservative resource sizing.
- Scale vertically first for predictable workloads; scale horizontally only after stateless API behavior and shared Battle state are verified.
- Set explicit database pool limits so total connections across replicas stay below PostgreSQL capacity.
- Apply rate limits at shared infrastructure level (Redis), not process-local memory, when using multiple replicas.
- Use object storage for uploads and generated reports; use a CDN for public static assets where appropriate.
- Configure automated backups, retention, restore drills, error monitoring, and alerts before a broad launch.
- Establish usage budgets and alert thresholds before enabling high-cost AI or file-processing features.

## Release gate

Do not call the app scale-ready merely because Railway Pro is enabled. The release gate is: staging deployment succeeds, migrations are safe, health checks pass, two-instance Battle tests pass, Android/iOS QA passes, backups are restorable, and observed load-test metrics meet agreed targets.
