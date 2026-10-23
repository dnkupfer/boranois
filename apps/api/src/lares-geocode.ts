// Fills lares_geo with coordinates for every CEP in `lares` that has none yet.
//   npm run lares:geocode -w @boranois/api
// Source: cep.awesomeapi.com.br (street-level lat/lng per CEP). A CEP that fails is recorded with null
// coordinates and retried only if older than a day, so the run can be repeated safely.
import { createPool } from "./store/postgres.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const pool = createPool(url);
await pool.query(`create table if not exists lares_geo (cep text primary key, lat double precision, lng double precision, tried_at timestamptz not null default now())`);

const { rows } = await pool.query(
  `select distinct l.cep from lares l left join lares_geo g on g.cep = l.cep
   where l.cep is not null and (g.cep is null or (g.lat is null and g.tried_at < now() - interval '1 day')) order by l.cep`,
);
console.log(`${rows.length} CEPs to geocode`);
const CONCURRENCY = 4;
let done = 0, ok = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function one(cep: string) {
  let lat: number | null = null, lng: number | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`, { headers: { "user-agent": "boranois.web.app (boranois@kupfer.co)" } });
      if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
      if (res.ok) {
        const d = (await res.json()) as { lat?: string; lng?: string };
        if (d.lat && d.lng) { lat = Number(d.lat); lng = Number(d.lng); }
      }
      break;
    } catch { await sleep(1000); }
  }
  await pool.query(`insert into lares_geo (cep, lat, lng, tried_at) values ($1,$2,$3,now()) on conflict (cep) do update set lat = excluded.lat, lng = excluded.lng, tried_at = now()`, [cep, lat, lng]);
  done++; if (lat !== null) ok++;
  if (done % 250 === 0) console.log(`${done}/${rows.length} (${ok} with coordinates)`);
}

const queue = rows.map((r) => r.cep as string);
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) { await one(queue.shift()!); await sleep(120); } }));
await pool.end();
console.log(`done: ${done} CEPs, ${ok} with coordinates`);
