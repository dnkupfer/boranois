import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  FREQUENCIES,
  GROUPS,
  INFLUENCERS,
  RELATIONS,
  SAYINGS,
  SITUATIONS,
  TRUST_LOSS,
  WORRIES,
  FrequencyId,
  RelationId,
  ActionId,
  ContactState,
  GroupId,
  InfluencerId,
  PRIORITIES,
  TrustLossId,
  SayingId,
  SituationId,
  WorryId,
  type PublicPersona,
  type Question,
} from "@boranois/shared";

// The catalogue is editorial content, written and reviewed by people (see content/README.md).
// It is loaded once at startup, validated, and stamped with a version so every
// recommendation can be traced back to the exact content that produced it.

export const StepSchema = z.object({
  id: z.string().min(1).max(60),
  action: ActionId,
  when: z.array(ContactState).min(1),
  title: z.string().min(1),
  why: z.string().min(1),
  template: z.string(),
  facts: z.array(z.string()).default([]),
});
export type StepDef = z.infer<typeof StepSchema>;

const ObjectionSchema = z.object({ title: z.string(), template: z.string().min(1), facts: z.array(z.string()).default([]) });

export const PersonaSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  name: z.string().min(1),
  situations: z.array(SituationId).min(1),
  default_for: z.array(SituationId).default([]),
  summary: z.string().min(1),
  profile: z.object({
    trust_story: z.string().min(1),
    feelings: z.array(z.string()).min(1),
    identity: z.string().min(1),
    media_diet: z.array(z.string()),
    shuts_down: z.array(z.string()),
    opens_up: z.array(z.string()),
    would_believe: z.array(z.string()).min(1),
    turning_point: z.string().min(1),
  }),
  signals: z.object({
    sayings: z.partialRecord(SayingId, z.number()).default({}),
    worries: z.partialRecord(WorryId, z.number()).default({}),
    groups: z.partialRecord(GroupId, z.number()).default({}),
    influencers: z.partialRecord(InfluencerId, z.number()).default({}),
    trust_loss: z.partialRecord(TrustLossId, z.number()).default({}),
  }),
  engage: z.boolean(),
  priority_base: z.enum(PRIORITIES),
  /** Suggested hours to wait for a reply before nudging. */
  wait_hours: z.number().int().min(1).max(168).default(24),
  /** Specific and actionable: timing, channel, wording, what to do with her reply. */
  tactics: z.array(z.object({ title: z.string().min(1), detail: z.string().min(1) })).min(1),
  avoid: z.array(z.object({ what: z.string().min(1), why: z.string().min(1) })),
  steps: z.array(StepSchema),
  objections: z.partialRecord(SayingId, ObjectionSchema).default({}),
});
export type PersonaDef = z.infer<typeof PersonaSchema>;

export const FactSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  text: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
  worries: z.array(WorryId).default([]),
  situations: z.array(SituationId).default([]),
  verified: z.boolean(),
});
export type FactDef = z.infer<typeof FactSchema>;

export const ContentSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  url: z.string().url(),
  type: z.enum(["video", "post", "texto"]),
  summary: z.string().min(1),
  messenger: z.string().min(1),
  messengerGroups: z.array(GroupId).default([]),
  worries: z.array(WorryId).default([]),
  personas: z.array(z.string()).default([]),
  approved: z.boolean().default(false),
});
export type ContentDef = z.infer<typeof ContentSchema>;

const TAXONOMIES: Record<string, readonly { id: string; label: string }[]> = {
  SITUATIONS, RELATIONS, GROUPS, SAYINGS, WORRIES, INFLUENCERS, TRUST_LOSS, FREQUENCIES,
};
const TAXONOMY_SETS: Record<string, string> = {
  SITUATIONS: "situation", RELATIONS: "relation", GROUPS: "groups", SAYINGS: "sayings", WORRIES: "worries",
  INFLUENCERS: "influencers", TRUST_LOSS: "trustLoss", FREQUENCIES: "frequency",
};

