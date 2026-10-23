// Loads care homes into Postgres from a CSV. Upserts by id, never overwrites status, tries or notes.
//   npm run lares:import -w @boranois/api -- path/to/file.csv [--source receita]
// Columns (header, any order): id, name, legal_name, kind, address, neighbourhood, city, state, cep, phone, phone2
// kind: publico | filantropico | privado. phone: digits incl. DDD. cep: 8 digits.
import { readFileSync } from "node:fs";
import { createPool } from "./store/postgres.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const [file, ...rest] = process.argv.slice(2);
if (!file) throw new Error("usage: lares-import <file.csv> [--source name]");
const source = rest.includes("--source") ? rest[rest.indexOf("--source") + 1] : "manual";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.some((c) => c)).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const digits = (s: string) => s.replace(/\D/g, "");
const rows = parseCsv(readFileSync(file, "utf8"));
const pool = createPool(url);
const KIND = ["publico", "filantropico", "privado"];
const toRow = (r: Record<string, string>) => {
  const phone = digits(r.phone ?? ""); const phone2 = digits(r.phone2 ?? "");
  return [r.id || `m_${digits(r.cep)}_${r.name.toLowerCase().replace(/\W+/g, "-").slice(0, 30)}`, r.name, r.legal_name || null,
    KIND.includes(r.kind) ? r.kind : "privado", r.address || null, r.neighbourhood || null, r.city, r.state.toUpperCase(),
    digits(r.cep ?? "").padStart(8, "0").slice(-8) || null, phone.length >= 10 ? phone : null, phone2.length >= 10 ? phone2 : null, source];
};
const valid = rows.filter((r) => r.name && r.city && r.state);
// Batches of 500: one round-trip per batch instead of one per row (the database is in another continent).
const BATCH = 500;
let n = 0;
for (let i = 0; i < valid.length; i += BATCH) {
  const chunk = valid.slice(i, i + BATCH).map(toRow);
  const values = chunk.map((_, k) => `(${Array.from({ length: 12 }, (_, j) => `$${k * 12 + j + 1}`).join(",")})`).join(",");
  await pool.query(
    `insert into lares (id, name, legal_name, kind, address, neighbourhood, city, state, cep, phone, phone2, source) values ${values}
     on conflict (id) do update set name = excluded.name, legal_name = excluded.legal_name, kind = excluded.kind, address = excluded.address,
       neighbourhood = excluded.neighbourhood, city = excluded.city, state = excluded.state, cep = excluded.cep,
       phone = coalesce(excluded.phone, lares.phone), phone2 = coalesce(excluded.phone2, lares.phone2)`,
    chunk.flat(),
  );
  n += chunk.length;
}
await pool.end();
console.log(`imported ${n} of ${rows.length} rows (source: ${source})`);
