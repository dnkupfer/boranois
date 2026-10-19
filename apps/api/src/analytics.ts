import type { AnalyticsEvent } from "@boranois/shared";
import type { AdminRows } from "./store/types.js";

// Turns raw events into the questions we actually ask: how many people start, where they stop,
// how many send a first message, what comes back, whether the coach helps.

export type Summary = {
  sinceDays: number;
  devices: number;
  pageViews: Record<string, number>;
  nova: {
    started: number;
    done: number;
    /** Last question seen by people who left without finishing, by question id. */
    leftAt: Record<string, number>;
    /** How many times each question was answered with "+ outra". */
    customByQuestion: Record<string, number>;
  };
  steps: { shown: number; sent: number; skipped: number; nudges: number; byStep: Record<string, { shown: number; sent: number; skipped: number }> };
  outcomes: Record<string, number>;
  coach: { asks: number; replies: number; suggestionsUsed: number };
  signin: { links: number; done: number };
};

const count = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);

export function summarize(events: AnalyticsEvent[], sinceDays: number): Summary {
  const s: Summary = {
    sinceDays,
    devices: new Set(events.map((e) => e.aid)).size,
    pageViews: {},
    nova: { started: 0, done: 0, leftAt: {}, customByQuestion: {} },
    steps: { shown: 0, sent: 0, skipped: 0, nudges: 0, byStep: {} },
    outcomes: {},
    coach: { asks: 0, replies: 0, suggestionsUsed: 0 },
    signin: { links: 0, done: 0 },
  };
  const step = (id: string) => (s.steps.byStep[id] ??= { shown: 0, sent: 0, skipped: 0 });
  for (const e of events) {
    const str = (k: string) => String(e.props[k] ?? "");
    switch (e.name) {
      case "page_view": count(s.pageViews, e.path.replace(/\/pessoa\/[^/]+/, "/pessoa/:id")); break;
      case "nova_start": s.nova.started++; break;
      case "nova_done": s.nova.done++; break;
      case "nova_leave": count(s.nova.leftAt, str("lastQuestion") || "(quem é)"); break;
      case "nova_custom": count(s.nova.customByQuestion, str("questionId")); break;
      case "step_shown": s.steps.shown++; step(str("stepId")).shown++; break;
      case "step_sent": s.steps.sent++; step(str("stepId")).sent++; break;
      case "step_skipped": s.steps.skipped++; step(str("stepId")).skipped++; break;
      case "nudge_sent": s.steps.nudges++; break;
      case "outcome": count(s.outcomes, str("outcome")); break;
      case "coach_ask": s.coach.asks++; break;
      case "coach_reply": s.coach.replies++; break;
      case "suggestion_used": s.coach.suggestionsUsed++; break;
      case "signin_link": s.signin.links++; break;
      case "signin_done": s.signin.done++; break;
      default: break;
    }
  }
  return s;
}

export function renderSummary(s: Summary): string {
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
  const top = (m: Record<string, number>, n = 12) =>
    Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "- (nada)";
  return [
    `# Uso — últimos ${s.sinceDays} dias`,
    "",
    `Aparelhos: ${s.devices}`,
    "",
    "## Páginas", top(s.pageViews),
    "",
    "## Adicionar pessoa",
    `- começaram: ${s.nova.started}`,
    `- terminaram: ${s.nova.done} (${pct(s.nova.done, s.nova.started)})`,
    "- pararam em:", top(s.nova.leftAt),
    "- “+ outra” por pergunta:", top(s.nova.customByQuestion),
    "",
    "## Passos",
    `- mostrados: ${s.steps.shown}, enviados: ${s.steps.sent} (${pct(s.steps.sent, s.steps.shown)}), pulados: ${s.steps.skipped}, lembretes: ${s.steps.nudges}`,
    ...Object.entries(s.steps.byStep).sort((a, b) => b[1].shown - a[1].shown).slice(0, 15).map(([k, v]) => `- ${k}: ${v.shown} mostrados, ${v.sent} enviados, ${v.skipped} pulados`),
    "",
    "## Respostas", top(s.outcomes),
    "",
    "## Coach",
    `- perguntas: ${s.coach.asks}, respostas coladas: ${s.coach.replies}, sugestões usadas: ${s.coach.suggestionsUsed}`,
    "",
    "## Entrar com e-mail",
    `- links pedidos: ${s.signin.links}, entradas: ${s.signin.done}`,
    "",
  ].join("\n");
}

// --- The admin page: one payload, already in the shape the page draws ---------------------------

export type Row = { key: string; label: string; count: number };
export type Overview = {
  sinceDays: number;
  /** From the app's own tables: everyone, with or without analytics consent. All time. */
  totals: {
    visitors: number;
    members: number;
    pessoas: number;
    willVote: number;
    voted: number;
    byPersona: Row[];
    byChance: Row[];
    byState: Row[];
    outcomes: Row[];
  };
  /** From analytics events: only devices that accepted measurement. This period. */
  consented: number;
  funnel: Row[];
  daily: { day: string; devices: number; added: number; replies: number }[];
  leftAt: Row[];
  typedIn: Row[];
  steps: { key: string; shown: number; sent: number; skipped: number }[];
  coach: { asks: number; replies: number; suggestionsUsed: number };
  signin: { links: number; done: number };
  aiRemainingToday: number;
};

