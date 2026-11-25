'use strict';

const { spawn } = require('node:child_process');

const api = { name: 'api', script: 'dist/main.js', child: null };
const worker = { name: 'ai-worker', script: 'dist/ai/queue/ai-generation.worker.js', child: null };
let shuttingDown = false;
let workerRestartDelay = 5000;
let shutdownTimer = null;
let apiExitCode = 0;

function launch(processInfo) {
  if (shuttingDown) return;
  const child = spawn(process.execPath, [processInfo.script], {
    env: process.env,
    stdio: 'inherit',
  });
  processInfo.child = child;

  child.once('error', (error) => {
    process.stderr.write(`[supervisor] ${processInfo.name} spawn error: ${error.message}\n`);
  });

  child.once('exit', (code, signal) => {
    processInfo.child = null;
    if (shuttingDown) {
      finishIfStopped();
      return;
    }

    if (processInfo === api) {
      apiExitCode = code ?? 1;
      shutdown('API process exited');
      return;
    }

    process.stderr.write(
      `[supervisor] AI worker exited (code=${code ?? 'null'}, signal=${signal ?? 'none'}); restarting in ${workerRestartDelay / 1000}s\n`,
    );
    const delay = workerRestartDelay;
    workerRestartDelay = Math.min(workerRestartDelay * 2, 30000);
    setTimeout(() => launch(worker), delay).unref();
  });

  if (processInfo === worker) workerRestartDelay = 5000;
}

function finishIfStopped() {
  if (api.child || worker.child) return;
  if (shutdownTimer) clearTimeout(shutdownTimer);
  process.exitCode = apiExitCode;
}

function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stderr.write(`[supervisor] Shutting down: ${reason}\n`);

  for (const processInfo of [api, worker]) {
    if (processInfo.child) {
      processInfo.child.kill('SIGTERM');
    }
  }

  shutdownTimer = setTimeout(() => {
    for (const processInfo of [api, worker]) {
      if (processInfo.child && !processInfo.child.killed) {
        processInfo.child.kill('SIGKILL');
      }
    }
    finishIfStopped();
  }, 12000);
  shutdownTimer.unref();
  finishIfStopped();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

launch(api);
// API migrations start first; worker has DB-backed recovery and is restarted if tables are not ready yet.
setTimeout(() => launch(worker), 5000).unref();
