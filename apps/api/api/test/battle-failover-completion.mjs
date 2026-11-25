import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';
import { io } from 'socket.io-client';

const apiDir = process.cwd();
const ports = [3201, 3202];
const urls = ports.map((port) => `http://127.0.0.1:${port}`);
const prefix = `failover${Date.now().toString(36)}${randomUUID().slice(0, 5)}`;
const processes = [];
const logs = new Map();

for (const key of ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE', 'JWT_SECRET', 'REDIS_URL']) {
  if (!process.env[key]) throw new Error(`Missing E2E environment variable: ${key}`);
}

function token(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: userId, iat: now, exp: now + 3600 })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', process.env.JWT_SECRET).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function event(socket, name, timeoutMs = 45_000, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timed out: ${name}`)); }, timeoutMs);
    const handler = (payload) => { if (!predicate(payload)) return; cleanup(); resolve(payload); };
    const cleanup = () => { clearTimeout(timer); socket.off(name, handler); };
    socket.on(name, handler);
  });
}

async function connect(url, user) {
  const socket = io(`${url}/battle`, {
    autoConnect: false,
    transports: ['websocket'],
    auth: { token: token(user.id) },
    reconnection: false,
    timeout: 20_000,
  });
  const connected = event(socket, 'connect', 20_000);
  const authenticated = event(socket, 'battle:connected', 20_000);
  socket.connect();
  await Promise.all([connected, authenticated]);
  return socket;
}