const CHANCE: Record<string, string> = { alta: "Boa chance", media: "Vale tentar", baixa: "Difícil", nao: "Melhor não" };
const STATE: Record<string, string> = {
  novo: "ainda não conversaram", aguardando: "esperando resposta", conversando: "respondeu, vez de quem usa", objecao: "discordou, vez de quem usa",
  cortou: "cortou o assunto", vai_votar: "vai votar", votou: "votou", perdido: "não vai votar", pausado: "em pausa",
};
const OUTCOME: Record<string, string> = {
  respondeu_bem: "Respondeu bem", fez_pergunta: "Fez uma pergunta", discordou: "Discordou", cortou_assunto: "Cortou o assunto",
  sem_resposta: "Não respondeu", vai_votar: "Disse que vai votar", votou: "Já votou", nao_vai_votar: "Disse que não vai",
};

/** Calendar day in Brazil, where the users are. */
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const rows = (m: Record<string, number>, label: (k: string) => string = (k) => k): Row[] =>
  Object.entries(m).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, label: label(key), count }));

export function buildOverview(
  events: AnalyticsEvent[],
  admin: AdminRows,
  sinceDays: number,
  names: { personas: Record<string, string>; questions: Record<string, string> },
  aiRemainingToday: number,
): Overview {
  const s = summarize(events, sinceDays);
  const since = Date.now() - sinceDays * 86400000;

  const byPersona: Record<string, number> = {};
  const byChance: Record<string, number> = {};
  const byState: Record<string, number> = {};
  for (const c of admin.contacts) {
    count(byPersona, c.personaId);
    count(byChance, c.engage ? c.level : "nao");
    count(byState, c.state);
  }
  const outcomes: Record<string, number> = {};
  for (const o of admin.outcomes) count(outcomes, o.outcome);

  // Funnel: distinct devices that reached each point, in order.
  const reached = (names: string[]) => new Set(events.filter((e) => names.includes(e.name)).map((e) => e.aid)).size;
  const funnel: Row[] = [
    { key: "open", label: "Abriram o app", count: s.devices },
    { key: "nova_start", label: "Começaram a adicionar alguém", count: reached(["nova_start"]) },
    { key: "nova_done", label: "Terminaram de adicionar", count: reached(["nova_done"]) },
    { key: "step_shown", label: "Viram o primeiro passo", count: reached(["step_shown"]) },
    { key: "step_sent", label: "Mandaram uma mensagem", count: reached(["step_sent", "nudge_sent"]) },
    { key: "outcome", label: "Registraram uma resposta", count: reached(["outcome"]) },
  ];

  // Daily: devices from events (consented), pessoas and replies from the tables (everyone).
  const days: string[] = [];
  for (let d = sinceDays - 1; d >= 0; d--) days.push(dayOf(new Date(Date.now() - d * 86400000).toISOString()));
  const devicesByDay: Record<string, Set<string>> = {};
  for (const e of events) (devicesByDay[dayOf(e.ts)] ??= new Set()).add(e.aid);
  const addedByDay: Record<string, number> = {};
  for (const c of admin.contacts) if (new Date(c.createdAt).getTime() >= since) count(addedByDay, dayOf(c.createdAt));
  const repliesByDay: Record<string, number> = {};
  for (const o of admin.outcomes) if (new Date(o.createdAt).getTime() >= since) count(repliesByDay, dayOf(o.createdAt));

  const question = (id: string) => {
    if (id === "(quem é)") return "Quem é? (nome e pronome)";
    if (id === "(nota)") return "Mais alguma coisa? (última tela)";
    if (id.startsWith("ai_")) return "Pergunta extra criada pela IA";
    return (names.questions[id] ?? id).replaceAll("{nome}", "a pessoa");
  };

  return {
    sinceDays,
    totals: {
      visitors: admin.members,
      members: new Set(admin.contacts.map((c) => c.memberId)).size,
      pessoas: admin.contacts.length,
      willVote: byState.vai_votar ?? 0,
      voted: byState.votou ?? 0,
      byPersona: rows(byPersona, (k) => names.personas[k] ?? k),
      byChance: ["alta", "media", "baixa", "nao"].map((k) => ({ key: k, label: CHANCE[k], count: byChance[k] ?? 0 })),
      byState: rows(byState, (k) => STATE[k] ?? k),
      outcomes: rows(outcomes, (k) => OUTCOME[k] ?? k),
    },
    consented: s.devices,
    funnel,
    daily: days.map((day) => ({ day, devices: devicesByDay[day]?.size ?? 0, added: addedByDay[day] ?? 0, replies: repliesByDay[day] ?? 0 })),
    leftAt: rows(s.nova.leftAt, question),
    typedIn: rows(s.nova.customByQuestion, question),
    steps: Object.entries(s.steps.byStep).sort((a, b) => b[1].shown - a[1].shown).slice(0, 12).map(([key, v]) => ({ key, ...v })),
    coach: s.coach,
    signin: s.signin,
    aiRemainingToday,
  };
}
