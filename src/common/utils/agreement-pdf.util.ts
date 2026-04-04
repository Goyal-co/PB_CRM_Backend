import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const log = new Logger('AgreementPdf');

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--mute-audio',
  '--no-first-run',
  /** Lets headless load agreement HTML via file:// from %TEMP% (Windows-safe). */
  '--allow-file-access-from-files',
];

/** Prefer file:// navigation above this size (non-Windows only; see loadHtmlIntoPage). */
const GOTO_FILE_THRESHOLD = 280_000;

/** Very large agreements: try system Chrome/Edge `--print-to-pdf` before Puppeteer (avoids long stuck page.pdf()). */
const LARGE_HTML_CLI_FIRST_THRESHOLD = 350_000;

type LaunchAttempt = {
  label: string;
  launch: () => Promise<import('puppeteer').Browser>;
};

export type RenderAgreementPdfOptions = {
  /** Stable key (e.g. booking id + updated_at) for in-memory repeat downloads. */
  cacheKey?: string;
};

type CacheEntry = { buf: Buffer; at: number };
const pdfCache = new Map<string, CacheEntry>();

let pooledBrowser: import('puppeteer').Browser | null = null;
let pooledBrowserLaunch: Promise<import('puppeteer').Browser> | null = null;

let pdfChain: Promise<unknown> = Promise.resolve();

function runPdfExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = pdfChain.then(fn, fn);
  pdfChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function cacheGet(key: string): Buffer | null {
  const ttl = Math.max(
    5_000,
    Number.parseInt(process.env.AGREEMENT_PDF_CACHE_TTL_MS ?? '600000', 10) ||
      600_000,
  );
  const e = pdfCache.get(key);
  if (!e) {
    return null;
  }
  if (Date.now() - e.at > ttl) {
    pdfCache.delete(key);
    return null;
  }
  return e.buf;
}

function cacheSet(key: string, buf: Buffer): void {
  const max = Math.max(
    1,
    Number.parseInt(process.env.AGREEMENT_PDF_CACHE_MAX ?? '48', 10) || 48,
  );
  while (pdfCache.size >= max) {
    let oldestKey = '';
    let oldestAt = Infinity;
    for (const [k, v] of pdfCache) {
      if (v.at < oldestAt) {
        oldestAt = v.at;
        oldestKey = k;
      }
    }
    if (!oldestKey) {
      break;
    }
    pdfCache.delete(oldestKey);
  }
  pdfCache.set(key, { buf, at: Date.now() });
}

function diskCacheDir(): string | null {
  if (process.env.AGREEMENT_PDF_DISK_CACHE !== '1') {
    return null;
  }
  const root =
    process.env.AGREEMENT_PDF_DISK_CACHE_DIR?.trim() ||
    path.join(os.tmpdir(), 'pb-crm-agreement-pdf');
  try {
    fs.mkdirSync(root, { recursive: true });
    return root;
  } catch {
    return null;
  }
}

function diskCacheFilePath(key: string): string | null {
  const dir = diskCacheDir();
  if (!dir) {
    return null;
  }
  const h = createHash('sha256').update(key).digest('hex');
  return path.join(dir, `${h}.pdf`);
}

function diskCacheGet(key: string): Buffer | null {
  const p = diskCacheFilePath(key);
  if (!p || !fs.existsSync(p)) {
    return null;
  }
  const ttl = Math.max(
    5_000,
    Number.parseInt(
      process.env.AGREEMENT_PDF_DISK_CACHE_TTL_MS ??
        process.env.AGREEMENT_PDF_CACHE_TTL_MS ??
        '600000',
      10,
    ) || 600_000,
  );
  let mtime = 0;
  try {
    mtime = fs.statSync(p).mtimeMs;
  } catch {
    return null;
  }
  if (Date.now() - mtime > ttl) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
    return null;
  }
  const buf = fs.readFileSync(p);
  if (buf.length >= 5 && buf.subarray(0, 4).toString('latin1') === '%PDF') {
    return buf;
  }
  return null;
}

