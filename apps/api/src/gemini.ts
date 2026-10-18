import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  FREQUENCIES,
  GROUPS,
  INFLUENCERS,
  OUTCOMES,
  RELATIONS,
  SAYINGS,
  SITUATIONS,
  TRUST_LOSS,
  WORRIES,
  FrequencyId,
  GroupId,
  InfluencerId,
  OutcomeId,
  RelationId,
  SayingId,
  SituationId,
  TrustLossId,
  WorryId,
  labelOf,
  type ClassifyResponse,
  type Interpretation,
  type Question,
} from "@boranois/shared";

// The model has exactly two jobs here: put a step into the member's own words,
// and label what a pessoa replied. It never decides what is true or what to do next.

export type PhraseInput = {
  template: string; // already rendered: no placeholders left
  factText: string | null;
  contentSummary: string | null;
  nickname: string;
  relation: RelationId;
  note?: string;
  voiceSample?: string;
  donts: string[];
  maxChars: number;
};

export interface Phraser {
  /** False when there's no key, or while the provider is refusing us (quota). */
  readonly available: boolean;
  phrase(input: PhraseInput): Promise<string | null>;
  classify(text: string): Promise<ClassifyResponse>;
  /** Maps a typed answer onto the question tree. Output is validated against the tree before use. */
  interpret(question: Question, allQuestions: Question[], text: string): Promise<Interpretation>;
}

const PHRASE_SYSTEM = `Você reescreve uma mensagem de WhatsApp para que ela soe como a pessoa que vai enviá-la (o "remetente"), mantendo exatamente o mesmo sentido.

Regras, sem exceção:
- Não acrescente nenhum fato, número, nome, data, link ou afirmação que não esteja no texto original ou no fato fornecido. Se o original tem um fato, mantenha-o fiel (pode encurtar, não pode alterar).
- No máximo uma pergunta.
- Tom de conversa entre pessoas próximas. Sem slogans, sem hashtags, sem tom de campanha, sem emoji em excesso (no máximo um).
- Nunca pressione, nunca culpe, nunca ameace. Se o original pede opinião, continue pedindo opinião.
- Se houver uma amostra de como o remetente escreve, imite o jeito dele (gírias, pontuação, tamanho das frases). Se não houver, escreva simples e curto.
- Respeite o limite de caracteres.
- Responda apenas com a mensagem reescrita.`;

const PhraseOutput = z.object({ message: z.string() });

const SetsOutput = z.object({
  sayings: z.array(SayingId).default([]),
  worries: z.array(WorryId).default([]),
  groups: z.array(GroupId).default([]),
  influencers: z.array(InfluencerId).default([]),
  trustLoss: z.array(TrustLossId).default([]),
  situation: SituationId.nullable().default(null),
  relation: RelationId.nullable().default(null),
  frequency: FrequencyId.nullable().default(null),
});
const InterpretOutput = z.object({
  option_id: z.string().nullable(),
  sets: SetsOutput,
  tags: z.array(z.string().max(40)).max(4).default([]),
  next_question_id: z.string().nullable(),
  followup: z
    .object({
      text: z.string().min(1).max(120),
      options: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]+$/).max(30), label: z.string().min(1).max(60), sets: SetsOutput })).min(2).max(5),
    })
    .nullable(),
  blocked: z.string().nullable(),
  rationale: z.string().max(200),
});

const INTERPRET_SYSTEM = `Você ajuda um app que orienta conversas entre amigos antes do 2º turno de 2026 no Brasil. Um usuário descreve uma pessoa que conhece respondendo perguntas com opções. Ele digitou uma resposta própria em vez de escolher uma opção. Sua tarefa é encaixar essa resposta no sistema.

Regras:
- Se a resposta tem o mesmo sentido de uma opção existente, devolva option_id com o id dela e os mesmos chips.
- Senão, devolva em sets só os chips (dos vocabulários fornecidos) que a resposta realmente implica. Não invente; na dúvida, deixe vazio e use tags (palavras curtas em minúsculas, sem acento).
- next_question_id: só se uma pergunta existente for claramente a melhor seguinte; senão null.
- followup: só se a resposta for ambígua e UMA pergunta curta, com 2 a 5 opções, ajudaria a entender melhor a pessoa. Cada opção precisa de sets. Senão null.
- blocked: se a relação implica poder sobre a pessoa (chefe, patrão, funcionário, empregada, aluno), devolva o motivo em uma frase: conversar sobre voto nessa relação pode ser assédio eleitoral. Senão null.
- rationale: uma frase.
Responda só o JSON.`;
const ClassifyOutput = z.object({ outcome: OutcomeId, saying: SayingId.nullable() });
const strip = (schema: z.ZodType) => {
  const { $schema: _, ...rest } = z.toJSONSchema(schema);
  return rest;
};