const ChipSetsSchema = z.object({
  sayings: z.array(SayingId).optional(),
  worries: z.array(WorryId).optional(),
  groups: z.array(GroupId).optional(),
  influencers: z.array(InfluencerId).optional(),
  trustLoss: z.array(TrustLossId).optional(),
  situation: SituationId.optional(),
  relation: RelationId.optional(),
  frequency: FrequencyId.optional(),
});
const QuestionSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  text: z.string().min(1),
  hint: z.string().optional(),
  options: z.union([z.string(), z.array(z.object({ id: z.string().regex(/^[a-z0-9_]+$/), label: z.string().min(1), sets: ChipSetsSchema.optional() }))]),
  max: z.number().int().min(1).optional(),
  optional: z.boolean().default(false),
  allowCustom: z.boolean().default(false),
  next: z.union([z.string(), z.record(z.string(), z.string()), z.null()]),
});
const QuestionsSchema = z.object({ start: z.string(), questions: z.array(QuestionSchema).min(1) });

/** Expands taxonomy names into options whose `sets` point at that taxonomy's chip. */
function expandQuestion(q: z.infer<typeof QuestionSchema>): Question {
  if (typeof q.options !== "string") return { ...q, options: q.options };
  const list = TAXONOMIES[q.options];
  const key = TAXONOMY_SETS[q.options];
  if (!list) throw new Error(`question ${q.id}: unknown taxonomy ${q.options}`);
  const single = key === "situation" || key === "relation" || key === "frequency";
  return { ...q, options: list.map((o) => ({ id: o.id, label: o.label, sets: { [key]: single ? o.id : [o.id] } as Question["options"][number]["sets"] })) };
}

const DefaultsSchema = z.object({
  steps: z.array(StepSchema),
  followups: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string(), template: z.string() })),
});

const ScoringSchema = z.object({
  version: z.number(),
  match: z.object({ uncertainMargin: z.number(), minScore: z.number() }),
  priority: z.object({
    sharedGroup: z.number(),
    frequency: z.record(z.string(), z.number()),
    sayings: z.partialRecord(SayingId, z.number()).default({}),
    outcomes: z.record(z.string(), z.number()),
  }),
  phrasing: z.object({ maxChars: z.number() }),
});
export type Scoring = z.infer<typeof ScoringSchema>;

export type Catalogue = {
  version: string;
  personas: PersonaDef[];
  /** Only verified facts. Unverified ones never reach a member. */
  facts: FactDef[];
  /** Only approved contents. */
  contents: ContentDef[];
  defaults: z.infer<typeof DefaultsSchema>;
  scoring: Scoring;
  questions: { start: string; questions: Question[] };
};

export function loadCatalogue(dir = process.env.CONTENT_DIR ?? resolve(process.cwd(), "../../content")): Catalogue {
  const read = (name: string) => JSON.parse(readFileSync(join(dir, name), "utf8"));
  const personaFiles = readdirSync(join(dir, "personas")).filter((f) => f.endsWith(".json")).sort();
  const personas = personaFiles.map((f) => PersonaSchema.parse(read(join("personas", f))));
  const facts = z.array(FactSchema).parse(read("facts.json"));
  const contents = z.array(ContentSchema).parse(read("contents.json"));
  const defaults = DefaultsSchema.parse(read("defaults.json"));
  const scoring = ScoringSchema.parse(read("scoring.json"));
  const qraw = QuestionsSchema.parse(read("questions.json"));
  const questions = { start: qraw.start, questions: qraw.questions.map(expandQuestion) };

  const problems = [...check({ personas, facts, contents, defaults }), ...checkQuestions(questions)];
  if (problems.length) throw new Error(`Catalogue problems:\n- ${problems.join("\n- ")}`);

  const version = createHash("sha256")
    .update(JSON.stringify({ personas, facts, contents, defaults, scoring, questions }))
    .digest("hex")
    .slice(0, 10);

  return {
    version,
    personas,
    facts: facts.filter((f) => f.verified),
    contents: contents.filter((c) => c.approved),
    defaults,
    scoring,
    questions,
  };
}