function diskCacheSet(key: string, buf: Buffer): void {
  const p = diskCacheFilePath(key);
  if (!p) {
    return;
  }
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, p);
  } catch {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

/** CDP / browser boot — avoid default 30s connection cap on slow machines. */
const PUPPETEER_LAUNCH_CONNECT = {
  timeout: 120_000,
  protocolTimeout: 600_000,
} as const;

/**
 * Navigation / setContent / goto. Large agreements need well above Puppeteer's 30s default.
 * Values under 60s are bumped — 30s explains "Timed out after waiting 30000ms" in logs.
 */
function resolveNavTimeoutMs(): number {
  const raw = Number.parseInt(process.env.AGREEMENT_PDF_TIMEOUT_MS ?? '180000', 10);
  const n = Number.isNaN(raw) ? 180_000 : raw;
  return Math.max(60_000, n);
}

/** Max time for Chromium Page.printToPDF / layout (separate from navigation). */
function resolvePrintTimeoutMs(htmlLen: number): number {
  const explicit = Number.parseInt(
    process.env.AGREEMENT_PDF_PRINT_TIMEOUT_MS ?? '',
    10,
  );
  if (!Number.isNaN(explicit) && explicit > 0) {
    return Math.max(60_000, explicit);
  }
  const nav = resolveNavTimeoutMs();
  const floor =
    htmlLen >= LARGE_HTML_CLI_FIRST_THRESHOLD
      ? Math.max(360_000, nav * 2)
      : Math.max(180_000, nav * 2);
  return Math.min(900_000, floor);
}

/** spawnSync only — kept independent of AGREEMENT_PDF_TIMEOUT_MS so a bad 300s env does not mean 10m of CLI retries. */
function resolveCliSpawnTimeoutMs(): number {
  const raw = Number.parseInt(
    process.env.AGREEMENT_PDF_CLI_TIMEOUT_MS ?? '90000',
    10,
  );
  const n = Number.isNaN(raw) ? 90_000 : raw;
  return Math.min(120_000, Math.max(25_000, n));
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let to: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    to = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([
    p.then(
      (v) => {
        if (to) {
          clearTimeout(to);
        }
        return v;
      },
      (e) => {
        if (to) {
          clearTimeout(to);
        }
        throw e;
      },
    ),
    timeoutPromise,
  ]);
}

function toFileUrlForBrowser(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (process.platform === 'win32') {
    return `file:///${resolved.replace(/\\/g, '/')}`;
  }
  return `file://${resolved}`;
}

function collectBrowserExeCandidates(): string[] {
  const out: string[] = [];
  const push = (p: string | undefined) => {
    const t = p?.trim();
    if (t && !out.includes(t)) {
      out.push(t);
    }
  };

  push(process.env.PUPPETEER_EXECUTABLE_PATH);

  if (process.platform === 'win32') {
    push(`${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`);
    push(`${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`);
    push(`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`);
    push(`${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`);
    push(`${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`);
  } else {
    push('/usr/bin/google-chrome-stable');
    push('/usr/bin/google-chrome');
    push('/usr/bin/chromium');
    push('/usr/bin/chromium-browser');
  }

  return out;
}

/** Distinct executables (by realpath), max `max` entries — avoids 5× spawn timeouts. */
function distinctExistingExes(max: number): string[] {
  const out: string[] = [];
  const seenReal = new Set<string>();
  for (const p of collectBrowserExeCandidates()) {
    if (!p || !fs.existsSync(p)) {
      continue;
    }
    let real = p;
    try {
      real = fs.realpathSync.native(p);
    } catch {
      /* keep p */
    }
    if (seenReal.has(real)) {
      continue;
    }
    seenReal.add(real);
    out.push(p);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

/**
 * Uses Chrome/Edge `--print-to-pdf`. Limited to a few distinct binaries so failures do not stack minutes of spawn timeouts.
 */
function tryCliPrintToPdf(html: string): Buffer | null {
  const id = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const htmlPath = path.join(os.tmpdir(), `pb-crm-agreement-${id}.html`);
  const pdfPath = path.join(os.tmpdir(), `pb-crm-agreement-${id}.pdf`);

  const cleanup = () => {
    for (const p of [htmlPath, pdfPath]) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  };

  const timeout = resolveCliSpawnTimeoutMs();
  const maxExeAttempts = Math.max(
    1,
    Number.parseInt(process.env.AGREEMENT_PDF_CLI_MAX_ATTEMPTS ?? '2', 10) || 2,
  );
  const exes = distinctExistingExes(maxExeAttempts);

  try {
    fs.writeFileSync(htmlPath, html, 'utf8');
    const fileUrl = toFileUrlForBrowser(htmlPath);

    for (const exe of exes) {
      const result = spawnSync(
        exe,
        [
          '--headless',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--allow-file-access-from-files',
          '--no-first-run',
          '--no-default-browser-check',
          `--print-to-pdf=${pdfPath}`,
          fileUrl,
        ],
        { timeout, windowsHide: true, stdio: 'ignore' },
      );
      if (result.error || result.status !== 0 || !fs.existsSync(pdfPath)) {
        try {
          fs.unlinkSync(pdfPath);
        } catch {
          /* ignore */
        }
        continue;
      }
      const buf = fs.readFileSync(pdfPath);
      cleanup();
      if (buf.length >= 5 && buf.subarray(0, 4).toString('latin1') === '%PDF') {
        return buf;
      }
    }
  } catch (e) {
    log.warn(`CLI print-to-pdf error: ${e instanceof Error ? e.message : String(e)}`);
  }
  cleanup();
  return null;
}

/**
 * Tries several launch strategies so PDF works on Windows/Linux/Docker.
 */
async function launchAgreementBrowser(): Promise<import('puppeteer').Browser> {
  const puppeteer = await import('puppeteer');
  const p = puppeteer.default;
  const headless = true;

  const manualPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (manualPath) {
    return p.launch({
      headless,
      args: CHROME_ARGS,
      executablePath: manualPath,
      ...PUPPETEER_LAUNCH_CONNECT,
    });
  }

  const attempts: LaunchAttempt[] = [];

  if (process.platform === 'win32') {
    const roots = [
      process.env['ProgramFiles(x86)'],
      process.env.ProgramFiles,
    ].filter((r): r is string => Boolean(r));
    const seen = new Set<string>();
    for (const root of roots) {
      const edgeExe = `${root}\\Microsoft\\Edge\\Application\\msedge.exe`;
      if (seen.has(edgeExe)) {
        continue;
      }
      seen.add(edgeExe);
      if (fs.existsSync(edgeExe)) {
        attempts.push({
          label: `edge:${edgeExe}`,
          launch: () =>
            p.launch({
              headless,
              args: CHROME_ARGS,
              executablePath: edgeExe,
              ...PUPPETEER_LAUNCH_CONNECT,
            }),
        });
      }
    }
  }

  attempts.push(
    {
      label: 'channel:chrome',
      launch: () =>
        p.launch({
          headless,
          args: CHROME_ARGS,
          channel: 'chrome',
          ...PUPPETEER_LAUNCH_CONNECT,
        }),
    },
    {
      label: 'bundled:executablePath()',
      launch: () =>
        p.launch({
          headless,
          args: CHROME_ARGS,
          executablePath: p.executablePath(),
          ...PUPPETEER_LAUNCH_CONNECT,
        }),
    },
    {
      label: 'default',
      launch: () =>
        p.launch({ headless, args: CHROME_ARGS, ...PUPPETEER_LAUNCH_CONNECT }),
    },
  );

  const errors: string[] = [];
  for (const { label, launch } of attempts) {
    try {
      return await launch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${label}: ${msg}`);
    }
  }

  throw new Error(errors.join(' || '));
}

async function getPooledBrowser(): Promise<import('puppeteer').Browser> {
  if (process.env.AGREEMENT_PDF_POOL === '0') {
    return launchAgreementBrowser();
  }
  if (pooledBrowser?.connected) {
    return pooledBrowser;
  }
  if (!pooledBrowserLaunch) {
    pooledBrowserLaunch = launchAgreementBrowser()
      .then((b) => {
        pooledBrowser = b;
        b.on('disconnected', () => {
          pooledBrowser = null;
        });
        return b;
      })
      .finally(() => {
        pooledBrowserLaunch = null;
      });
  }
  return pooledBrowserLaunch;
}

function useFileUrlForHtmlLoad(htmlLen: number): boolean {
  if (process.env.AGREEMENT_PDF_USE_FILE_URL === '1') {
    return true;
  }
  if (process.env.AGREEMENT_PDF_USE_FILE_URL === '0') {
    return false;
  }
  /** Large HTML: file:// avoids CDP setContent limits; on Windows this fixes 30s timeouts. */
  if (process.platform === 'win32' && htmlLen >= GOTO_FILE_THRESHOLD) {
    return true;
  }
  return process.platform !== 'win32';
}

async function loadHtmlViaTempFile(
  page: import('puppeteer').Page,
  html: string,
  navTimeout: number,
): Promise<void> {
  const id = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const htmlPath = path.join(os.tmpdir(), `pb-crm-pool-${id}.html`);
  fs.writeFileSync(htmlPath, html, 'utf8');
  try {
    await page.goto(toFileUrlForBrowser(htmlPath), {
      waitUntil: 'domcontentloaded',
      timeout: navTimeout,
    });
  } finally {
    try {
      fs.unlinkSync(htmlPath);
    } catch {
      /* ignore */
    }
  }
}

async function loadHtmlIntoPage(
  page: import('puppeteer').Page,
  html: string,
  navTimeout: number,
): Promise<void> {
  const useFile =
    html.length >= GOTO_FILE_THRESHOLD && useFileUrlForHtmlLoad(html.length);
  if (useFile) {
    await loadHtmlViaTempFile(page, html, navTimeout);
    return;
  }
  try {
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: navTimeout,
    });
  } catch (e) {
    if (
      process.platform === 'win32' &&
      html.length >= GOTO_FILE_THRESHOLD &&
      process.env.AGREEMENT_PDF_USE_FILE_URL !== '0'
    ) {
      log.warn(
        `setContent failed (${e instanceof Error ? e.message : String(e)}); retrying via file://`,
      );
      await loadHtmlViaTempFile(page, html, navTimeout);
      return;
    }
    throw e;
  }
}

async function renderViaPuppeteer(html: string): Promise<Buffer> {
  const usePool = process.env.AGREEMENT_PDF_POOL !== '0';
  const browser = await getPooledBrowser();
  const page = await browser.newPage();
  const navTimeout = resolveNavTimeoutMs();
  const printTimeout = resolvePrintTimeoutMs(html.length);
  /** Puppeteer defaults navigation to 30s unless page defaults are raised. */
  page.setDefaultNavigationTimeout(navTimeout);
  page.setDefaultTimeout(Math.max(navTimeout, printTimeout));
  const huge =
    html.length >= LARGE_HTML_CLI_FIRST_THRESHOLD ||
    process.env.AGREEMENT_PDF_SIMPLE_LAYOUT === '1';
  try {
    await loadHtmlIntoPage(page, html, navTimeout);
    const pdfPromise = page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      preferCSSPageSize: !huge,
    });
    const pdf = await withTimeout(pdfPromise, printTimeout, 'page.pdf');
    const buf = Buffer.from(pdf);
    if (buf.length >= 5 && buf.subarray(0, 4).toString('latin1') === '%PDF') {
      return buf;
    }
    throw new Error('Puppeteer did not produce a valid PDF');
  } finally {
    await page.close().catch(() => undefined);
    if (!usePool) {
      await browser.close().catch(() => undefined);
    }
  }
}

