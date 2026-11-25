# QUIZ ARENA — Railway scale-readiness plan

Status: two-process Battle E2E and 100/300/500-client CI load tests passed on 2026-11-25. Railway staging and physical Android/iOS device QA remain outstanding. This document does not authorize a plan upgrade, production deployment, database migration, or production configuration change.

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
- Battle Redis connection now accepts a managed `REDIS_URL` or `VALKEY_URL`; existing `VALKEY_HOST`, `VALKEY_PORT`, and `VALKEY_PASSWORD` settings remain supported. Configure only one URL or the host/port set in Railway staging variables; never commit connection strings.

## Important scale blockers found in code

### 1. Battle state is shared, with a process-local working cache

`BattleGateway` keeps an in-memory working cache for active matches and local timer handles. Authoritative active-match snapshots, queue-to-socket ownership, private invite records, and private-join rate limits are stored in Redis. Timer callbacks are reconciled across replicas and protected by Redis claims; core multi-node behavior now passes the CI two-process end-to-end test, while the additional release gates are listed below.

Before enabling multiple API replicas:
- Move authoritative Battle room/match/queue state to Redis or another shared, atomic state store.
- Use Redis-backed Socket.IO adapter so room broadcasts reach sockets connected to every API replica.
- Make match transitions atomic/idempotent (answer, timeout, reconnect, finish, rewards).
- Persist durable match results in PostgreSQL; Redis should hold short-lived live state, not replace durable history.
- Add cross-replica tests with two API instances and multiple Socket.IO clients.
- Keep a single API replica until these checks pass.

### 2. Health checks — initial API implementation added

The feature branch now exposes:
- `/health/live`: process liveness only; no dependency checks.
- `/health/ready`: checks TypeORM initialization and executes `SELECT 1` against PostgreSQL; returns HTTP 503 with a generic dependency status when unavailable.
- NestJS shutdown hooks are enabled so the application can participate in orchestrator shutdown.

This is an initial PostgreSQL readiness check, not the final production health contract. Add a bounded Redis ping check once the shared Redis client/module is implemented, then configure Railway readiness checks against `/health/ready`. Verify shutdown behavior with active Socket.IO clients before production rollout.

### 3. Database migrations run during API startup

TypeORM has `migrationsRun: true`. Before running multiple replicas, change deployment flow so exactly one release/migration job applies migrations before API rollout; API replicas must not race to run schema changes. Continue additive migrations only, take a verified backup before production schema changes, and never use destructive rollback.

### 4. Quiz generation must degrade gracefully without AI

The learning topic endpoint now follows a database-first rule: if the saved question bank already contains at least the requested number of questions, it serves the test without calling an AI provider. It no longer calls AI merely to fill the cache to 20 questions. AI is still used when the bank has fewer questions than requested.

Battle question preparation is also database-first, but it still calls AI when fewer than 10 matching Battle questions exist. The Battle status now reports this honestly as `database-first-ai-assisted`; it must not claim full AI independence.

Remaining work before claiming AI-independent test creation:
- Build and maintain a curated, reviewed question bank for every supported subject/topic/language/difficulty combination.
- Add a deterministic, non-AI document quiz fallback for supported text-based formats, with strict quality validation and clear labeling; PDF extraction needs a non-AI parser before PDF quizzes can be independent.
- Make AI-generated questions optional enrichment, not the only source of test questions.
- Add tests for provider outage, empty/partial banks, and sufficient-bank operation; do not return incomplete quizzes silently.

PDF files are currently validated but their text is not extracted into `documentText`; PDF quiz generation therefore still requires the AI PDF path. Before claiming full document-quiz independence, add a maintained PDF text parser, scanned-PDF OCR as a separately optional path, parser resource limits, malformed-file tests, and source-grounded fallback tests. Rule-based cloze questions are a resilience fallback, not a replacement for editorially reviewed question banks.

### 5. API and background work need separate capacity

Keep latency-sensitive HTTP and Battle Socket.IO traffic responsive. Move heavy document parsing, PDF generation, AI calls, and other long tasks to a separately deployable worker with bounded concurrency, retries, idempotency, and queue visibility. Do not create the worker until its queue semantics and retry safety are implemented.


### 2d. Verified two-process Battle E2E and CI load test — 2026-11-25

GitHub Actions run `45572448406` passed with two independently running NestJS API processes, one PostgreSQL 16 service and one Redis 7 service. Each API process listened on its own port; clients were distributed across both processes and used WebSocket-only Socket.IO transport.

Verified Battle flow:
- Matchmaking across API-1 and API-2; both clients received the same match and question.
- Both players disconnected and reconnected through the opposite API process.
- Answers from different API processes were accepted and the result was broadcast to both clients.
- A duplicate answer was rejected.
- Battle cancellation was broadcast to both clients.

Concurrent client load results from the same GitHub-hosted runner:

| Concurrent clients | Matched players | Matches | Questions delivered | Connect p95 | Queue-to-question |
|---:|---:|---:|---:|---:|---:|
| 100 | 100/100 | 50 | 100/100 | 218 ms | 387 ms |
| 300 | 300/300 | 150 | 300/300 | 315 ms | 1,046 ms |
| 500 | 500/500 | 250 | 500/500 | 523 ms | 1,734 ms |

All three CI stages passed with zero matchmaking/question delivery errors. These are process-level synthetic load measurements on one CI host, not a Railway network benchmark or a promise of 500-user Production capacity. The test does not yet measure Railway CPU/memory/DB pool saturation, timer failover under node loss, full 10-question completion/reward idempotency, or actual handset radio/background behavior.

