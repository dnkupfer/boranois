import { z } from "zod";

// ---------------------------------------------------------------------------
// Taxonomies. These are the "chips" a member taps about a pessoa. Ids are stable
// (the catalogue references them); labels are what the UI shows.

export const SITUATIONS = [
  { id: "nao_votou", label: "Não votou no 1º turno" },
  { id: "branco_nulo", label: "Votou branco ou nulo" },
  { id: "lula_para_flavio", label: "Votou no Lula e está pensando no Flávio" },
  { id: "flavio_sem_conviccao", label: "Vai votar no Flávio, mas sem convicção" },
  { id: "indeciso", label: "Está em dúvida entre os dois" },
  { id: "votou_outro", label: "Votou em outro candidato no 1º turno" },
  { id: "vai_votar_lula", label: "Vai votar no Lula" },
  { id: "flavio_convicto", label: "Vai votar no Flávio e defende" },
] as const;

export const RELATIONS = [
  { id: "familia", label: "Família" },
  { id: "amigo", label: "Amigo(a)" },
  { id: "vizinho", label: "Vizinho(a)" },
  { id: "colega", label: "Colega" },
] as const;

// Social groups / information environments. Also used for the member's own groups.
export const GROUPS = [
  { id: "igreja_evangelica", label: "Igreja evangélica" },
  { id: "igreja_catolica", label: "Igreja católica" },
  { id: "familia", label: "Grupo da família" },
  { id: "trabalho", label: "Trabalho" },
  { id: "agro", label: "Campo / agro" },
  { id: "seguranca_publica", label: "Polícia / militar" },
  { id: "estudantes", label: "Estudantes" },
  { id: "bairro", label: "Bairro / comunidade" },
] as const;

export const WORRIES = [
  { id: "custo_de_vida", label: "Custo de vida" },
  { id: "emprego", label: "Emprego" },
  { id: "aposentadoria", label: "Aposentadoria" },
  { id: "seguranca", label: "Segurança" },
  { id: "valores_familia", label: "Valores e família" },
  { id: "corrupcao", label: "Corrupção" },
  { id: "saude", label: "Saúde" },
  { id: "educacao", label: "Educação" },
] as const;

// Things the pessoa says. The most discriminating signal for matching a persona.
export const SAYINGS = [
  { id: "nao_adianta", label: "“Não adianta votar”" },
  { id: "todos_iguais", label: "“São todos iguais”" },
  { id: "nenhum_dos_dois", label: "“Não gosto de nenhum dos dois”" },
  { id: "nao_consegui", label: "“Não consegui ir votar”" },
  { id: "medo_piorar", label: "“E se eu votar e piorar?”" },
  { id: "ja_decidido", label: "“Já está decidido, não precisa de mim”" },
  { id: "raiva", label: "“Anulei de raiva”" },
  { id: "nao_melhorou", label: "“Com o Lula não melhorou nada”" },
  { id: "esquerda_familia", label: "“A esquerda é contra a família”" },
  { id: "bandido_medo", label: "“Bandido tem que ter medo”" },
  { id: "ja_deu", label: "“O Lula já deu o que tinha que dar”" },
  { id: "lula_ladrao", label: "“O Lula é ladrão”" },
  { id: "nunca_muda", label: "“Nunca vou mudar de ideia”" },
] as const;

// Who she follows / listens to. Real public figures and outlets; strong signals of her information world.
export const INFLUENCERS = [
  { id: "nikolas", label: "Nikolas Ferreira" },
  { id: "janones", label: "André Janones" },
  { id: "felipe_neto", label: "Felipe Neto" },
  { id: "marcal", label: "Pablo Marçal" },
  { id: "malafaia", label: "Silas Malafaia" },
  { id: "padres_pastores", label: "O pastor / padre dela" },
  { id: "jovem_pan", label: "Jovem Pan" },
  { id: "globo", label: "Jornal Nacional / Globo" },
  { id: "choquei", label: "Choquei e páginas de fofoca" },
  { id: "brasil_paralelo", label: "Brasil Paralelo" },
  { id: "nenhum", label: "Ninguém de política" },
] as const;

