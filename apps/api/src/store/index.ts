import { resolve } from "node:path";
import { FileStore } from "./file.js";
import { createPool, PostgresStore } from "./postgres.js";
import type { Store } from "./types.js";

export type { Store } from "./types.js";

export function createStore(): { store: Store; kind: "postgres" | "file" } {
  const url = process.env.DATABASE_URL;
  if (url) return { store: new PostgresStore(createPool(url)), kind: "postgres" };
  // npm workspace scripts run with cwd = apps/api
  return { store: new FileStore(resolve(process.env.DATA_FILE ?? ".data/dev.json")), kind: "file" };
}
