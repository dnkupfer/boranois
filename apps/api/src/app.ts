import express, { type NextFunction, type Request, type Response } from "express";
import {
  ActionId,
  ChipUsageRequest,
  ClassifyRequest,
  InterpretRequest,
  CreateContactRequest,
  InteractionRequest,
  MagicLinkRequest,
  NextStepRequest,
  UpdateMeRequest,
  VerifyRequest,
  WORRIES,
  labelOf,
  type CatalogueResponse,
  type Contact,
  type MagicLinkResponse,
  type MeResponse,
  type Member,
  type NextStepResponse,
  type QuestionsResponse,
  type Step,
  type VerifyResponse,
} from "@boranois/shared";
import { toPublic, type Catalogue } from "./catalogue.js";
import { afterOutcome, afterSent, buildGuide, match, nextStep, priority, renderTemplate } from "./engine.js";
import { AiUnavailable, type Phraser } from "./gemini.js";
import { hashToken, newToken } from "./ids.js";
import type { Store } from "./store/index.js";
import type { ContactRecord } from "./store/types.js";

type Deps = {
  store: Store;
  catalogue: Catalogue;
  phraser: Phraser;
  webOrigin: string;
  /** Sends the magic link. When absent (local dev), the link is logged and returned to the client. */
  sendEmail?: (to: string, link: string) => Promise<void>;
  today?: () => string;
};
type AuthedRequest = Request & { member: Member };

const localDate = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
const LOGIN_TTL_MS = 30 * 60 * 1000;

export function createApp({ store, catalogue, phraser, webOrigin, sendEmail, today = localDate }: Deps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "32kb" }));

  const auth = async (req: Request, res: Response, next: NextFunction) => {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const member = token ? await store.memberBySessionHash(hashToken(token)) : null;
    if (!member) return res.status(401).json({ error: "unauthorized" });
    (req as AuthedRequest).member = member;
    next();
  };
  const personaOf = (c: ContactRecord) => catalogue.personas.find((p) => p.id === c.match.personaId)!;
  const toContact = ({ memberId: _m, lastSaying: _l, ...c }: ContactRecord): Contact => c;

  const api = express.Router();

  api.get("/health", (_req, res) => res.json({ ok: true, ai: phraser.available, catalogue: catalogue.version }));

  // Published on purpose: anyone can read how people are grouped and what we never do.
  api.get("/catalogue", (_req, res) => {
    res.json({ version: catalogue.version, personas: catalogue.personas.map(toPublic) } satisfies CatalogueResponse);
  });

  // The question flow, public so the "adicionar pessoa" screens are content-driven.
  api.get("/questions", (_req, res) => res.json(catalogue.questions satisfies QuestionsResponse));

  /** Anonymous chip counts. Lets us learn which chips are used and which are missing. */
  api.post("/chips/usage", auth, async (req, res) => {
    const body = ChipUsageRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    for (const a of body.data.answers) {
      for (const o of a.optionIds) await store.countChipUsage(a.questionId, o);
      for (const t of a.custom) await store.countChipProposal(a.questionId, t);
    }
    res.json({ ok: true });
  });
  api.get("/chips/stats", auth, async (_req, res) => res.json(await store.chipStats()));

  /** A typed answer: the model maps it onto the tree; the result is validated and counted anonymously. */
  api.post("/chips/interpret", auth, async (req, res) => {
    const body = InterpretRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const question = catalogue.questions.questions.find((q) => q.id === body.data.questionId);
    if (!question) return res.status(404).json({ error: "unknown_question" });
    if (!phraser.available) return res.status(503).json({ error: "ai_unavailable" });
    let out;
    try {
      out = await phraser.interpret(question, catalogue.questions.questions, body.data.text);
    } catch (err) {
      if (err instanceof AiUnavailable) return res.status(503).json({ error: err.reason === "quota" ? "ai_quota" : "ai_error" });
      throw err;
    }
    await store.countChipProposal(question.id, body.data.text, out.optionId ?? (out.blocked ? "blocked" : Object.keys(out.sets).length ? "sets" : "tags"));
    res.json(out);
  });

  // --- Sign-in by magic link ------------------------------------------------

  api.post("/auth/link", async (req, res) => {
    const body = MagicLinkRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_email" });
    const token = newToken();
    await store.createLogin(body.data.email, hashToken(token), new Date(Date.now() + LOGIN_TTL_MS));
    const link = `${webOrigin}/entrar?t=${token}`;
    if (sendEmail) {
      await sendEmail(body.data.email, link);
      return res.json({ sent: true } satisfies MagicLinkResponse);
    }
    console.log(`[dev] magic link for ${body.data.email}: ${link}`);
    res.json({ sent: true, devLink: link } satisfies MagicLinkResponse);
  });

  api.post("/auth/verify", async (req, res) => {
    const body = VerifyRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    const email = await store.consumeLogin(hashToken(body.data.t));
    if (!email) return res.status(401).json({ error: "link_invalid" });
    const member = await store.memberByEmailOrCreate(email);
    const token = newToken();
    await store.createSession(member.id, hashToken(token));
    res.json({ token, member } satisfies VerifyResponse);
  });

  api.get("/me", auth, (req, res) => res.json({ member: (req as AuthedRequest).member } satisfies MeResponse));

  api.put("/me", auth, async (req, res) => {
    const body = UpdateMeRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_request" });
    res.json({ member: await store.setMemberName((req as AuthedRequest).member.id, body.data.name) } satisfies MeResponse);
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
      chips,
      match: m,
      priority: priority(catalogue, persona, chips, []),
      state: "novo",
      stepsDone: [],
      lastSaying: null,
      lastSentAt: null,
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

  /** The next step, phrased, plus the guide. Nickname, note and voice sample are used here and not stored. */
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
          donts: persona.avoid.map((a) => a.what),
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
      donts: persona.avoid.map((a) => a.what),
      waitHours: planned.waitHours,
    };
    res.json({ contact: toContact(contact), step, guide: buildGuide(persona) } satisfies NextStepResponse);
  });

  /** "Já mandei" (or "pular"): the step is done. */
  api.post("/contacts/:id/sent", auth, async (req, res) => {
    const contact = await store.getContact((req as AuthedRequest).member.id, String(req.params.id));
    if (!contact) return res.status(404).json({ error: "not_found" });
    const stepId = String(req.body?.stepId ?? "");
    const action = ActionId.safeParse(req.body?.action);
    if (!stepId || !action.success) return res.status(400).json({ error: "invalid_request" });
    const skipped = req.body?.skipped === true;
    const stepsDone = contact.stepsDone.includes(stepId) ? contact.stepsDone : [...contact.stepsDone, stepId];
    const sends = !skipped && action.data !== "parar" && action.data !== "pausar";
    const updated = await store.updateContact(contact.id, {
      stepsDone,
      state: skipped ? contact.state : afterSent(contact.state, action.data),
      lastSaying: skipped ? contact.lastSaying : null,
      ...(sends ? { lastSentAt: new Date().toISOString() } : {}),
    });
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
    try {
      res.json(await phraser.classify(body.data.text));
    } catch (err) {
      if (err instanceof AiUnavailable) return res.status(503).json({ error: err.reason === "quota" ? "ai_quota" : "ai_error" });
      throw err;
    }
  });

  app.use("/api", api);
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal" });
  });
  return app;
}