// When she stopped believing (in the PT / in politics).
export const TRUST_LOSS = [
  { id: "mensalao", label: "Mensalão (2005)" },
  { id: "lava_jato", label: "Lava Jato / petrolão" },
  { id: "inss", label: "Descontos do INSS (2025)" },
  { id: "pandemia", label: "Pandemia" },
  { id: "local", label: "Um político da cidade" },
  { id: "nunca", label: "Nunca acreditou" },
  { id: "ainda", label: "Ainda acredita, só desanimou" },
  { id: "nao_sei", label: "Não sei" },
] as const;

export const FREQUENCIES = [
  { id: "diario", label: "Quase todo dia" },
  { id: "semanal", label: "Toda semana" },
  { id: "raro", label: "De vez em quando" },
] as const;

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((x) => x.id) as unknown as [T[number]["id"], ...T[number]["id"][]];

export const SituationId = z.enum(ids(SITUATIONS));
export const RelationId = z.enum(ids(RELATIONS));
export const GroupId = z.enum(ids(GROUPS));
export const WorryId = z.enum(ids(WORRIES));
export const SayingId = z.enum(ids(SAYINGS));
export const FrequencyId = z.enum(ids(FREQUENCIES));
export const InfluencerId = z.enum(ids(INFLUENCERS));
export const TrustLossId = z.enum(ids(TRUST_LOSS));
export type SituationId = z.infer<typeof SituationId>;
export type RelationId = z.infer<typeof RelationId>;
export type GroupId = z.infer<typeof GroupId>;
export type WorryId = z.infer<typeof WorryId>;
export type SayingId = z.infer<typeof SayingId>;
export type FrequencyId = z.infer<typeof FrequencyId>;
export type InfluencerId = z.infer<typeof InfluencerId>;
export type TrustLossId = z.infer<typeof TrustLossId>;

export const labelOf = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((x) => x.id === id)?.label ?? id;

// ---------------------------------------------------------------------------
// Runtime vocabulary

export const ACTIONS = ["abrir_conversa", "enviar_fato", "enviar_conteudo", "oferecer_ajuda", "lembrar", "pausar", "parar"] as const;
export const ActionId = z.enum(ACTIONS);
export type ActionId = z.infer<typeof ActionId>;

export const CONTACT_STATES = ["novo", "aguardando", "conversando", "objecao", "cortou", "vai_votar", "votou", "perdido", "pausado"] as const;
export const ContactState = z.enum(CONTACT_STATES);
export type ContactState = z.infer<typeof ContactState>;

export const OUTCOMES = [
  { id: "respondeu_bem", label: "Respondeu bem" },
  { id: "fez_pergunta", label: "Fez uma pergunta" },
  { id: "discordou", label: "Discordou" },
  { id: "cortou_assunto", label: "Cortou o assunto" },
  { id: "sem_resposta", label: "Não respondeu" },
  { id: "vai_votar", label: "Disse que vai votar" },
  { id: "votou", label: "Já votou" },
  { id: "nao_vai_votar", label: "Disse que não vai" },
] as const;
export const OutcomeId = z.enum(ids(OUTCOMES));
export type OutcomeId = z.infer<typeof OutcomeId>;

export const PRIORITIES = ["alta", "media", "baixa"] as const;
export type Priority = (typeof PRIORITIES)[number];

// ---------------------------------------------------------------------------
// Requests

export const Chips = z.object({
  situation: SituationId,
  relation: RelationId,
  groups: z.array(GroupId).default([]),
  worries: z.array(WorryId).default([]),
  sayings: z.array(SayingId).default([]),
  influencers: z.array(InfluencerId).default([]),
  trustLoss: z.array(TrustLossId).default([]),
  frequency: FrequencyId,
  /** Answers that don't map to a taxonomy (e.g. "trabalhou no domingo"). Categorical only. */
  tags: z.array(z.string().max(40)).max(30).default([]),
  /**
   * Typed answers to the single-value questions, kept verbatim. `relation`/`frequency` above then hold the
   * nearest known value (from the model) or a neutral one, so the engine can run without flattening the answer.
   */
  custom: z.object({ relation: z.string().max(60).optional(), frequency: z.string().max(60).optional(), situation: z.string().max(60).optional() }).default({}),
  /** Member and pessoa belong to at least one group in common (computed on the member's device). */
  sharedGroup: z.boolean().default(false),
});
export type Chips = z.infer<typeof Chips>;