export class AiUnavailable extends Error {
  constructor(public reason: "quota" | "error") {
    super(`ai unavailable: ${reason}`);
  }
}

const QUOTA_BACKOFF_MS = 60 * 60 * 1000;

export class GeminiPhraser implements Phraser {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  private model = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
  /** After a 429 we stop calling for a while instead of burning the remaining quota on failures. */
  private quotaUntil = 0;
  /** Same step, same inputs → same message. Reloading a page must not cost a request. */
  private cache = new Map<string, string>();

  get available() {
    return Date.now() >= this.quotaUntil;
  }

  /** Runs a call, turning provider errors into AiUnavailable and noting quota exhaustion. */
  private async guarded<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.available) throw new AiUnavailable("quota");
    try {
      return await fn();
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        this.quotaUntil = Date.now() + QUOTA_BACKOFF_MS;
        console.warn(`Gemini quota exhausted; AI off for ${QUOTA_BACKOFF_MS / 60000} min. Enable billing on the key or wait for the daily reset.`);
        throw new AiUnavailable("quota");
      }
      console.error("Gemini error:", msg.slice(0, 300));
      throw new AiUnavailable("error");
    }
  }

  async phrase(input: PhraseInput): Promise<string | null> {
    // Nothing to phrase "in their voice" without a voice sample or a note: the template is already the message.
    if (!input.voiceSample && !input.note) return null;
    const key = JSON.stringify([input.template, input.factText, input.voiceSample, input.note, input.nickname]);
    const cached = this.cache.get(key);
    if (cached) return cached;
    const out = await this.guarded(() => this.phraseUncached(input));
    if (out) {
      if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, out);
    }
    return out;
  }

  private async phraseUncached(input: PhraseInput): Promise<string | null> {
    const prompt = [
      `Limite: ${input.maxChars} caracteres.`,
      `Destinatária: "${input.nickname}" (${labelOf(RELATIONS, input.relation).toLowerCase()} do remetente).`,
      input.note ? `O que o remetente sabe sobre ela (só contexto, não cite isso na mensagem): ${input.note}` : "",
      input.voiceSample ? `Amostra de como o remetente escreve:\n"""${input.voiceSample}"""` : "",
      input.factText ? `Fato que deve continuar na mensagem, fiel: """${input.factText}"""` : "",
      input.donts.length ? `O que não fazer com esta pessoa:\n- ${input.donts.join("\n- ")}` : "",
      `Mensagem original:\n"""${input.template}"""`,
    ]
      .filter(Boolean)
      .join("\n\n");

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt + (attempt ? "\n\nA tentativa anterior acrescentou informação que não estava no original. Reescreva sem acrescentar nada." : ""),
        config: { systemInstruction: PHRASE_SYSTEM, responseMimeType: "application/json", responseJsonSchema: strip(PhraseOutput) },
      });
      const parsed = res.text ? PhraseOutput.safeParse(JSON.parse(res.text)) : null;
      if (!parsed?.success) continue;
      const message = parsed.data.message.trim();
      const problems = validatePhrasing(message, input);
      if (!problems.length) return message;
      console.warn("phrasing rejected:", problems);
    }
    return null;
  }

  async interpret(question: Question, allQuestions: Question[], text: string): Promise<Interpretation> {
    return this.guarded(() => this.interpretUncached(question, allQuestions, text));
  }

  private async interpretUncached(question: Question, allQuestions: Question[], text: string): Promise<Interpretation> {
    const vocab = (name: string, list: readonly { id: string; label: string }[]) => `${name}: ${list.map((x) => `${x.id} (${x.label})`).join(", ")}`;
    const prompt = [
      `Pergunta (${question.id}): ${question.text}`,
      `Opções: ${question.options.map((o) => `${o.id} = ${o.label}${o.sets ? " → " + JSON.stringify(o.sets) : ""}`).join("; ")}`,
      `Outras perguntas existentes (para next_question_id): ${allQuestions.map((q) => `${q.id} = ${q.text}`).join("; ")}`,
      "Vocabulários:",
      vocab("sayings", SAYINGS), vocab("worries", WORRIES), vocab("groups", GROUPS), vocab("influencers", INFLUENCERS),
      vocab("trustLoss", TRUST_LOSS), vocab("situation", SITUATIONS), vocab("relation", RELATIONS), vocab("frequency", FREQUENCIES),
      `Resposta digitada: """${text}"""`,
    ].join("\n\n");
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { systemInstruction: INTERPRET_SYSTEM, responseMimeType: "application/json", responseJsonSchema: strip(InterpretOutput) },
    });
    const parsed = res.text ? InterpretOutput.safeParse(JSON.parse(res.text)) : null;
    if (!parsed?.success) throw new Error("interpret: no usable output");
    return validateInterpretation(parsed.data, question, allQuestions);
  }

  async classify(text: string): Promise<ClassifyResponse> {
    return this.guarded(() => this.classifyUncached(text));
  }

  private async classifyUncached(text: string): Promise<ClassifyResponse> {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: `Classifique a resposta abaixo, enviada por WhatsApp por alguém a quem um amigo falou sobre votar no 2º turno.

outcome (escolha um): ${OUTCOMES.map((o) => `${o.id} = ${o.label}`).join("; ")}.
saying: se ela discordou ou deu um motivo, qual destes está mais próximo (ou null): ${SAYINGS.map((s) => `${s.id} = ${s.label}`).join("; ")}.

Resposta dela:
"""${text}"""`,
      config: { responseMimeType: "application/json", responseJsonSchema: strip(ClassifyOutput) },
    });
    const parsed = res.text ? ClassifyOutput.safeParse(JSON.parse(res.text)) : null;
    if (!parsed?.success) throw new Error("classify: no usable output");
    return parsed.data;
  }
}