async function startApi(port, label, runMigrations) {
  const child = spawn(process.execPath, ['dist/main'], {
    cwd: apiDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      BATTLE_SHARED_STATE_REQUIRED: 'true',
      AI_WORKER_PROCESS: runMigrations ? 'false' : 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = [];
  logs.set(label, output);
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      output.push(...String(chunk).split('\n').filter(Boolean));
      if (output.length > 200) output.splice(0, output.length - 200);
    });
  }
  processes.push(child);
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited: ${child.exitCode}\n${output.slice(-60).join('\n')}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/ready`);
      if (response.ok) return child;
    } catch {}
    await delay(500);
  }
  throw new Error(`${label} readiness timeout\n${output.slice(-60).join('\n')}`);
}

async function seed() {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await db.connect();
  try {
    const questionCount = await db.query(
      `SELECT COUNT(*)::int AS count FROM battle_questions
       WHERE language = 'uz' AND difficulty = 'medium' AND "isActive" = true`,
    );
    if (questionCount.rows[0].count < 10) {
      await db.query(
        `INSERT INTO battle_questions
          ("categoryId", language, question, options, "correctAnswer", explanation, difficulty, "isActive")
         SELECT NULL, 'uz', 'Failover savol ' || n, '["A", "B", "C", "D"]'::jsonb, 0,
                'Failover izoh', 'medium', true
         FROM generate_series(1, 10) AS n`,
      );
    }
    const users = await db.query(
      `INSERT INTO users ("displayName", username, email, "passwordHash")
       VALUES ($1, $2, $3, 'test-only-hash'), ($4, $5, $6, 'test-only-hash')
       RETURNING id, username`,
      [`Failover ${prefix} A`, `${prefix}_a`, `${prefix}_a@example.test`,
       `Failover ${prefix} B`, `${prefix}_b`, `${prefix}_b@example.test`],
    );
    return users.rows;
  } finally {
    await db.end();
  }
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGKILL');
  await new Promise((resolve) => child.once('exit', resolve));
}

async function cleanup() {
  for (const child of processes) await stop(child);
}

let sockets = [];
try {
  const api1 = await startApi(ports[0], 'api-1', true);
  const api2 = await startApi(ports[1], 'api-2', false);
  const [userA, userB] = await seed();
  let socketA = await connect(urls[0], userA);
  let socketB = await connect(urls[1], userB);
  sockets.push(socketA, socketB);

  const waiting = event(socketA, 'battle:queue:waiting');
  socketA.emit('battle:queue:join', { mode: 'ranked', categoryId: 'general' });
  await waiting;

  const matchedA = event(socketA, 'battle:matched');
  const matchedB = event(socketB, 'battle:matched');
  const firstQuestionA = event(socketA, 'battle:question');
  const firstQuestionB = event(socketB, 'battle:question');
  socketB.emit('battle:queue:join', { mode: 'ranked', categoryId: 'general' });
  const [matchA, matchB, questionA, questionB] = await Promise.all([
    matchedA, matchedB, firstQuestionA, firstQuestionB,
  ]);
  if (matchA.matchId !== matchB.matchId || questionA.questionIndex !== 0 || questionB.questionIndex !== 0) {
    throw new Error('Initial ranked match did not synchronize across API replicas.');
  }

  // Let API-1 discover the shared snapshot before stopping API-2 (the matchmaking owner).
  await delay(2500);
  await stop(api2);

  // The remaining API replica must resolve the unanswered first question after its timer expires.
  const timeoutResult = await event(socketA, 'battle:question:result', 35_000,
    (result) => result.matchId === matchA.matchId && result.questionIndex === 0);
  if (timeoutResult.answers[userA.id] !== null || timeoutResult.answers[userB.id] !== null) {
    throw new Error('Timer failover did not record unanswered players as null.');
  }

  socketB = await connect(urls[0], userB);
  sockets.push(socketB);
  const reconnected = event(socketB, 'battle:reconnected');
  const restoredResult = event(socketB, 'battle:question:result', 10_000,
    (result) => result.matchId === matchA.matchId && result.questionIndex === 0);
  socketB.emit('battle:reconnect', { matchId: matchA.matchId });
  await Promise.all([reconnected, restoredResult]);

  // Complete questions 1–10 across the surviving API replica.
  for (let index = 0; index < 10; index += 1) {
    if (index > 0) {
      const questionAReady = event(socketA, 'battle:question', 15_000,
        (question) => question.matchId === matchA.matchId && question.questionIndex === index);
      const questionBReady = event(socketB, 'battle:question', 15_000,
        (question) => question.matchId === matchA.matchId && question.questionIndex === index);
      socketA.emit('battle:next:ready', { matchId: matchA.matchId, questionIndex: index - 1 });
      socketB.emit('battle:next:ready', { matchId: matchA.matchId, questionIndex: index - 1 });
      await Promise.all([questionAReady, questionBReady]);
    }

    if (index === 0) continue; // The first question was resolved by the surviving node's timer.

    const acceptedA = event(socketA, 'battle:answer:accepted', 10_000,
      (payload) => payload.questionIndex === index);
    const acceptedB = event(socketB, 'battle:answer:accepted', 10_000,
      (payload) => payload.questionIndex === index);
    const resultA = event(socketA, 'battle:question:result', 15_000,
      (payload) => payload.matchId === matchA.matchId && payload.questionIndex === index);
    const resultB = event(socketB, 'battle:question:result', 15_000,
      (payload) => payload.matchId === matchA.matchId && payload.questionIndex === index);
    socketA.emit('battle:answer', { matchId: matchA.matchId, questionIndex: index, answerIndex: 0 });
    socketB.emit('battle:answer', { matchId: matchA.matchId, questionIndex: index, answerIndex: 0 });
    await Promise.all([acceptedA, acceptedB, resultA, resultB]);
  }

  const finishedA = event(socketA, 'battle:finished', 20_000,
    (payload) => payload.matchId === matchA.matchId);
  const finishedB = event(socketB, 'battle:finished', 20_000,
    (payload) => payload.matchId === matchA.matchId);
  socketA.emit('battle:next:ready', { matchId: matchA.matchId, questionIndex: 9 });
  socketB.emit('battle:next:ready', { matchId: matchA.matchId, questionIndex: 9 });
  const [finishA, finishB] = await Promise.all([finishedA, finishedB]);
  if (finishA.totalQuestions !== 10 || finishB.totalQuestions !== 10) {
    throw new Error('Battle did not finish after all 10 questions.');
  }

  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await db.connect();
  let persisted;
  try {
    const match = await db.query(
      `SELECT status, "questionResults", "rankChanges"
       FROM battle_matches WHERE id = $1`,
      [matchA.matchId],
    );
    const rank = await db.query(
      `SELECT id, "rankPoints" FROM users WHERE id = ANY($1::uuid[])`,
      [[userA.id, userB.id]],
    );
    if (match.rowCount !== 1 || match.rows[0].status !== 'finished' ||
        match.rows[0].questionResults.length !== 10 ||
        Object.keys(match.rows[0].rankChanges || {}).length !== 2 ||
        rank.rowCount !== 2) {
      throw new Error('Finished match, 10 results, or both ranked reward records were not persisted.');
    }
    const changes = match.rows[0].rankChanges;
    for (const user of rank.rows) {
      if (Number(user.rankPoints) !== Number(changes[user.id]?.rankPoints)) {
        throw new Error(`Rank points do not match the persisted reward for user ${user.id}.`);
      }
    }
    persisted = {
      status: match.rows[0].status,
      questionResults: match.rows[0].questionResults.length,
      rankedPlayers: rank.rowCount,
      rankPointsMatchPersisted: true,
    };
  } finally {
    await db.end();
  }

  console.log(JSON.stringify({
    status: 'passed',
    apiReplicasStarted: 2,
    failedReplica: 'api-2',
    timerFailover: 'passed',
    reconnectAfterReplicaLoss: 'passed',
    tenQuestionCompletion: 'passed',
    rankedRewardsPersisted: persisted,
    matchId: matchA.matchId,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: 'failed',
    error: error instanceof Error ? error.stack : String(error),
    recentApiLogs: Object.fromEntries([...logs.entries()].map(([key, value]) => [key, value.slice(-80)])),
  }, null, 2));
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.disconnect();
  await cleanup();
}