/**
 * Pre-launch headless Chrome so the first PDF request is not paying full startup cost.
 * No-op if `AGREEMENT_PDF_POOL=0` or `AGREEMENT_PDF_WARM=0`.
 */
export async function warmAgreementPdfEngine(): Promise<void> {
  if (process.env.AGREEMENT_PDF_POOL === '0') {
    return;
  }
  if (process.env.AGREEMENT_PDF_WARM === '0') {
    return;
  }
  await getPooledBrowser().catch(() => undefined);
}

/**
 * HTML → PDF: optional LRU cache → Puppeteer (pooled) and/or CLI `--print-to-pdf`.
 *
 * Env: `PUPPETEER_EXECUTABLE_PATH`, `AGREEMENT_PDF_TIMEOUT_MS` (navigation, default 180s, min 60s),
 * `AGREEMENT_PDF_PRINT_TIMEOUT_MS`, `AGREEMENT_PDF_CLI_TIMEOUT_MS` (spawn cap, default 90s),
 * `AGREEMENT_PDF_CLI_FIRST_LARGE=1` (optional CLI-first for huge HTML — can add minutes if CLI hangs),
 * `AGREEMENT_PDF_DISK_CACHE=1` (disk cache → repeat downloads in milliseconds),
 * `AGREEMENT_PDF_USE_FILE_URL`, `AGREEMENT_PDF_SKIP_CLI`, `AGREEMENT_PDF_POOL`, `AGREEMENT_PDF_CLI_MAX_ATTEMPTS`
 */
