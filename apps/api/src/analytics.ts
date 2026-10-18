import type { AnalyticsEvent } from "@boranois/shared";

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
