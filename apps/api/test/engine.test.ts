import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { Chips, SITUATIONS } from "@boranois/shared";
import { loadCatalogue } from "../src/catalogue.js";
import { afterOutcome, afterSent, match, nextStep, priority, renderTemplate } from "../src/engine.js";

const cat = loadCatalogue(new URL("../../../content", import.meta.url).pathname);
const scenarios = JSON.parse(readFileSync(new URL("./scenarios.json", import.meta.url), "utf8")) as {
  name: string;
  chips: unknown;
  expect: { persona: string; priority: string; engage: boolean; becauseIncludes?: string };
}[];

describe("catalogue", () => {
  it("loads, with a default persona for every situation", () => {
    for (const s of SITUATIONS) assert.ok(cat.personas.some((p) => p.default_for.includes(s.id)), s.id);
  });
  it("every persona that engages can start a conversation", () => {
    for (const p of cat.personas.filter((p) => p.engage)) {
      const step = nextStep(cat, { persona: p, chips: Chips.parse({ situation: p.situations[0], relation: "amigo", frequency: "semanal" }), state: "novo", stepsDone: [], today: "2026-10-18" });
      assert.equal(step.action, "abrir_conversa", p.id);
      assert.ok(step.template.includes("{nome}"), `${p.id}: opener should address the pessoa`);
    }
  });
});

describe("match + priority scenarios", () => {
  for (const s of scenarios) {
    it(s.name, () => {
      const chips = Chips.parse(s.chips);
      const m = match(cat, chips);
      assert.equal(m.personaId, s.expect.persona, `because: ${m.because.join("; ")}`);
      if (s.expect.becauseIncludes) assert.ok(m.because.join(" ").includes(s.expect.becauseIncludes), m.because.join("; "));
      const persona = cat.personas.find((p) => p.id === m.personaId)!;
      const pr = priority(cat, persona, chips, []);
      assert.equal(pr.level, s.expect.priority, `reasons: ${pr.reasons.join("; ")}`);
      assert.equal(pr.engage, s.expect.engage);
    });
  }
});

describe("conversation flow", () => {
  const chips = Chips.parse({ situation: "nao_votou", relation: "familia", sayings: ["nao_adianta"], frequency: "semanal", sharedGroup: true });
  const persona = cat.personas.find((p) => p.id === "nao_adianta")!;

  it("walks opener → fact → objection → help, never repeating a step", () => {
    let state = "novo" as const satisfies string;
    const done: string[] = [];
    const s1 = nextStep(cat, { persona, chips, state: "novo", stepsDone: done, today: "2026-10-18" });
    assert.equal(s1.id, "abrir");
    done.push(s1.id);
    const st2 = afterOutcome(afterSent("novo", s1.action), "respondeu_bem");
    assert.equal(st2, "conversando");

    const s2 = nextStep(cat, { persona, chips, state: st2, stepsDone: done, today: "2026-10-18" });
    assert.equal(s2.id, "voto_pesa");
    assert.ok(s2.fact, "a fact step must carry a verified fact");
    done.push(s2.id);

    const st3 = afterOutcome(afterSent(st2, s2.action), "discordou");
    assert.equal(st3, "objecao");
    const s3 = nextStep(cat, { persona, chips, state: st3, stepsDone: done, lastSaying: "nao_adianta", today: "2026-10-18" });
    assert.equal(s3.id, "obj_nao_adianta");
    done.push(s3.id);

    const st4 = afterOutcome(afterSent(st3, s3.action), "fez_pergunta");
    const s4 = nextStep(cat, { persona, chips, state: st4, stepsDone: done, today: "2026-10-18" });
    assert.equal(s4.id, "pode_votar");
    void state;
  });

  it("priority rises when she says she'll vote, falls when she cuts the subject", () => {
    assert.equal(priority(cat, persona, chips, ["vai_votar"]).level, "alta");
    const low = priority(cat, persona, { ...chips, sharedGroup: false, frequency: "raro" }, ["cortou_assunto", "cortou_assunto"]);
    assert.equal(low.level, "baixa");
  });

  it("election-day reminder beats everything", () => {
    const s = nextStep(cat, { persona, chips, state: "aguardando", stepsDone: ["abrir"], today: "2026-10-25" });
    assert.equal(s.id, "followup_2026-10-25");
  });

  it("the stop-sign persona never asks you to send anything", () => {
    const stop = cat.personas.find((p) => p.id === "tem_certeza")!;
    const s = nextStep(cat, { persona: stop, chips: { ...chips, situation: "flavio_convicto" }, state: "novo", stepsDone: [], today: "2026-10-25" });
    assert.equal(s.action, "parar");
    assert.equal(s.template, "");
  });

  it("a step whose fact is unverified is skipped, not sent half-empty", () => {
    const p = cat.personas.find((p) => p.id === "nenhum_dos_dois")!;
    // Simulate the fact bank without the step's only fact (as if it were still unverified).
    const without = { ...cat, facts: cat.facts.filter((f) => f.id !== "branco_nao_conta") };
    const s = nextStep(without, { persona: p, chips: { ...chips, situation: "branco_nulo" }, state: "conversando", stepsDone: ["abrir"], today: "2026-10-18" });
    assert.notEqual(s.id, "branco_nao_conta");
    assert.ok(!s.template.includes("{fato}") || s.fact, "no dangling {fato}");
    // With the fact verified, the step is served and carries it.
    const served = nextStep(cat, { persona: p, chips: { ...chips, situation: "branco_nulo" }, state: "conversando", stepsDone: ["abrir"], today: "2026-10-18" });
    assert.equal(served.id, "branco_nao_conta");
    assert.equal(served.fact?.id, "branco_nao_conta");
  });
});

describe("templates", () => {
  it("renders placeholders and collapses whitespace", () => {
    assert.equal(renderTemplate("Oi {nome}, olha: {fato}  fim", { nome: "tia", fato: "X." }), "Oi tia, olha: X. fim");
  });
});
