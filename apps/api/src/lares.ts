import { Router, type Request, type Response } from "express";
import type pg from "pg";
import { z } from "zod";
import { newId } from "./ids.js";

// Casas de repouso. Volunteers claim a home ("estou ligando"), call, and record what happened.
// Everything here is public and account-less: a volunteer is a name + e-mail kept on their device.
// No resident data is ever stored: only counts and what the staff said.

const CLAIM_TTL = "2 hours";
export const OUTCOMES = ["nao_atendeu", "telefone_errado", "sem_interesse", "interessados", "van", "ja_tem", "ajudantes"] as const;
const STATUS_AFTER: Record<(typeof OUTCOMES)[number], string> = {
  nao_atendeu: "livre",
  telefone_errado: "telefone_errado",
  sem_interesse: "sem_interesse",
  interessados: "interessados",
  van: "resolvido",
  ja_tem: "resolvido",
  ajudantes: "ajudantes",
};

const Volunteer = z.object({ name: z.string().trim().min(2).max(60), email: z.string().trim().toLowerCase().email().max(120) });
const Outcome = Volunteer.extend({
  outcome: z.enum(OUTCOMES),
  interested: z.number().int().min(0).max(500).optional(),
  notes: z.string().trim().max(600).optional(),
});
const Helper = z.object({
  name: z.string().trim().min(2).max(60),
  contact: z.string().trim().min(5).max(80),
  cep: z.string().regex(/^\d{8}$/).optional(),
  neighbourhood: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().length(2).toUpperCase().optional(),
  homeId: z.string().max(40).optional(),
});

const LIST_COLS = "id, name, kind, neighbourhood, city, state, cep, phone, status, tries, last_outcome, interested_count, updated_at";