export async function renderHtmlToPdfBuffer(
  html: string,
  opts?: RenderAgreementPdfOptions,
): Promise<Buffer> {
  const cacheDisabled = process.env.AGREEMENT_PDF_CACHE === '0';
  const ck = opts?.cacheKey;
  if (!cacheDisabled && ck) {
    const hit = cacheGet(ck);
    if (hit) {
      return hit;
    }
    const diskHit = diskCacheGet(ck);
    if (diskHit) {
      cacheSet(ck, diskHit);
      return diskHit;
    }
  }

  /** Opt-in: CLI-first blocks for minutes when print-to-pdf fails (spawn timeout × attempts). */
  const cliFirstLarge =
    process.env.AGREEMENT_PDF_CLI_FIRST_LARGE === '1' &&
    html.length >= LARGE_HTML_CLI_FIRST_THRESHOLD &&
    process.env.AGREEMENT_PDF_SKIP_CLI !== '1';

  const run = async (): Promise<Buffer> => {
    if (cliFirstLarge) {
      const cliEarly = tryCliPrintToPdf(html);
      if (cliEarly) {
        return cliEarly;
      }
      log.warn('CLI print-to-pdf failed for large HTML; falling back to Puppeteer');
    }

    try {
      return await runPdfExclusive(() => renderViaPuppeteer(html));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn(`Puppeteer PDF failed: ${msg}`);
      if (process.env.AGREEMENT_PDF_SKIP_CLI !== '1' && !cliFirstLarge) {
        const cli = tryCliPrintToPdf(html);
        if (cli) {
          return cli;
        }
      }
      throw new ServiceUnavailableException({
        message:
          'Could not generate PDF. Install Google Chrome or Microsoft Edge, or set PUPPETEER_EXECUTABLE_PATH. Use ?format=html to download HTML instead.',
        error: 'AGREEMENT_PDF_FAILED',
        details: msg,
      });
    }
  };

  const buf = await run();
  if (!cacheDisabled && ck) {
    cacheSet(ck, buf);
    diskCacheSet(ck, buf);
  }
  return buf;
}
