import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { Client } from 'pg';
import { io } from 'socket.io-client';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(apiDir, 'test-results');
const outputFile = path.join(outputDir, 'battle-multireplica-load.json');
const runPrefix = `e2e${Date.now().toString(36)}${randomUUID().slice(0, 5)}`;
const jwtSecret = process.env.JWT_SECRET;
const redisUrl = process.env.REDIS_URL;
const apiPorts = [3101, 3102];
const apiUrls = apiPorts.map((port) => `http://127.0.0.1:${port}`);
const apiProcesses = [];
const processLogs = new Map();
const socketErrors = [];

for (const key of ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE', 'JWT_SECRET', 'REDIS_URL']) {
  if (!process.env[key]) throw new Error(`Required E2E environment variable is missing: ${key}`);
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] * 100) / 100;
}

function signToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: userId, iat: now, exp: now + 3600 })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', jwtSecret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function waitForEvent(socket, eventName, timeoutMs = 60_000, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for Socket.IO event: ${eventName}`));
    }, timeoutMs);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      cleanup();
      resolve(payload);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off(eventName, handler);
    };
    socket.on(eventName, handler);
  });
}

async function connectUser(apiUrl, user) {
  const socket = io(`${apiUrl}/battle`, {
    autoConnect: false,
    transports: ['websocket'],
    auth: { token: signToken(user.id) },
    reconnection: false,
    timeout: 20_000,
  });
  socket.on('battle:error', (payload) => socketErrors.push({
    user: user.username,
    message: payload?.message || 'unknown battle error',
  }));
  const connected = waitForEvent(socket, 'connect', 20_000);
  const authenticated = waitForEvent(socket, 'battle:connected', 20_000);
  const startedAt = performance.now();
  socket.connect();
  await Promise.all([connected, authenticated]);
  return { socket, connectMs: performance.now() - startedAt, user };
}

async function waitForHealth(child, port, label) {
  const deadline = Date.now() + 90_000;
  let lastError = 'not ready';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${label} exited early (code ${child.exitCode}). Logs:\n${(processLogs.get(label) || []).slice(-50).join('\n')}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/ready`);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`${label} did not become ready: ${lastError}. Logs:\n${(processLogs.get(label) || []).slice(-50).join('\n')}`);
}

async function startApi(port, label, disableMigrations) {
  const child = spawn(process.execPath, ['dist/main'], {
    cwd: apiDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      BATTLE_SHARED_STATE_REQUIRED: 'true',
      AI_WORKER_PROCESS: disableMigrations ? 'true' : 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  processLogs.set(label, logs);
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      logs.push(...String(chunk).split('\n').filter(Boolean));
      if (logs.length > 250) logs.splice(0, logs.length - 250);
    });
  }
  apiProcesses.push(child);
  await waitForHealth(child, port, label);
  return child;
}

async function seedDatabase() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO battle_questions
        ("categoryId", language, question, options, "correctAnswer", explanation, difficulty, "isActive")
       SELECT NULL, 'uz', 'E2E savol ' || n, '["A", "B", "C", "D"]'::jsonb, 0,
              'E2E izoh', 'medium', true
       FROM generate_series(1, 10) AS n`,
    );
    const users = await client.query(
      `INSERT INTO users ("displayName", username, email, "passwordHash")
       SELECT 'Battle E2E ' || n,
              $1 || '_' || n,
              $1 || '_' || n || '@example.test',
              'test-only-not-a-real-password-hash'
       FROM generate_series(1, 902) AS n
       RETURNING id, username`,
      [runPrefix],
    );
    return users.rows;
  } finally {
    await client.end();
  }
}

