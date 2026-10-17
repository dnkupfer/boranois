import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
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
};

export function loadCatalogue(dir = process.env.CONTENT_DIR ?? resolve(process.cwd(), "../../content")): Catalogue {
  const read = (name: string) => JSON.parse(readFileSync(join(dir, name), "utf8"));
  const personaFiles = readdirSync(join(dir, "personas")).filter((f) => f.endsWith(".json")).sort();
  const personas = personaFiles.map((f) => PersonaSchema.parse(read(join("personas", f))));
  const facts = z.array(FactSchema).parse(read("facts.json"));
  const contents = z.array(ContentSchema).parse(read("contents.json"));
  const defaults = DefaultsSchema.parse(read("defaults.json"));
  const scoring = ScoringSchema.parse(read("scoring.json"));

  const problems = check({ personas, facts, contents, defaults });
  if (problems.length) throw new Error(`Catalogue problems:\n- ${problems.join("\n- ")}`);

  const version = createHash("sha256")
    .update(JSON.stringify({ personas, facts, contents, defaults, scoring }))
    .digest("hex")
    .slice(0, 10);

  return {
    version,
    personas,
    facts: facts.filter((f) => f.verified),
    contents: contents.filter((c) => c.approved),
    defaults,
    scoring,
  };
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
