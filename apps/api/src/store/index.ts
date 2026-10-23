import type pg from "pg";
import { resolve } from "node:path";
import { FileStore } from "./file.js";
import { createPool, PostgresStore } from "./postgres.js";
import type { Store } from "./types.js";

export type { Store } from "./types.js";

export function createStore(): { store: Store; kind: "postgres" | "file"; pool?: pg.Pool } {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = createPool(url);
    return { store: new PostgresStore(pool), kind: "postgres", pool };
  }
  // npm workspace scripts run with cwd = apps/api
  return { store: new FileStore(resolve(process.env.DATA_FILE ?? ".data/dev.json")), kind: "file" };
}
