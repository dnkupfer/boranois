// Offline analysis of how the question tree is used. Writes a report a person can act on.
// "AI proposes, humans apply": nothing here changes content/questions.json.
//
//   npm run analyse -w @boranois/api        → content/proposals/<date>.md

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { loadCatalogue } from "./catalogue.js";
import { createStore } from "./store/index.js";

const { store } = createStore();
const catalogue = loadCatalogue();
const stats = await store.chipStats();
const today = new Date().toISOString().slice(0, 10);

const lines: string[] = [`# Uso do fluxo de perguntas — ${today}`, "", `Catálogo ${catalogue.version}.`, ""];

// 1. Options nobody picks, per question.
lines.push("## Opções nunca escolhidas", "");
for (const q of catalogue.questions.questions) {
  const used = new Set(stats.usage.filter((u) => u.questionId === q.id).map((u) => u.optionId));
  const unused = q.options.filter((o) => !used.has(o.id)).map((o) => `\`${o.id}\``);
  const total = stats.usage.filter((u) => u.questionId === q.id).reduce((n, u) => n + u.count, 0);
  if (total > 0 && unused.length) lines.push(`- **${q.id}** (${total} respostas): ${unused.join(", ")}`);
}
lines.push("");

// 2. Typed answers, most common first, with how the model mapped them.
lines.push("## Respostas digitadas", "");
for (const q of catalogue.questions.questions) {
  const mine = stats.proposals.filter((p) => p.questionId === q.id);
  if (!mine.length) continue;
  lines.push(`### ${q.id} — ${q.text}`, "");
  for (const p of mine) lines.push(`- ${p.count}× “${p.text}” → ${p.mapped ?? "?"}`);
  lines.push("");
}

// 3. With Gemini: proposed edits to the tree, as a checklist for a person.
if (process.env.GEMINI_API_KEY && stats.proposals.length) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
    contents: `Abaixo, o fluxo de perguntas de um app (JSON) e as respostas que usuários digitaram quando nenhuma opção servia, com contagens. Proponha, em português, uma lista curta de mudanças concretas no fluxo: novas opções (com id, label e os chips que implicam), opções a renomear, perguntas a dividir ou a criar. Só proponha o que as contagens justificam. Formato: lista Markdown, uma mudança por item, com a justificativa em uma frase.

FLUXO:
${JSON.stringify(catalogue.questions, null, 1)}

RESPOSTAS DIGITADAS:
${stats.proposals.map((p) => `${p.questionId}: ${p.count}× "${p.text}" (mapeado: ${p.mapped ?? "?"})`).join("\n")}`,
  });
  lines.push("## Mudanças propostas (revisar antes de aplicar)", "", res.text ?? "(sem resposta)", "");
} else {
  lines.push("## Mudanças propostas", "", stats.proposals.length ? "Defina GEMINI_API_KEY para gerar propostas." : "Ainda não há respostas digitadas.", "");
}

const dir = resolve(process.env.CONTENT_DIR ?? resolve(process.cwd(), "../../content"), "proposals");
mkdirSync(dir, { recursive: true });
const out = resolve(dir, `${today}.md`);
writeFileSync(out, lines.join("\n"));
console.log(`Report written to ${out}`);
process.exit(0);