async function runTwoReplicaBattleE2E(users) {
  let playerA = await connectUser(apiUrls[0], users[0]);
  let playerB = await connectUser(apiUrls[1], users[1]);
  let matchId;
  try {
    const waiting = waitForEvent(playerA.socket, 'battle:queue:waiting');
    playerA.socket.emit('battle:queue:join', { mode: 'casual', categoryId: 'general' });
    await waiting;

    const matchedA = waitForEvent(playerA.socket, 'battle:matched');
    const matchedB = waitForEvent(playerB.socket, 'battle:matched');
    const questionA = waitForEvent(playerA.socket, 'battle:question');
    const questionB = waitForEvent(playerB.socket, 'battle:question');
    playerB.socket.emit('battle:queue:join', { mode: 'casual', categoryId: 'general' });

    const [matchA, matchB, initialQuestionA, initialQuestionB] = await Promise.all([
      matchedA, matchedB, questionA, questionB,
    ]);
    if (matchA.matchId !== matchB.matchId) throw new Error('The two replicas delivered different match IDs.');
    if (initialQuestionA.matchId !== matchA.matchId || initialQuestionB.matchId !== matchA.matchId) {
      throw new Error('The first question was not broadcast to both API replicas.');
    }
    matchId = matchA.matchId;

    // Force both players to reconnect through the opposite API replica.
    playerA.socket.disconnect();
    playerB.socket.disconnect();
    await delay(350);
    const oldA = playerA;
    const oldB = playerB;
    playerA = await connectUser(apiUrls[1], users[0]);
    playerB = await connectUser(apiUrls[0], users[1]);
    const reconnectA = waitForEvent(playerA.socket, 'battle:reconnected');
    const reconnectB = waitForEvent(playerB.socket, 'battle:reconnected');
    const reconnectQuestionA = waitForEvent(playerA.socket, 'battle:question');
    const reconnectQuestionB = waitForEvent(playerB.socket, 'battle:question');
    playerA.socket.emit('battle:reconnect', { matchId });
    playerB.socket.emit('battle:reconnect', { matchId });
    const [, , restoredQuestionA, restoredQuestionB] = await Promise.all([
      reconnectA,
      reconnectB,
      reconnectQuestionA,
      reconnectQuestionB,
    ]);
    oldA.socket.disconnect();
    oldB.socket.disconnect();

    if (restoredQuestionA.matchId !== matchId || restoredQuestionB.matchId !== matchId) {
      throw new Error('Reconnected clients did not receive the current Battle question.');
    }
    const questionIndex = restoredQuestionA.questionIndex;
    if (restoredQuestionB.questionIndex !== questionIndex) {
      throw new Error('Reconnected clients received different question indexes.');
    }
    const acceptedA = waitForEvent(playerA.socket, 'battle:answer:accepted');
    playerA.socket.emit('battle:answer', { matchId, questionIndex, answerIndex: 0 });
    await acceptedA;

    const duplicate = waitForEvent(
      playerA.socket,
      'battle:error',
      10_000,
      (payload) => String(payload?.message || '').includes('javob berib bo‘lgansiz'),
    );
    playerA.socket.emit('battle:answer', { matchId, questionIndex, answerIndex: 0 });
    await duplicate;

    const resultA = waitForEvent(playerA.socket, 'battle:question:result');
    const resultB = waitForEvent(playerB.socket, 'battle:question:result');
    const acceptedB = waitForEvent(playerB.socket, 'battle:answer:accepted');
    playerB.socket.emit('battle:answer', { matchId, questionIndex, answerIndex: 1 });
    const [resultForA, resultForB] = await Promise.all([resultA, resultB, acceptedB]);
    if (resultForA.matchId !== matchId || resultForB.matchId !== matchId) {
      throw new Error('Question result was not synchronized across the two API replicas.');
    }

    const cancelledA = waitForEvent(playerA.socket, 'battle:cancelled');
    const cancelledB = waitForEvent(playerB.socket, 'battle:cancelled');
    playerA.socket.emit('battle:match:cancel', { matchId });
    await Promise.all([cancelledA, cancelledB]);

    return {
      status: 'passed',
      matchId,
      firstConnectionReplicas: ['api-1', 'api-2'],
      reconnectReplicas: ['api-2', 'api-1'],
      questionResultBroadcast: true,
      duplicateAnswerRejected: true,
      cancellationBroadcast: true,
    };
  } finally {
    playerA?.socket.disconnect();
    playerB?.socket.disconnect();
  }
}