Mobile CI also passed TypeScript validation, Android bundle export, iOS bundle export and Expo dependency validation. Bundle export is not equivalent to installing and exercising the app on physical Android/iOS devices.

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
- Keep PR #56 open as draft.
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


### 2a. Socket.IO Redis adapter — Pub/Sub layer connected

The API now creates dedicated Redis publisher/subscriber connections and installs the official `@socket.io/redis-adapter` when `REDIS_URL`, `VALKEY_URL`, or `VALKEY_HOST` is configured. If Redis is configured but unavailable, API startup fails rather than silently running a misleading local-only adapter. If no Redis endpoint is configured, the API logs that it is using the local adapter.

Important limitations:
- The adapter forwards Socket.IO broadcasts and socket-management operations between API replicas; it does not persist application Battle state in Redis.
- Railway does not provide sticky sessions. The mobile Battle client has therefore been changed to WebSocket-only transport for horizontal scaling; this removes polling's session-affinity requirement but also removes the polling fallback. Ship and validate the updated mobile client before raising API replicas. Socket.IO connection-state recovery is not supported by this adapter.
- `BattleStateStore` now persists active match snapshots in Redis (players, questions, answers, scores, current question, deadline, results, ready state and reconnect metadata). The gateway restores snapshots at API startup and reconstructs timers; stale socket IDs are invalidated and players receive a reconnect grace period.
- Answer submission, question-resolution claims, ready markers and question advancement use token-owned Redis locks/atomic read-modify-write operations. PostgreSQL remains the durable record for match progress and completed results.
- The gateway still keeps a process-local working cache for active matches and timer handles. Queue-to-socket ownership, private invite records, host ownership, invite claiming and private-join throttling use Redis; remote opponent/host socket discovery uses the Redis adapter's namespace-wide socket lookup. The core two-node matchmaking, reconnect, answer and cancellation paths now pass the CI process-level E2E test below. Timer failover, process restart, and exactly-once completion/rewards remain unverified.
- CI now starts PostgreSQL 16 and Redis 7, launches two independent NestJS API processes with separate ports and the same shared services, then connects real Socket.IO clients across both processes. The test verifies cross-node matchmaking, room/question delivery, reconnect through the opposite API, accepted and duplicate answers, result broadcast and cancellation.
- Keep Battle at one Production API replica until Railway-container validation, timer failover, completion/reward idempotency, server-restart recovery and physical-device QA pass.
- Redis Pub/Sub must remain private and protected with authentication, TLS/private networking and least-privilege credentials. Never expose the Redis endpoint publicly.

### 2b. Redis BattleStateStore — first durable-state layer

`BattleStateStore` uses the same managed Redis endpoint family as the Battle queue (`REDIS_URL` / `VALKEY_URL` / `VALKEY_HOST`) and stores versioned JSON snapshots with a six-hour TTL plus an active-match index. Configure a unique `BATTLE_REDIS_PREFIX` for each environment; when `BATTLE_SHARED_STATE_REQUIRED=true`, the API refuses to start without an explicit prefix and a reachable Redis instance. Example names (not secret values): `quiz-arena:staging` and `quiz-arena:production`.

The Redis lock uses `SET NX PX` with a random ownership token and compare-and-delete release script. Current critical-section TTL is 10 seconds; operations protected by it must remain short and must not perform AI generation or long database work while holding the lock.

Remaining engineering gates:
- Basic two-second active-state discovery/timer reconciliation is now in the gateway. Every API node discovers matches created after its boot and may schedule a question timer; Redis resolution claims prevent duplicate scoring. Abandoned `resolving` / `finishing` flags are recoverable after a 60-second stale window. This still needs full two-API Socket.IO end-to-end validation and careful failure-window review.
- Move private invite rooms, matchmaking ownership, reconnect metadata and join-attempt limits fully to shared storage; remove reliance on local-only socket lookup.
- Make completion and rank/reward application idempotent across Redis and PostgreSQL failure windows, and reconcile Redis snapshots from the PostgreSQL match record after restart.
- Add a real two-API end-to-end test with two Socket.IO servers connected to the same Redis and PostgreSQL test services. Exercise simultaneous answers, duplicate answer attempts, timer races, restart during a question, reconnect on the other node, finish races and exactly-once rank updates.
- Do not raise API replica count until the above tests pass. Current CI's two-store Redis test does not prove the complete gateway flow.

### 2c. Cross-replica Socket.IO peer discovery — first gateway correction

The Battle gateway now resolves matchmaking opponents and private-room hosts with the Redis adapter's namespace-wide `fetchSockets()` API instead of the process-local `namespace.sockets.get()` map. This allows a replica to locate and address a socket connected to another API replica. The gateway's reconnect and explicit-cancel handlers now load the latest match snapshot through `BattleStateStore`, and disconnect handling enumerates the shared active-match index before marking a player's socket disconnected.

A focused gateway test covers matchmaking when the opponent socket is returned by the namespace-wide adapter lookup.

This is a limited correction, not the multi-replica release gate. Private invite-room records, host ownership, invite claiming, and private-join rate-limit counters now use shared Redis state. Queue cancellation ownership is now stored in Redis with a five-minute TTL and is removed atomically when a player leaves or is matched. Disconnect/reconnect transitions and grace-timeout claims are serialized in Redis, and each replica rebuilds disconnect timers from shared snapshots. These changes now pass a two-process NestJS/Socket.IO E2E run and the 100/300/500-client CI load test. Queue ownership and private-invite failover are covered by Redis integration tests. Production must remain at one replica until the same topology is validated across separate Railway containers and the remaining timer, restart, reward-idempotency and device-QA gates pass.
