import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { OutcomeId, RELATIONS, SayingId, SAYINGS, OUTCOMES, labelOf, type ClassifyResponse, type RelationId } from "@boranois/shared";

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
  available: boolean;
  phrase(input: PhraseInput): Promise<string | null>;
  classify(text: string): Promise<ClassifyResponse>;
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
const ClassifyOutput = z.object({ outcome: OutcomeId, saying: SayingId.nullable() });
const strip = (schema: z.ZodType) => {
  const { $schema: _, ...rest } = z.toJSONSchema(schema);
  return rest;
};

export class GeminiPhraser implements Phraser {
  available = true;
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  private model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

  async phrase(input: PhraseInput): Promise<string | null> {
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

  async classify(text: string): Promise<ClassifyResponse> {
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
