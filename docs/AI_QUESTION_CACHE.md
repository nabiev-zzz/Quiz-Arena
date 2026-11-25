# AI question cache and prewarming

This feature is limited to shared, non-personalized learning questions. It does not
use or modify BattleStateStore, Battle matchmaking, or the Socket.IO adapter.

## Cache behavior

- PostgreSQL `learning_questions` remains the durable source of truth.
- Redis is an optional fast cache with a 15-minute TTL.
- Cache keys include subject, topic, language, difficulty, and schema version.
  Requested question count is intentionally excluded so a 20-question pool can
  serve smaller quizzes too.
- Cache keys are SHA-256 hashes; Redis keys use the isolated
  `quiz-arena:<NODE_ENV>:ai-question-cache:` namespace.
- When Redis is absent or unavailable, requests continue through the existing
  PostgreSQL-first path. No personal Smart Practice or document content is cached.
- Newly generated question pools are cached only after the PostgreSQL transaction
  commits.

## Redis configuration

Use the existing `REDIS_URL` (or `VALKEY_URL`; host-based Valkey settings are
also supported). The cache has its own key prefix and client; it does not share
Battle keyspace or locks.

## Prewarming

Run the dedicated command from `apps/api/api`:

```bash
npm run build
npm run prewarm:learning
```

It sequentially prepares 20 Uzbek questions for the curated popular topics:
Algebra equations, Algebra percentages, English vocabulary, Uzbekistan history,
Physics mechanics, and Informatics algorithms. Sequential execution limits
provider pressure. It is safe to schedule this command as a Railway Cron service
using the same API source/build and environment variables. Do not run it as part
of every API replica startup.

The current learning catalog has subject/topic identifiers but no grade-level
field. Therefore this prewarm list deliberately uses existing catalog IDs and
does not pretend that an existing topic is specifically “Matematika 7-sinf”.
Once grade-level curriculum metadata is introduced, grade-specific topics can
be added to the curated list.

## Operational notes

- Prewarming is an explicit scheduled command, not an API startup side effect.
- The command reports per-topic failures and exits non-zero if any topic failed.
- Redis is optional for correctness; PostgreSQL remains authoritative.
- A cache hit avoids provider calls only when the corresponding question pool
  already exists. Cold topics still use the current generation path.