/** Used when there's no API key: templates go out as written. */
export class NoPhraser implements Phraser {
  available = false;
  async phrase() {
    return null;
  }
  async classify(): Promise<ClassifyResponse> {
    throw new Error("classification unavailable");
  }
  async interpret(): Promise<Interpretation> {
    throw new Error("interpretation unavailable");
  }
}

/** Keeps the model inside the tree: unknown option or question ids are dropped, not trusted. */
export function validateInterpretation(out: z.infer<typeof InterpretOutput>, question: Question, allQuestions: Question[]): Interpretation {
  const optionId = out.option_id && question.options.some((o) => o.id === out.option_id) ? out.option_id : null;
  const nextQuestionId = out.next_question_id && allQuestions.some((q) => q.id === out.next_question_id) ? out.next_question_id : null;
  const clean = (s: z.infer<typeof SetsOutput>) =>
    Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0))) as Interpretation["sets"];
  const followup = out.followup
    ? { text: out.followup.text, options: out.followup.options.map((o) => ({ id: o.id, label: o.label, sets: clean(o.sets) })) }
    : null;
  return {
    optionId,
    sets: optionId ? (question.options.find((o) => o.id === optionId)?.sets ?? {}) : clean(out.sets),
    tags: out.tags.map((t) => t.toLowerCase().replace(/[^a-z0-9_ ]/g, "").trim()).filter(Boolean),
    nextQuestionId,
    followup,
    blocked: out.blocked,
    rationale: out.rationale,
  };
}

export const createPhraser = (): Phraser => (process.env.GEMINI_API_KEY ? new GeminiPhraser() : new NoPhraser());

// ---------------------------------------------------------------------------
// Validator: the model may rephrase, never add. Every number and link in the
// output must already exist in the inputs.

export function validatePhrasing(message: string, input: Pick<PhraseInput, "template" | "factText" | "contentSummary" | "note" | "maxChars">): string[] {
  const problems: string[] = [];
  const allowed = [input.template, input.factText ?? "", input.contentSummary ?? "", input.note ?? ""].join("\n");

  if (message.length > input.maxChars) problems.push(`too long: ${message.length} > ${input.maxChars}`);
  if ((message.match(/\?/g) ?? []).length > 1) problems.push("more than one question");

  const numbers = (s: string) => new Set((s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", ".")));
  const allowedNumbers = numbers(allowed);
  for (const n of numbers(message)) if (!allowedNumbers.has(n)) problems.push(`new number: ${n}`);

  const urls = (s: string) => new Set(s.match(/https?:\/\/\S+/g) ?? []);
  const allowedUrls = urls(allowed);
  for (const u of urls(message)) if (!allowedUrls.has(u)) problems.push(`new link: ${u}`);

  if (/#\w+/.test(message)) problems.push("hashtag");
  return problems;
}
