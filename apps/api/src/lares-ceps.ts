// Loads the national CEP directory (cep, logradouro, bairro, city, state, lat, lng) into lares_geo.
//   npm run lares:ceps -w @boranois/api -- /path/to/ceps.csv
// Source: basedosdados.br_bd_diretorios_brasil.cep (centroid per CEP). Upserts; safe to rerun.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createPool } from "./store/postgres.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const file = process.argv[2];
if (!file) throw new Error("usage: lares-ceps <file.csv>");
const pool = createPool(url);

const split = (line: string) => {
  const out: string[] = []; let cell = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { out.push(cell); cell = ""; } else cell += ch;
  }
  out.push(cell); return out;
};
const BATCH = 2000;
let batch: string[][] = [], n = 0, head: string[] | null = null;
const flush = async () => {
  if (!batch.length) return;
  const values = batch.map((_, k) => `(${Array.from({ length: 7 }, (_, j) => `$${k * 7 + j + 1}`).join(",")})`).join(",");
  await pool.query(
    `insert into lares_geo (cep, logradouro, bairro, city, state, lat, lng) values ${values}
     on conflict (cep) do update set logradouro = excluded.logradouro, bairro = excluded.bairro, city = excluded.city, state = excluded.state, lat = excluded.lat, lng = excluded.lng, tried_at = now()`,
    batch.flat(),
  );
  n += batch.length; batch = [];
  if (n % 50000 === 0) console.log(`${n} rows`);
};
for await (const line of createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity })) {
  if (!line) continue;
  const cells = split(line);
  if (!head) { head = cells; continue; }
  const r = Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
  if (!/^\d{8}$/.test(r.cep)) continue;
  batch.push([r.cep, r.logradouro || null, r.bairro || null, r.city || null, r.state || null, Number(r.lat), Number(r.lng)] as unknown as string[]);
  if (batch.length >= BATCH) await flush();
}
await flush();
await pool.end();
console.log(`loaded ${n} CEPs`);
