/**
 * Must run before any other setup file: hoisted imports would otherwise read
 * process.env before dotenv runs in the same file.
 */
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { applyE2EEnvDefaults } from './helpers/e2e-bootstrap';

/**
 * `setupFilesAfterEnv` runs once per spec file; clearing persisted e2e state on every run would
 * wipe ids produced by earlier files in the same Jest process. Only reset when starting a new run
 * (best-effort: OS pid differs between invocations).
 */
const e2eRunStateFile = resolve(__dirname, '.e2e-run-state.json');
const e2eJestPidFile = resolve(__dirname, '.e2e-jest-run.pid');
let priorPid = '';
try {
  if (existsSync(e2eJestPidFile)) {
    priorPid = readFileSync(e2eJestPidFile, 'utf8').trim();
  }
} catch {
  priorPid = '';
}
if (priorPid !== String(process.pid)) {
  try {
    if (existsSync(e2eRunStateFile)) {
      unlinkSync(e2eRunStateFile);
    }
  } catch {
    /* ignore */
  }
  try {
    writeFileSync(e2eJestPidFile, String(process.pid), 'utf8');
  } catch {
    /* ignore */
  }
}

function resolveRepoRootEnv(): string {
  const fromCwd = resolve(process.cwd(), '.env');
  if (existsSync(fromCwd)) {
    return fromCwd;
  }
  return resolve(process.cwd(), '..', '.env');
}

config({ path: resolveRepoRootEnv(), override: true, quiet: true });
config({
  path: resolve(__dirname, '.env.test'),
  override: false,
  quiet: true,
});

applyE2EEnvDefaults();
