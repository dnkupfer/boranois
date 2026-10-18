import type { EventName } from "@boranois/shared";

// Our own analytics: nothing leaves the site, nothing is sent before consent, and no event carries a
// name, a phone, a note or a message. The device id is random and separate from the session.

type Consent = "all" | "necessary" | null;
const CONSENT_KEY = "boranois.consent";
const AID_KEY = "boranois.aid";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable: analytics simply stays off
  }
}

export function getConsent(): Consent {
  const v = read(CONSENT_KEY);
  return v === "all" || v === "necessary" ? v : null;
}

export function setConsent(c: Exclude<Consent, null>) {
  write(CONSENT_KEY, c);
  if (c === "all") {
    if (!read(AID_KEY)) write(AID_KEY, crypto.randomUUID().replace(/-/g, "").slice(0, 24));
    track("consent", { choice: "all" });
  } else {
    write(AID_KEY, null);
    queue.length = 0;
  }
}

type Pending = { name: EventName; path: string; props: Record<string, string | number | boolean>; ts: string };
const queue: Pending[] = [];
let timer: number | null = null;

export function track(name: EventName, props: Record<string, string | number | boolean> = {}) {
  if (getConsent() !== "all") return;
  queue.push({ name, path: window.location.pathname, props, ts: new Date().toISOString() });
  if (timer === null) timer = window.setTimeout(flush, 1500);
}

export function flush() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  const aid = read(AID_KEY);
  if (!aid || queue.length === 0) return;
  const body = JSON.stringify({ aid, events: queue.splice(0, 50) });
  // sendBeacon survives page unloads; fall back to fetch.
  if (!navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) {
    fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
  if (queue.length) timer = window.setTimeout(flush, 1500);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