export const MagicLinkRequest = z.object({ email: z.string().trim().toLowerCase().email().max(120) });
/** `anonToken`: the anonymous session to attach this e-mail to, so the person keeps their pessoas. */
export const VerifyRequest = z.object({ t: z.string().min(10).max(200), anonToken: z.string().max(200).optional() });
export const UpdateMeRequest = z.object({ name: z.string().trim().min(1).max(60) });

/** Create a pessoa. Name, phone and notes never reach the server. */
export const CreateContactRequest = z.object({ chips: Chips, personaId: z.string().max(60).optional() });

/** Ask for the next step, phrased. Note and voice are used for phrasing and not stored. */
export const NextStepRequest = z.object({
  nickname: z.string().trim().max(40),
  note: z.string().trim().max(500).optional(),
  voiceSample: z.string().trim().max(600).optional(),
});

export const InteractionRequest = z.object({
  stepId: z.string().max(60),
  outcome: OutcomeId,
  /** When the pessoa disagreed: what she said, as a chip. */
  saying: SayingId.optional(),
});

/** Which chips were chosen, and which were typed in. Anonymous: counted, never linked to a member or a pessoa. */
export const ChipUsageRequest = z.object({
  answers: z.array(z.object({ questionId: z.string().max(40), optionIds: z.array(z.string().max(40)).max(12), custom: z.array(z.string().trim().min(1).max(60)).max(5).default([]) })).max(30),
});

/** A typed answer ("+ outra") to interpret. The text is counted anonymously, never linked to a pessoa. */
export const InterpretRequest = z.object({ questionId: z.string().max(40), text: z.string().trim().min(1).max(80) });

/**
 * A turn with the coach. The whole conversation travels with the request and lives only in the member's
 * browser tab: the server stores none of it.
 */
export const CoachRequest = z.object({
  nickname: z.string().trim().max(40),
  note: z.string().trim().max(800).optional(),
  voiceSample: z.string().trim().max(600).optional(),
  /** What the pessoa replied, verbatim, when this turn starts from a reply. */
  reply: z.string().trim().max(1500).optional(),
  messages: z.array(z.object({ role: z.enum(["user", "coach"]), text: z.string().trim().min(1).max(1500) })).max(16).default([]),
});
export type CoachMessage = z.infer<typeof CoachRequest>["messages"][number];
export type CoachResponse = {
  /** The coach's reading and advice, short. */
  text: string;
  /** A message the member could send next, in their voice; null when the advice is "don't send anything yet". */
  suggestedMessage: string | null;
  /** When the turn started from a reply: what happened, as chips, to pre-fill. */
  outcome: OutcomeId | null;
  saying: SayingId | null;
};

/** Turn a pasted reply into chips. The text is not stored. */
export const ClassifyRequest = z.object({ text: z.string().trim().min(1).max(1000) });

// ---------------------------------------------------------------------------
// Responses

/** email is null for an anonymous session: the tool works without an account. */
export type Member = { id: string; email: string | null; name: string | null };
/** In production the link is emailed; in development it's returned so the UI can show it. */
export type MagicLinkResponse = { sent: true; devLink?: string };
export type VerifyResponse = { token: string; member: Member };
export type MeResponse = { member: Member };

export type Match = {
  personaId: string;
  personaName: string;
  /** Human-readable signals that fired, e.g. "diz “não adianta votar”". */
  because: string[];
  /** A close second, when the match isn't clear. */
  alternative: { personaId: string; personaName: string } | null;
};

export type PriorityResult = { level: Priority; reasons: string[]; engage: boolean };

