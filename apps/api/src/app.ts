import express, { type NextFunction, type Request, type Response } from "express";
import { timingSafeEqual } from "node:crypto";
import {
  ActionId,
  ClassifyRequest,
  CreateContactRequest,
  CreateInvitesRequest,
  InteractionRequest,
  JoinRequest,
  MAX_INVITES_PER_GROUP,
  NextStepRequest,
  WORRIES,
  labelOf,
  type CatalogueResponse,
  type Contact,
  type JoinResponse,
  type MeResponse,
  type NextStepResponse,
  type Step,
} from "@boranois/shared";
import { toPublic, type Catalogue } from "./catalogue.js";
import { afterOutcome, afterSent, match, nextStep, priority, renderTemplate } from "./engine.js";
import type { Phraser } from "./gemini.js";
import { hashToken, newToken, normalizeCode } from "./ids.js";
import type { Store } from "./store/index.js";
import type { ContactRecord, MemberRecord } from "./store/types.js";

type Deps = { store: Store; catalogue: Catalogue; phraser: Phraser; adminToken?: string; today?: () => string };
type AuthedRequest = Request & { member: MemberRecord };

const localDate = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD

export function createApp({ store, catalogue, phraser, adminToken, today = localDate }: Deps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "32kb" }));

  const auth = async (req: Request, res: Response, next: NextFunction) => {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const member = token ? await store.memberByTokenHash(hashToken(token)) : null;
    if (!member) return res.status(401).json({ error: "unauthorized" });
    (req as AuthedRequest).member = member;
    next();
  };
  const hostOnly = (req: Request, res: Response, next: NextFunction) => {
    if ((req as AuthedRequest).member.role !== "host") return res.status(403).json({ error: "host_only" });
    next();
  };
  const personaOf = (c: ContactRecord) => catalogue.personas.find((p) => p.id === c.match.personaId)!;
  const toContact = ({ memberId: _m, groupId: _g, lastSaying: _l, ...c }: ContactRecord): Contact => c;

  const api = express.Router();

  api.get("/health", (_req, res) => res.json({ ok: true, ai: phraser.available, catalogue: catalogue.version }));

  // Published, on purpose: anyone can read how people are grouped and what we never do.
  api.get("/catalogue", (_req, res) => {
    res.json({ version: catalogue.version, personas: catalogue.personas.map(toPublic) } satisfies CatalogueResponse);
  });

  api.post("/join", async (req, res) => {
    const body = JoinRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const token = newToken();
    const result = await store.redeemInvite(normalizeCode(body.data.code), body.data.name, hashToken(token));
    if (!result.ok) return res.status(result.error === "used" ? 409 : 404).json({ error: result.error });
    const { groupId: _, ...member } = result.member;
    res.json({ token, member } satisfies JoinResponse);
  });

  api.get("/me", auth, async (req, res) => {
    const { groupId, ...member } = (req as AuthedRequest).member;
    const invites = member.role === "host" ? await store.listInvites(groupId) : [];
    res.json({ member, invites } satisfies MeResponse);
  });

  api.post("/invites", auth, hostOnly, async (req, res) => {
    const body = CreateInvitesRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const groupId = (req as AuthedRequest).member.groupId;
    const existing = await store.listInvites(groupId);
    if (existing.length + body.data.contacts.length > MAX_INVITES_PER_GROUP) return res.status(409).json({ error: "invite_limit" });
    res.json({ invites: await store.createInvites(groupId, body.data.contacts) });
  });

  // --- Pessoas -------------------------------------------------------------

  api.get("/contacts", auth, async (req, res) => {
    const list = await store.listContacts((req as AuthedRequest).member.id);
    res.json({ contacts: list.map(toContact) });
  });

  api.post("/contacts", auth, async (req, res) => {
    const body = CreateContactRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const member = (req as AuthedRequest).member;
    const { chips, personaId } = body.data;

    let m = match(catalogue, chips);
    if (personaId) {
      const chosen = catalogue.personas.find((p) => p.id === personaId && p.situations.includes(chips.situation));
      if (!chosen) return res.status(400).json({ error: "invalid_persona" });
      m = { personaId: chosen.id, personaName: chosen.name, because: ["escolhido por você"], alternative: null };
    }
    const persona = catalogue.personas.find((p) => p.id === m.personaId)!;
    const contact = await store.createContact({
      memberId: member.id,
      groupId: member.groupId,
      chips,
      match: m,
      priority: priority(catalogue, persona, chips, []),
      state: "novo",
      stepsDone: [],
      lastSaying: null,
      catalogueVersion: catalogue.version,
    });
    res.json(toContact(contact));
  });

  api.put("/contacts/:id/persona", auth, async (req, res) => {
    const contact = await store.getContact((req as AuthedRequest).member.id, String(req.params.id));
    if (!contact) return res.status(404).json({ error: "not_found" });
    const chosen = catalogue.personas.find((p) => p.id === req.body?.personaId && p.situations.includes(contact.chips.situation));
    if (!chosen) return res.status(400).json({ error: "invalid_persona" });
    const m = { personaId: chosen.id, personaName: chosen.name, because: ["escolhido por você"], alternative: null };
    const outcomes = await store.listOutcomes(contact.id);
    const updated = await store.updateContact(contact.id, { match: m, priority: priority(catalogue, chosen, contact.chips, outcomes), stepsDone: [] });
    res.json(toContact(updated));
  });

  api.delete("/contacts/:id", auth, async (req, res) => {
    await store.deleteContact((req as AuthedRequest).member.id, String(req.params.id));
    res.json({ ok: true });
  });

  /** The next step, phrased. Nickname, note and voice sample are used here and not stored. */
  api.post("/contacts/:id/next", auth, async (req, res) => {
    const body = NextStepRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const contact = await store.getContact((req as AuthedRequest).member.id, String(req.params.id));
    if (!contact) return res.status(404).json({ error: "not_found" });
    const persona = personaOf(contact);

    const planned = nextStep(catalogue, {
      persona,
      chips: contact.chips,
      state: contact.state,
      stepsDone: contact.stepsDone,
      lastSaying: contact.lastSaying,
      today: today(),
    });

    const nome = body.data.nickname || "você";
    const preocupacao = contact.chips.worries[0] ? labelOf(WORRIES, contact.chips.worries[0]).toLowerCase() : undefined;
    const template = planned.template
      ? renderTemplate(planned.template, { nome, fato: planned.fact?.text, conteudo: planned.content?.url, preocupacao })
      : "";

    let message: string | null = template || null;
    let phrased = false;
    if (template && planned.action !== "parar" && planned.action !== "pausar") {
      const out = await phraser
        .phrase({
          template,
          factText: planned.fact?.text ?? null,
          contentSummary: planned.content?.summary ?? null,
          nickname: nome,
          relation: contact.chips.relation,
          note: body.data.note,
          voiceSample: body.data.voiceSample,
          donts: persona.donts,
          maxChars: catalogue.scoring.phrasing.maxChars,
        })
        .catch((err) => (console.error("phrase failed", err), null));
      if (out) (message = out), (phrased = true);
    }

    const step: Step = {
      id: planned.id,
      action: planned.action,
      title: planned.title,
      why: planned.why,
      message,
      fact: planned.fact ? { id: planned.fact.id, text: planned.fact.text, sourceName: planned.fact.sourceName, sourceUrl: planned.fact.sourceUrl } : null,
      content: planned.content
        ? { id: planned.content.id, url: planned.content.url, type: planned.content.type, summary: planned.content.summary, messenger: planned.content.messenger }
        : null,
      phrased,
      donts: persona.donts,
    };
    res.json({ contact: toContact(contact), step } satisfies NextStepResponse);
  });

  /** "Já mandei": the step is done, now we wait. */
  api.post("/contacts/:id/sent", auth, async (req, res) => {
    const contact = await store.getContact((req as AuthedRequest).member.id, String(req.params.id));
    if (!contact) return res.status(404).json({ error: "not_found" });
    const stepId = String(req.body?.stepId ?? "");
    const action = ActionId.safeParse(req.body?.action);
    if (!stepId || !action.success) return res.status(400).json({ error: "invalid_request" });
    const stepsDone = contact.stepsDone.includes(stepId) ? contact.stepsDone : [...contact.stepsDone, stepId];
    const skipped = req.body?.skipped === true; // "Pular": done, but nothing was sent
    const updated = await store.updateContact(contact.id, { stepsDone, state: skipped ? contact.state : afterSent(contact.state, action.data), lastSaying: skipped ? contact.lastSaying : null });
    res.json(toContact(updated));
  });

  /** What happened after a step. Drives the state machine and the priority. */
  api.post("/contacts/:id/interactions", auth, async (req, res) => {
    const body = InteractionRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const member = (req as AuthedRequest).member;
    const contact = await store.getContact(member.id, String(req.params.id));
    if (!contact) return res.status(404).json({ error: "not_found" });

    await store.insertInteraction({
      contactId: contact.id,
      memberId: member.id,
      stepId: body.data.stepId,
      outcome: body.data.outcome,
      saying: body.data.saying ?? null,
      catalogueVersion: catalogue.version,
    });
    const outcomes = await store.listOutcomes(contact.id);
    const updated = await store.updateContact(contact.id, {
      state: afterOutcome(contact.state, body.data.outcome),
      priority: priority(catalogue, personaOf(contact), contact.chips, outcomes),
      lastSaying: body.data.outcome === "discordou" ? (body.data.saying ?? null) : null,
    });
    res.json(toContact(updated));
  });

  /** Turns a pasted reply into chips. The text is not stored. */
  api.post("/classify", auth, async (req, res) => {
    const body = ClassifyRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    if (!phraser.available) return res.status(503).json({ error: "ai_unavailable" });
    res.json(await phraser.classify(body.data.text));
  });

  // Issues a host code (starts a new group). Protected by ADMIN_TOKEN.
  api.post("/admin/host-codes", async (req, res) => {
    const given = Buffer.from(req.get("x-admin-token") ?? "");
    const expected = Buffer.from(adminToken ?? "");
    if (!adminToken || given.length !== expected.length || !timingSafeEqual(given, expected)) return res.status(401).json({ error: "unauthorized" });
    res.json({ code: await store.createHostCode() });
  });

  app.use("/api", api);
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal" });
  });
  return app;
}
