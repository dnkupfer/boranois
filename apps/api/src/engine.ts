import {
  GROUPS,
  INFLUENCERS,
  SAYINGS,
  TRUST_LOSS,
  SITUATIONS,
  WORRIES,
  labelOf,
  type ActionId,
  type Chips,
  type ContactState,
  type Guide,
  type Match,
  type OutcomeId,
  type Priority,
  type PriorityResult,
  type SayingId,
} from "@boranois/shared";
import type { Catalogue, ContentDef, FactDef, PersonaDef, StepDef } from "./catalogue.js";

// Everything in this file is deterministic: same catalogue + same inputs = same answer.
// No model is consulted here. That is what makes a recommendation explainable.

// ---------------------------------------------------------------------------
// Match: which persona fits these chips?

export function match(cat: Catalogue, chips: Chips): Match {
  const candidates = cat.personas.filter((p) => p.situations.includes(chips.situation));
  const scored = candidates
    .map((p) => {
      const because: string[] = [];
      let score = 0;
      for (const s of chips.sayings) {
        const w = p.signals.sayings[s];
        if (w) (score += w), because.push(`diz ${labelOf(SAYINGS, s).toLowerCase()}`);
      }
      for (const w of chips.worries) {
        const v = p.signals.worries[w];
        if (v) (score += v), because.push(`se preocupa com ${labelOf(WORRIES, w).toLowerCase()}`);
      }
      for (const g of chips.groups) {
        const v = p.signals.groups[g];
        if (v) (score += v), because.push(`convive em ${labelOf(GROUPS, g).toLowerCase()}`);
      }
      for (const i of chips.influencers) {
        const v = p.signals.influencers[i];
        if (v) (score += v), because.push(`segue ${labelOf(INFLUENCERS, i)}`);
      }
      for (const t of chips.trustLoss) {
        const v = p.signals.trust_loss[t];
        if (v) (score += v), because.push(`parou de acreditar: ${labelOf(TRUST_LOSS, t).toLowerCase()}`);
      }
      return { p, score, because };
    })
    .sort((a, b) => b.score - a.score);

  const { minScore, uncertainMargin } = cat.scoring.match;
  const top = scored[0];

  if (!top || top.score < minScore) {
    const fallback = cat.personas.find((p) => p.default_for.includes(chips.situation))!;
    return {
      personaId: fallback.id,
      personaName: fallback.name,
      because: [`é o perfil mais comum para quem ${labelOf(SITUATIONS, chips.situation).toLowerCase()}`],
      alternative: null,
    };
  }

  const second = scored[1];
  const alternative =
    second && second.score >= minScore && top.score - second.score <= uncertainMargin
      ? { personaId: second.p.id, personaName: second.p.name }
      : null;

  return { personaId: top.p.id, personaName: top.p.name, because: top.because, alternative };
}

// ---------------------------------------------------------------------------
// Priority: where does the member's time help most?

const LEVEL: Record<Priority, number> = { alta: 3, media: 2, baixa: 1 };
const fromScore = (n: number): Priority => (n >= 3 ? "alta" : n >= 2 ? "media" : "baixa");

export function priority(cat: Catalogue, persona: PersonaDef, chips: Chips, outcomes: OutcomeId[]): PriorityResult {
  if (!persona.engage) {
    return { level: "baixa", reasons: [persona.profile.turning_point], engage: false };
  }
  const cfg = cat.scoring.priority;
  const reasons: string[] = [];
  let score = LEVEL[persona.priority_base];
  reasons.push(persona.priority_base === "alta" ? "levar alguém à urna é mais fácil do que mudar uma opinião" : "mudar uma opinião leva tempo");

  if (chips.sharedGroup) (score += cfg.sharedGroup), reasons.push("vocês são do mesmo grupo: ela ouve você");
  const f = cfg.frequency[chips.frequency] ?? 0;
  if (f > 0) reasons.push("vocês se falam quase todo dia");
  if (f < 0) reasons.push("vocês se falam pouco");
  score += f;
  for (const s of chips.sayings) {
    const v = cfg.sayings[s];
    if (v) (score += v), reasons.push(`diz ${labelOf(SAYINGS, s).toLowerCase()}`);
  }

  for (const o of outcomes) {
    if (o === "vai_votar" || o === "votou") return { level: "alta", reasons: ["ela disse que vai votar: só falta combinar"], engage: true };
    const v = cfg.outcomes[o] ?? 0;
    score += v;
    if (v > 0) reasons.push("a conversa está indo bem");
    if (v < 0) reasons.push("ela cortou o assunto ou disse que não vai");
  }

  return { level: fromScore(Math.max(1, Math.min(3, score))), reasons: [...new Set(reasons)], engage: true };
}

// ---------------------------------------------------------------------------
// State machine

export function afterOutcome(state: ContactState, outcome: OutcomeId): ContactState {
  switch (outcome) {
    case "respondeu_bem":
    case "fez_pergunta":
      return "conversando";
    case "discordou":
      return "objecao";
    case "cortou_assunto":
      return "cortou";
    case "sem_resposta":
      return state === "novo" ? "novo" : "aguardando";
    case "vai_votar":
      return "vai_votar";
    case "votou":
      return "votou";
    case "nao_vai_votar":
      return "perdido";
  }
}

const SENDING: ActionId[] = ["abrir_conversa", "enviar_fato", "enviar_conteudo", "oferecer_ajuda"];

/** State after the member says "já mandei" for a step. */
export function afterSent(state: ContactState, action: ActionId): ContactState {
  if (SENDING.includes(action)) return "aguardando";
  if (action === "pausar") return "pausado";
  return state;
}

// ---------------------------------------------------------------------------
// Next step