export type Contact = {
  id: string;
  chips: Chips;
  match: Match;
  priority: PriorityResult;
  state: ContactState;
  stepsDone: string[];
  /** When the member last pressed "já mandei". Drives the waiting suggestion; never a lock. */
  lastSentAt: string | null;
  catalogueVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type Fact = { id: string; text: string; sourceName: string; sourceUrl: string };
export type Content = { id: string; url: string; type: "video" | "post" | "texto"; summary: string; messenger: string };

export type Step = {
  id: string;
  action: ActionId;
  title: string;
  /** Why this step, in one line. */
  why: string;
  /** Ready to send, in the member's voice (or the template when phrasing is unavailable). */
  message: string | null;
  fact: Fact | null;
  content: Content | null;
  /** True when the message was phrased by AI; false when it's the raw template. */
  phrased: boolean;
  donts: string[];
  /** For the waiting step: how long the persona suggests waiting before a nudge. A suggestion, not a lock. */
  waitHours?: number;
};

/** How to think about this pessoa, from her persona. Shown next to the step. */
export type Guide = {
  personaName: string;
  /** One paragraph: how she got here and what she feels. */
  read: string;
  /** Specific, actionable: timing, channel, wording, what to do with her reply. */
  tactics: { title: string; detail: string }[];
  /** What not to do, each with the reason. */
  avoid: { what: string; why: string }[];
  /** Who she'd believe. */
  wouldBelieve: string[];
  turningPoint: string;
};

export type NextStepResponse = { contact: Contact; step: Step; guide: Guide };
export type ClassifyResponse = { outcome: OutcomeId; saying: SayingId | null };

export type PublicPersona = {
  id: string;
  name: string;
  situations: SituationId[];
  summary: string;
  profile: {
    trust_story: string;
    feelings: string[];
    identity: string;
    media_diet: string[];
    shuts_down: string[];
    opens_up: string[];
    would_believe: string[];
    turning_point: string;
  };
  engage: boolean;
  tactics: { title: string; detail: string }[];
  avoid: { what: string; why: string }[];
};

export type CatalogueResponse = { version: string; personas: PublicPersona[] };

// --- The question flow (one question at a time, branching) ---

export type ChipSets = { sayings?: SayingId[]; worries?: WorryId[]; groups?: GroupId[]; influencers?: InfluencerId[]; trustLoss?: TrustLossId[]; situation?: SituationId; relation?: RelationId; frequency?: FrequencyId };
export type QuestionOption = { id: string; label: string; sets?: ChipSets };
export type Question = {
  id: string;
  text: string;
  hint?: string;
  options: QuestionOption[];
  /** 1 = single choice. Absent = as many as you like. */
  max?: number;
  optional: boolean;
  allowCustom: boolean;
  /**
   * Next question id, or a per-option map ("*" = when nothing matched). null ends the flow.
   * With several answers, every matching branch is visited, in the map's order (see nextTargets).
   */
  next: string | Record<string, string> | null;
};

/**
 * Where to go after a question, given the selected option ids. Deterministic and shared by the
 * web app and the tests. A forced id (from an interpreted answer) wins; a string next is itself;
 * a map yields one target per matching key in the map's order, or "*" when none matched.
 */
export function nextTargets(q: Question, selected: string[], forced?: string | null): string[] {
  if (forced) return [forced];
  if (q.next === null) return [];
  if (typeof q.next === "string") return [q.next];
  const out: string[] = [];
  for (const [key, target] of Object.entries(q.next)) if (key !== "*" && selected.includes(key) && !out.includes(target)) out.push(target);
  if (!out.length && q.next["*"]) out.push(q.next["*"]);
  return out;
}
export type QuestionsResponse = { start: string; questions: Question[] };
/** What the model made of a typed answer. Everything here is validated against the tree and the vocabularies. */
export type Interpretation = {
  /** Closest existing option, when the meaning is the same. */
  optionId: string | null;
  sets: ChipSets;
  tags: string[];
  /** Which existing question to ask next; null = follow the tree's default. */
  nextQuestionId: string | null;
  /** One extra question for this person, when the answer is ambiguous. */
  followup: { text: string; options: QuestionOption[] } | null;
  /** Set when the answer must not be accepted (e.g. a boss/employee relation). */
  blocked: string | null;
  rationale: string;
};

export type ChipStats = { usage: { questionId: string; optionId: string; count: number }[]; proposals: { questionId: string; text: string; count: number; mapped: string | null }[] };
