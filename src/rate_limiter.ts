// Lightweight global rate limiter for HTTP requests
// - Caps concurrent requests
// - Enforces a minimum delay between request starts

type Task<T> = () => Promise<T>;

const MAX_CONCURRENCY = Number(process.env.RATE_LIMIT_MAX_CONCURRENCY || 4);
const MIN_INTERVAL_MS = Number(process.env.RATE_LIMIT_MIN_INTERVAL_MS || 100); // 10 rps default
const JITTER_MS = Number(process.env.RATE_LIMIT_JITTER_MS || 25);

let active = 0;
let lastStart = 0;
const queue: Array<() => void> = [];

function processNext() {
  while (active < MAX_CONCURRENCY && queue.length > 0) {
    const next = queue.shift()!;
    next();
  }
}

export function schedule<T>(fn: Task<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const taskRunner = () => {
      const now = Date.now();
      const elapsed = now - lastStart;
      const baseWait = Math.max(0, MIN_INTERVAL_MS - elapsed);
      const jitter = JITTER_MS > 0 ? Math.floor(Math.random() * JITTER_MS) : 0;
      const wait = baseWait + jitter;

      const start = async () => {
        active++;
        lastStart = Date.now();
        try {
          const res = await fn();
          resolve(res);
        } catch (e) {
          reject(e);
        } finally {
          active--;
          processNext();
        }
      };

      if (wait > 0) setTimeout(start, wait);
      else start();
    };

    queue.push(taskRunner);
    processNext();
  });
}
