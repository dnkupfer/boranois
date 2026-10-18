// Cost guards. In-memory and per instance: enough to stop a runaway bill, not a security boundary.
// All limits are env-configurable; see .env.example.

/** Sliding window: at most `limit` hits per `windowMs` for a key. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private limit: number, private windowMs: number) {}

  allow(key: string): boolean {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10000) this.hits.clear(); // crude memory bound
    return true;
  }
}

/** A daily ceiling on model calls. When it's reached the app keeps working without AI. */
export class DailyCap {
  private day = "";
  private used = 0;
  constructor(public readonly cap: number) {}

  private roll() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) (this.day = today), (this.used = 0);
  }
  get exhausted() {
    this.roll();
    return this.used >= this.cap;
  }
  take(): boolean {
    this.roll();
    if (this.used >= this.cap) return false;
    this.used++;
    return true;
  }
  get remaining() {
    this.roll();
    return Math.max(0, this.cap - this.used);
  }
}

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const limits = {
  /** Model calls per session per hour (coach turns, interpretations, classifications, phrasings). */
  aiPerSessionHourly: new RateLimiter(num("AI_PER_SESSION_HOURLY", 60), 3600_000),
  /** Model calls per IP per hour. */
  aiPerIpHourly: new RateLimiter(num("AI_PER_IP_HOURLY", 200), 3600_000),
  /** Model calls per day, whole instance. */
  aiDaily: new DailyCap(num("AI_DAILY_CAP", 2000)),
  /** Any write per IP per 10 minutes (sessions, pessoas, events...). */
  writesPerIp: new RateLimiter(num("WRITES_PER_IP_10MIN", 300), 600_000),
};
