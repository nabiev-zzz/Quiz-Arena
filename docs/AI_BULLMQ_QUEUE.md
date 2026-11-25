# AI generation queue (BullMQ)

All externally triggered AI provider calls are executed by a dedicated BullMQ worker.
The API validates and stores the request, responds with a job ID, and never waits
for Groq/Gemini to finish.

## Scope and isolation

This queue is only for AI generation:
- cold topic question-bank generation;
- PDF/DOCX/TXT/MD/CSV document-to-quiz generation;
- Premium AI-personalized Smart Practice;
- AI Tutor chat responses;
- the authenticated `POST /api/ai/generate` endpoint.

It does not use or modify BattleStateStore, Battle matchmaking, Battle gateway,
private Battle rooms, or the Socket.IO Redis adapter. BullMQ has its own queue
name (`ai-generation`) and Redis prefix
`quiz-arena:<NODE_ENV>:ai-bull`. The shared question cache has a different
prefix as well.

## Runtime services

Run two Railway services from the same API source and build:

| Service | Start command | Responsibility |
|---|---|---|
| API | `npm run start:prod` | Auth, validation, database jobs, enqueue, polling |
| AI worker | `npm run start:worker:prod` | BullMQ consumption and AI provider calls |

The worker is a separate process, not an API replica. Deploy the API first so its startup migrations create the job tables, then start the worker service. Worker mode skips TypeORM migrations to avoid concurrent migration runners. Do not start one worker inside every API instance. BullMQ coordinates multiple worker replicas safely.

Required shared environment:
- `DATABASE_URL` or the existing `DB_HOST`, `DB_PORT`, `DB_USERNAME`,
  `DB_PASSWORD`, `DB_DATABASE` values used by the API;
- Prefer a dedicated `AI_QUEUE_REDIS_URL` (or `AI_QUEUE_REDIS_HOST` plus
  `AI_QUEUE_REDIS_PORT` / `AI_QUEUE_REDIS_PASSWORD`) for physical isolation.
  If not set, the queue falls back to `REDIS_URL`, `VALKEY_URL`, or
  `VALKEY_HOST` plus optional Valkey port/password, while retaining a distinct
  BullMQ prefix and queue name;
- the existing provider secrets `GROQ_API_KEY` and/or `GEMINI_API_KEY`,
  plus the existing model variables.

Optional:
- `AI_WORKER_CONCURRENCY` (default 3, bounded to 1–8).
- `AI_WORKER_RATE_LIMIT_MAX` (default 120 jobs).
- `AI_WORKER_RATE_LIMIT_DURATION_MS` (default 60000 ms).
- `AI_QUEUE_MAX_WAITING` (default 100000 waiting jobs).
- `AI_MAX_PENDING_JOBS_PER_USER` (default 5 queued/active jobs per account).
- `AI_QUEUE_RECONCILE_BATCH_SIZE` (default 500 jobs checked by each worker on startup).

The API and worker must point to the same PostgreSQL and AI queue Redis endpoint. A dedicated AI Redis instance is recommended; if the existing Redis is shared, the AI BullMQ prefix remains isolated from Battle and Socket.IO keyspaces.
If Redis is unavailable, the API can still serve database-backed learning
questions, but AI generation endpoints return a controlled 503 response rather
than falling back to synchronous provider calls.

## Job lifecycle and API

- API creates a durable `ai_generation_jobs` row first.
- BullMQ stores only the database job ID, not the uploaded document bytes or
  provider prompt.
- Job status is `queued`, `active`, `completed`, or `failed`.
- Learning jobs are polled through `GET /api/learning/jobs/:jobId`.
- AI Tutor / direct AI generation jobs are polled through
  `GET /api/ai/jobs/:jobId`.
- Both status endpoints enforce the authenticated user's ownership.
- Mobile service wrappers poll every 3 seconds (up to 6 minutes) and open the generated test or append the Tutor response when the job completes. The loading state says “Test tayyorlanmoqda”.
- Job results/status remain in PostgreSQL; BullMQ completed jobs are retained
  for 24 hours and failed queue entries for 7 days.

## Reliability and quotas

- Transient provider/network failures get up to three attempts with exponential backoff (3 seconds base). Validation/client errors are marked unrecoverable and fail immediately, so they do not waste provider capacity.
- Worker concurrency defaults to 3; the global rate limiter defaults to 120 jobs/minute and is configurable.
- BullMQ priority favors Premium Pro, then Premium, then Free; AI Tutor and quiz-start jobs are ahead of document conversion. System prewarm jobs use low priority.
- Admission control rejects excess backlog and caps pending jobs per account to protect API/DB capacity.
- Stalled jobs are recovered by BullMQ; worker handles SIGTERM/SIGINT shutdown.
- Durable DB rows act as an outbox: worker startup and a 30-second recovery scan reconcile orphaned queued/active rows, re-enqueue missing BullMQ entries, and sync already-completed/terminal-failed BullMQ state. A completed DB result is returned on retry instead of calling the provider again.
- User quota is consumed once after the durable job row is created. Idempotency
  keys prevent duplicate quota consumption for repeated identical requests.
- Terminal worker failure triggers a quota refund; queue insertion failure also
  refunds the quota.
- Personalized Smart Practice is queued; non-personalized practice from saved
  mistakes stays database-only and does not call AI.
- Topic requests first check Redis and PostgreSQL. Only a cold/insufficient
  question bank creates a queue job. PostgreSQL advisory locks prevent duplicate
  generation for the same topic while multiple users' jobs are processed.
- Document uploads are held temporarily in PostgreSQL `bytea`, never in Redis
  or BullMQ payloads. The buffer is cleared from the job row after success or
  terminal failure.

## Prewarming

Run:
```bash
npm run build
npm run prewarm:learning
```

This enqueues six system-owned popular-topic jobs. It does not call an AI
provider in the cron process; the worker generates and stores the question bank
and warms the Redis question cache. Schedule this as a Railway Cron service only
after the API, PostgreSQL, Redis/Valkey and at least one worker are online.

## Local validation

```bash
npm ci
npm run build
npm test -- --runInBand src/ai/ai-tutor.service.spec.ts src/learning/learning.service.spec.ts
```

A Redis 7 service is included in the API CI job. Provider API keys are not
required for queue infrastructure tests; AI provider calls should be mocked in
unit tests.