export type PlannedStep = {
  id: string;
  action: ActionId;
  title: string;
  why: string;
  template: string;
  fact: FactDef | null;
  content: ContentDef | null;
  /** True when the step comes from the persona (vs. defaults/objections/followups). */
  fromPersona: boolean;
};

export type PlanInput = {
  persona: PersonaDef;
  chips: Chips;
  state: ContactState;
  stepsDone: string[];
  /** When state is "objecao": what she said. */
  lastSaying?: SayingId | null;
  today: string; // YYYY-MM-DD
};

export function nextStep(cat: Catalogue, input: PlanInput): PlannedStep {
  const { persona, chips, state, stepsDone, lastSaying, today } = input;

  if (!persona.engage) {
    const s = persona.steps[0];
    return { id: s.id, action: s.action, title: s.title, why: s.why, template: "", fact: null, content: null, fromPersona: true };
  }

  // Election-eve and election-day reminders beat everything for anyone still in play.
  const followup = cat.defaults.followups.find((f) => f.date === today);
  const inPlay: ContactState[] = ["aguardando", "conversando", "vai_votar", "cortou", "objecao"];
  if (followup && inPlay.includes(state) && !stepsDone.includes(`followup_${followup.date}`)) {
    return {
      id: `followup_${followup.date}`,
      action: "lembrar",
      title: followup.title,
      why: "Um lembrete curto, de gente próxima, é o que mais leva alguém à urna no dia.",
      template: followup.template,
      fact: pickFact(cat, ["onde_votar", "horario_votacao"], chips),
      content: null,
      fromPersona: false,
    };
  }

  if (state === "objecao") {
    const obj = lastSaying ? persona.objections[lastSaying] : undefined;
    if (obj) {
      return {
        id: `obj_${lastSaying}`,
        action: "enviar_fato",
        title: obj.title,
        why: "Responda ao que ela disse, não ao que você queria dizer.",
        template: obj.template,
        fact: pickFact(cat, obj.facts, chips),
        content: null,
        fromPersona: true,
      };
    }
    return {
      id: "obj_generica",
      action: "abrir_conversa",
      title: "Pergunte mais antes de responder",
      why: "Você ainda não sabe exatamente do que ela discorda. Perguntar custa pouco e evita briga.",
      template: "Entendi, {nome}. Me explica melhor o que te incomoda nisso? Quero entender antes de falar qualquer coisa.",
      fact: null,
      content: null,
      fromPersona: false,
    };
  }

  for (const s of persona.steps) {
    if (!s.when.includes(state) || stepsDone.includes(s.id)) continue;
    const planned = materialise(cat, s, chips, true);
    if (planned) return planned;
    // A step whose material doesn't exist yet (no verified fact, no approved content) is skipped.
  }

  const d = cat.defaults.steps.find((s) => s.when.includes(state));
  if (d) return materialise(cat, d, chips, false) ?? plain(d, false);

  return {
    id: "generico",
    action: "abrir_conversa",
    title: "Continue a conversa",
    why: "Não há um próximo passo escrito para este momento. Pergunte como ela está.",
    template: "Oi, {nome}! Como você tá? Pensou mais naquilo que a gente conversou?",
    fact: null,
    content: null,
    fromPersona: false,
  };
}

function plain(s: StepDef, fromPersona: boolean): PlannedStep {
  return { id: s.id, action: s.action, title: s.title, why: s.why, template: s.template, fact: null, content: null, fromPersona };
}

function materialise(cat: Catalogue, s: StepDef, chips: Chips, fromPersona: boolean): PlannedStep | null {
  const needsFact = s.template.includes("{fato}");
  const needsContent = s.template.includes("{conteudo}");
  const fact = needsFact || s.facts.length ? pickFact(cat, s.facts, chips) : null;
  const content = needsContent ? pickContent(cat, chips) : null;
  if (needsFact && !fact) return null;
  if (needsContent && !content) return null;
  return { ...plain(s, fromPersona), fact, content };
}

/** First verified fact from the list, preferring one that matches a worry she has. */
export function pickFact(cat: Catalogue, ids: string[], chips: Chips): FactDef | null {
  const available = ids.map((id) => cat.facts.find((f) => f.id === id)).filter((f): f is FactDef => !!f);
  return available.find((f) => f.worries.some((w) => chips.worries.includes(w))) ?? available[0] ?? null;
}

/** Approved content matching her worries, preferring a messenger from her own group. */
export function pickContent(cat: Catalogue, chips: Chips, personaId?: string): ContentDef | null {
  const relevant = cat.contents.filter(
    (c) => c.worries.some((w) => chips.worries.includes(w)) || (personaId ? c.personas.includes(personaId) : false),
  );
  const pool = relevant.length ? relevant : cat.contents;
  return pool.find((c) => c.messengerGroups.some((g) => chips.groups.includes(g))) ?? pool[0] ?? null;
}

export function renderTemplate(template: string, vars: { nome: string; fato?: string; conteudo?: string; preocupacao?: string }) {
  return template
    .replaceAll("{nome}", vars.nome)
    .replaceAll("{fato}", vars.fato ?? "")
    .replaceAll("{conteudo}", vars.conteudo ?? "")
    .replaceAll("{preocupacao}", vars.preocupacao ?? "isso")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Guide: how to think about her. Straight from the persona; no model involved.

export function buildGuide(persona: PersonaDef): Guide {
  const pr = persona.profile;
  return {
    personaName: persona.name,
    read: `${pr.trust_story} Sente: ${pr.feelings.join(", ")}. Como ela se vê: ${pr.identity}`,
    tactics: persona.tactics,
    avoid: persona.avoid,
    wouldBelieve: pr.would_believe,
    turningPoint: pr.turning_point,
  };
}