/** Every `next` must exist, every path must end, and the situation must be asked on every path. */
export function checkQuestions(qs: { start: string; questions: Question[] }): string[] {
  const problems: string[] = [];
  const byId = new Map(qs.questions.map((q) => [q.id, q]));
  if (!byId.has(qs.start)) problems.push(`questions: start ${qs.start} not found`);
  const nextIds = (q: Question) => (q.next === null ? [] : typeof q.next === "string" ? [q.next] : Object.values(q.next));
  for (const q of qs.questions) {
    for (const n of nextIds(q)) if (!byId.has(n)) problems.push(`question ${q.id}: next ${n} not found`);
    if (typeof q.next === "object" && q.next !== null) {
      for (const k of Object.keys(q.next)) if (k !== "*" && !q.options.some((o) => o.id === k)) problems.push(`question ${q.id}: next for unknown option ${k}`);
      if (!("*" in q.next) && !q.optional && !q.allowCustom && q.options.some((o) => !(o.id in (q.next as object)))) problems.push(`question ${q.id}: option without next and no "*"`);
    }
  }
  // Cycle check and "situation asked" check by walking every path (the tree is small).
  const walk = (id: string, seen: string[], sawSituation: boolean) => {
    if (seen.includes(id)) return problems.push(`questions: cycle at ${id}`);
    const q = byId.get(id);
    if (!q) return;
    const asksSituation = sawSituation || q.options.some((o) => o.sets?.situation);
    const nexts = nextIds(q);
    if (nexts.length === 0 && !asksSituation) problems.push(`questions: path ending at ${id} never asked the situation`);
    for (const n of new Set(nexts)) walk(n, [...seen, id], asksSituation);
  };
  walk(qs.start, [], false);
  return problems;
}

/** Referential checks a schema can't express. */
export function check(c: { personas: PersonaDef[]; facts: FactDef[]; contents: ContentDef[]; defaults: z.infer<typeof DefaultsSchema> }) {
  const problems: string[] = [];
  const factIds = new Set(c.facts.map((f) => f.id));
  const personaIds = new Set(c.personas.map((p) => p.id));
  const placeholders = /\{(\w+)\}/g;
  const allowed = new Set(["nome", "fato", "conteudo", "preocupacao"]);

  if (personaIds.size !== c.personas.length) problems.push("duplicate persona ids");
  if (factIds.size !== c.facts.length) problems.push("duplicate fact ids");

  for (const sit of SituationId.options) {
    const defaults = c.personas.filter((p) => p.default_for.includes(sit));
    if (defaults.length !== 1) problems.push(`situation ${sit} needs exactly one default persona, has ${defaults.length}`);
  }

  const checkTemplate = (where: string, template: string, facts: string[]) => {
    for (const m of template.matchAll(placeholders)) {
      if (!allowed.has(m[1])) problems.push(`${where}: unknown placeholder {${m[1]}}`);
    }
    if (template.includes("{fato}") && facts.length === 0 && !where.includes("objections")) {
      // Allowed: the step is skipped until a fact exists. Nothing to report.
    }
    for (const f of facts) if (!factIds.has(f)) problems.push(`${where}: unknown fact ${f}`);
  };

  for (const p of c.personas) {
    if (p.engage && !p.steps.some((s) => s.when.includes("novo"))) problems.push(`${p.id}: no step for state novo`);
    for (const s of p.steps) checkTemplate(`${p.id}/${s.id}`, s.template, s.facts);
    for (const [k, o] of Object.entries(p.objections)) checkTemplate(`${p.id}/objections/${k}`, o.template, o.facts);
  }
  for (const s of c.defaults.steps) checkTemplate(`defaults/${s.id}`, s.template, s.facts);
  for (const ct of c.contents) for (const pid of ct.personas) if (!personaIds.has(pid)) problems.push(`content ${ct.id}: unknown persona ${pid}`);
  return problems;
}

export function toPublic(p: PersonaDef): PublicPersona {
  return {
    id: p.id,
    name: p.name,
    situations: p.situations,
    summary: p.summary,
    profile: p.profile,
    engage: p.engage,
    tactics: p.tactics,
    avoid: p.avoid,
  };
}