export function laresRouter(pool: pg.Pool) {
  const r = Router();

  /** Claims nobody touched for two hours are released, so a home never stays locked by someone who walked away. Runs at most every 30 s. */
  let lastExpire = 0;
  const expire = async () => {
    if (Date.now() - lastExpire < 30_000) return;
    lastExpire = Date.now();
    await pool.query(`update lares_claims set released_at = now(), outcome = 'expirou' where released_at is null and updated_at < now() - interval '${CLAIM_TTL}'`);
    await pool.query(`update lares l set status = 'livre', updated_at = now() where status = 'ligando' and not exists (select 1 from lares_claims c where c.home_id = l.id and c.released_at is null)`);
  };

  const activeClaim = async (homeId: string) => {
    const { rows } = await pool.query(`select id, volunteer_name, volunteer_email, claimed_at, updated_at from lares_claims where home_id = $1 and released_at is null`, [homeId]);
    return rows[0] ?? null;
  };

  // List: nearest to a CEP first (same city, then same state), or filtered by state/city/status/text.
  r.get("/", async (req: Request, res: Response) => {
    await expire();
    const q = req.query as Record<string, string | undefined>;
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)); };
    if (q.state) add("state = ?", q.state.toUpperCase());
    if (q.city) add("lower(city) = lower(?)", q.city);
    if (q.status) add("status = ?", q.status);
    if (q.q) add("(name ilike ? or legal_name ilike '%' || $" + (params.length + 1) + " || '%')", `%${q.q}%`);
    if (q.phone === "1") where.push("phone is not null");
    const limit = Math.min(200, Math.max(1, Number(q.limit ?? 60)));
    const offset = Math.max(0, Number(q.offset ?? 0));
    let order = "status = 'livre' desc, tries asc, name asc";
    let distance = "null::double precision as distance_km";
    const lat = Number(q.lat), lng = Number(q.lng);
    if (q.lat && q.lng && Number.isFinite(lat) && Number.isFinite(lng)) {
      // Great-circle distance in km from the visitor's CEP to each home's CEP (haversine). Homes whose CEP we
      // couldn't geocode go last, ordered by the old CEP-number proximity.
      params.push(lat, lng);
      const [la, ln] = [params.length - 1, params.length];
      distance = `(6371 * acos(least(1.0, cos(radians($${la})) * cos(radians(g.lat)) * cos(radians(g.lng) - radians($${ln})) + sin(radians($${la})) * sin(radians(g.lat))))) as distance_km`;
      order = `g.lat is null asc, ${distance.replace(" as distance_km", "")} asc nulls last, status = 'livre' desc`;
      if (q.cep && /^\d{8}$/.test(q.cep)) { params.push(q.cep); order += `, abs(coalesce(nullif(lares.cep, '')::bigint, 0) - $${params.length}::bigint) asc`; }
    } else if (q.cep && /^\d{8}$/.test(q.cep)) {
      params.push(q.cep, q.cepCity ?? "", q.cepState ?? "");
      const [c, city, state] = [params.length - 2, params.length - 1, params.length];
      order = `(lower(city) = lower($${city})) desc, (state = $${state}) desc, abs(coalesce(nullif(lares.cep, '')::bigint, 0) - $${c}::bigint) asc, status = 'livre' desc`;
    }
    const cols = LIST_COLS.split(", ").map((c) => `lares.${c}`).join(", ");
    const sql = `select ${cols}, ${distance}, (select volunteer_name from lares_claims c where c.home_id = lares.id and c.released_at is null) as calling_by
      from lares left join lares_geo g on g.cep = lares.cep ${where.length ? "where " + where.join(" and ") : ""} order by ${order} limit ${limit} offset ${offset}`;
    const { rows } = await pool.query(sql, params);
    res.json({ homes: rows });
  });

  /** A visitor's CEP → bairro, city, state and coordinates, from the CEP directory in our own database. */
  r.get("/cep/:cep", async (req, res) => {
    const cep = String(req.params.cep).replace(/\D/g, "");
    if (!/^\d{8}$/.test(cep)) return res.status(400).json({ error: "cep" });
    const { rows } = await pool.query(`select lat, lng, bairro, city, state from lares_geo where cep = $1 and lat is not null`, [cep]);
    if (rows[0]?.city) return res.json({ cep, city: rows[0].city, state: rows[0].state, neighbourhood: rows[0].bairro, lat: rows[0].lat, lng: rows[0].lng });
    // Not in the directory (new CEP): names from BrasilAPI, no coordinates. The list then falls back to CEP proximity.
    try {
      const b = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, { headers: { "user-agent": "boranois.web.app (boranois@kupfer.co)" } });
      if (b.ok) { const d = (await b.json()) as { city?: string; state?: string; neighborhood?: string }; if (d.city && d.state) return res.json({ cep, city: d.city, state: d.state, neighbourhood: d.neighborhood ?? null, lat: rows[0]?.lat ?? null, lng: rows[0]?.lng ?? null }); }
    } catch {}
    res.status(404).json({ error: "not_found" });
  });

  const cache = new Map<string, { at: number; body: unknown }>();
  const cached = async (key: string, ttlMs: number, make: () => Promise<unknown>) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.body;
    const body = await make(); cache.set(key, { at: Date.now(), body }); return body;
  };

  r.get("/stats", async (_req, res) => {
    await expire();
    res.json(await cached("stats", 20_000, async () => {
    const [byStatus, byState, helpers, calling] = await Promise.all([
      pool.query(`select status, count(*)::int n from lares group by status`),
      pool.query(`select state, count(*)::int total, count(*) filter (where status in ('interessados','ajudantes','resolvido'))::int interested, count(*) filter (where status <> 'livre' or tries > 0)::int touched from lares group by state order by total desc`),
      pool.query(`select count(*)::int n from lares_helpers`),
      pool.query(`select count(*)::int n from lares_claims where released_at is null`),
    ]);
    const status: Record<string, number> = {};
    for (const x of byStatus.rows) status[x.status] = x.n;
    const total = Object.values(status).reduce((a, b) => a + b, 0);
    return { total, byStatus: status, byState: byState.rows, helpers: helpers.rows[0].n, callingNow: calling.rows[0].n };
    }));
  });

  r.get("/cities", async (req, res) => {
    const state = String(req.query.state ?? "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) return res.status(400).json({ error: "state" });
    res.json(await cached(`cities:${state}`, 300_000, async () => {
      const { rows } = await pool.query(`select city, count(*)::int n from lares where state = $1 group by city order by n desc, city`, [state]);
      return { cities: rows };
    }));
  });

  r.post("/helpers", async (req, res) => {
    const body = Helper.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const h = body.data;
    await pool.query(
      `insert into lares_helpers (id, name, contact, cep, neighbourhood, city, state, home_id) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [newId(), h.name, h.contact, h.cep ?? null, h.neighbourhood ?? null, h.city ?? null, h.state ?? null, h.homeId ?? null],
    );
    res.status(201).json({ ok: true });
  });

  r.get("/:id", async (req, res) => {
    await expire();
    const { rows } = await pool.query(`select * from lares where id = $1`, [req.params.id]);
    const home = rows[0];
    if (!home) return res.status(404).json({ error: "not_found" });
    const claim = await activeClaim(home.id);
    const helpers = await pool.query(`select name, contact, neighbourhood, created_at from lares_helpers where home_id = $1 order by created_at`, [home.id]);
    const history = await pool.query(`select volunteer_name, outcome, claimed_at, released_at from lares_claims where home_id = $1 order by claimed_at desc limit 10`, [home.id]);
    res.json({
      home,
      // The e-mail stays server-side; the page compares its own stored e-mail via `mine`.
      calling: claim ? { name: claim.volunteer_name, since: claim.updated_at, mine: req.get("x-volunteer-email")?.toLowerCase() === claim.volunteer_email } : null,
      helpers: helpers.rows,
      history: history.rows,
    });
  });

  /** "Estou ligando": one active claim per home. */
  r.post("/:id/claim", async (req, res) => {
    const body = Volunteer.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    await expire();
    const { rows } = await pool.query(`select id, status from lares where id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "not_found" });
    const claim = await activeClaim(req.params.id);
    if (claim && claim.volunteer_email !== body.data.email) return res.status(409).json({ error: "claimed", by: claim.volunteer_name });
    if (!claim) {
      await pool.query(`insert into lares_claims (id, home_id, volunteer_name, volunteer_email) values ($1,$2,$3,$4)`, [newId(), req.params.id, body.data.name, body.data.email]);
      await pool.query(`update lares set status = 'ligando', updated_at = now() where id = $1`, [req.params.id]);
    }
    res.json({ ok: true });
  });

  /** Lets go of a home without calling. */
  r.post("/:id/release", async (req, res) => {
    const body = Volunteer.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const claim = await activeClaim(req.params.id);
    if (!claim || claim.volunteer_email !== body.data.email) return res.status(409).json({ error: "not_yours" });
    await pool.query(`update lares_claims set released_at = now(), outcome = 'desistiu' where id = $1`, [claim.id]);
    await pool.query(`update lares set status = 'livre', updated_at = now() where id = $1 and status = 'ligando'`, [req.params.id]);
    res.json({ ok: true });
  });

  /** What the call produced. Closes the claim and moves the home on. */
  r.post("/:id/outcome", async (req, res) => {
    const body = Outcome.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const o = body.data;
    await expire();
    const claim = await activeClaim(req.params.id);
    if (claim && claim.volunteer_email !== o.email) return res.status(409).json({ error: "claimed", by: claim.volunteer_name });
    const { rows } = await pool.query(`select id, notes from lares where id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "not_found" });
    const stamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const line = o.notes ? `${stamp} ${o.name}: ${o.notes}` : null;
    const notes = [rows[0].notes, line].filter(Boolean).join("\n").slice(-4000) || null;
    await pool.query(
      `update lares set status = $2, tries = tries + 1, last_outcome = $3, interested_count = coalesce($4, interested_count), notes = $5, updated_at = now() where id = $1`,
      [req.params.id, STATUS_AFTER[o.outcome], o.outcome, o.interested ?? null, notes],
    );
    if (claim) await pool.query(`update lares_claims set released_at = now(), outcome = $2, updated_at = now() where id = $1`, [claim.id, o.outcome]);
    else await pool.query(`insert into lares_claims (id, home_id, volunteer_name, volunteer_email, released_at, outcome) values ($1,$2,$3,$4,now(),$5)`, [newId(), req.params.id, o.name, o.email, o.outcome]);
    res.json({ ok: true });
  });

  return r;
}