async function runLoadStage(userRows, requestedUsers) {
  const startedAt = performance.now();
  const stageErrors = [];
  const connectionResults = await Promise.allSettled(
    userRows.slice(0, requestedUsers).map((user, index) =>
      connectUser(apiUrls[index % apiUrls.length], user),
    ),
  );
  const clients = connectionResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  for (const result of connectionResults) {
    if (result.status === 'rejected') stageErrors.push(String(result.reason));
  }

  const matchedWaiters = clients.map(({ socket }) =>
    waitForEvent(socket, 'battle:matched', 90_000),
  );
  const questionWaiters = clients.map(({ socket }) =>
    waitForEvent(socket, 'battle:question', 90_000),
  );
  const queueStartedAt = performance.now();
  for (const { socket } of clients) {
    socket.emit('battle:queue:join', { mode: 'casual', categoryId: 'general' });
  }

  const matchResults = await Promise.allSettled(matchedWaiters);
  const matchPayloads = matchResults.map((result) => result.status === 'fulfilled' ? result.value : null);
  const matchedPlayers = matchPayloads.filter(Boolean).length;
  for (const result of matchResults) {
    if (result.status === 'rejected') stageErrors.push(String(result.reason));
  }

  const questionResults = await Promise.allSettled(questionWaiters);
  const questionsReceived = questionResults.filter((result) => result.status === 'fulfilled').length;
  for (const result of questionResults) {
    if (result.status === 'rejected') stageErrors.push(String(result.reason));
  }

  const groups = new Map();
  for (let index = 0; index < matchPayloads.length; index += 1) {
    const match = matchPayloads[index];
    if (!match) continue;
    const group = groups.get(match.matchId) || [];
    group.push(clients[index]);
    groups.set(match.matchId, group);
  }

  const cleanupJobs = [];
  for (const [id, group] of groups) {
    if (group.length !== 2) continue;
    const cancelled = group.map(({ socket }) => waitForEvent(socket, 'battle:cancelled', 20_000));
    group[0].socket.emit('battle:match:cancel', { matchId: id });
    cleanupJobs.push(Promise.allSettled(cancelled));
  }
  await Promise.allSettled(cleanupJobs);
  for (const { socket } of clients) socket.disconnect();

  const connectTimes = connectionResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value.connectMs);
  const matchedDurationMs = performance.now() - queueStartedAt;
  const passed = clients.length === requestedUsers &&
    matchedPlayers === requestedUsers &&
    questionsReceived === requestedUsers;

  return {
    usersRequested: requestedUsers,
    usersConnected: clients.length,
    matchedPlayers,
    matchesCreated: groups.size,
    questionsReceived,
    connectLatencyMs: {
      p50: percentile(connectTimes, 0.50),
      p95: percentile(connectTimes, 0.95),
      max: connectTimes.length ? Math.round(Math.max(...connectTimes) * 100) / 100 : null,
    },
    queueToQuestionMs: Math.round(matchedDurationMs * 100) / 100,
    totalStageMs: Math.round((performance.now() - startedAt) * 100) / 100,
    status: passed ? 'passed' : 'failed',
    errors: stageErrors.slice(0, 20),
  };
}

async function stopApis() {
  for (const child of apiProcesses) {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  }
  await Promise.all(apiProcesses.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timeout = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 10_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  })));
}

let finalReport;
try {
  await startApi(apiPorts[0], 'api-1', false);
  await startApi(apiPorts[1], 'api-2', true);
  const users = await seedDatabase();
  const e2e = await runTwoReplicaBattleE2E(users.slice(0, 2));
  const stages = [];
  let offset = 2;
  for (const size of [100, 300, 500]) {
    stages.push(await runLoadStage(users.slice(offset, offset + size), size));
    offset += size;
  }
  finalReport = {
    generatedAt: new Date().toISOString(),
    environment: 'isolated GitHub Actions PostgreSQL + Redis services',
    apiReplicas: 2,
    e2e,
    loadStages: stages,
    socketErrors: socketErrors.slice(0, 100),
    allPassed: e2e.status === 'passed' && stages.every((stage) => stage.status === 'passed'),
  };
} catch (error) {
  finalReport = {
    generatedAt: new Date().toISOString(),
    apiReplicas: 2,
    allPassed: false,
    fatalError: error instanceof Error ? error.stack : String(error),
    recentApiLogs: Object.fromEntries([...processLogs.entries()].map(([name, logs]) => [name, logs.slice(-80)])),
  };
} finally {
  await stopApis();
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify(finalReport, null, 2));
}

console.log(JSON.stringify(finalReport, null, 2));
if (!finalReport?.allPassed) process.exitCode = 1;
