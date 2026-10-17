import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadCatalogue } from "../src/catalogue.js";
import { validateInterpretation } from "../src/gemini.js";

const cat = loadCatalogue(new URL("../../../content", import.meta.url).pathname);
const qs = cat.questions.questions;
const q = qs.find((q) => q.id === "nao_votou_porque")!;

describe("interpretation validator", () => {
  it("keeps a known option and takes its chips, ignoring whatever else the model said", () => {
    const out = validateInterpretation(
      { option_id: "desanimou", sets: { sayings: ["lula_ladrao"], worries: [], groups: [], influencers: [], trustLoss: null, situation: null, relation: null, frequency: null }, tags: [], next_question_id: "confianca", followup: null, blocked: null, rationale: "x" },
      q, qs,
    );
    assert.equal(out.optionId, "desanimou");
    assert.deepEqual(out.sets, { sayings: ["nao_adianta"] });
    assert.equal(out.nextQuestionId, "confianca");
  });
  it("drops unknown option and question ids instead of trusting them", () => {
    const out = validateInterpretation(
      { option_id: "inventada", sets: { sayings: ["raiva"], worries: [], groups: [], influencers: [], trustLoss: null, situation: null, relation: null, frequency: null }, tags: ["Filho Preso!"], next_question_id: "pergunta_que_nao_existe", followup: null, blocked: null, rationale: "x" },
      q, qs,
    );
    assert.equal(out.optionId, null);
    assert.equal(out.nextQuestionId, null);
    assert.deepEqual(out.sets, { sayings: ["raiva"] });
    assert.deepEqual(out.tags, ["filho preso"]);
  });
  it("passes a block through", () => {
    const out = validateInterpretation(
      { option_id: null, sets: { sayings: [], worries: [], groups: [], influencers: [], trustLoss: null, situation: null, relation: null, frequency: null }, tags: [], next_question_id: null, followup: null, blocked: "É sua chefe: pode ser assédio eleitoral.", rationale: "x" },
      qs.find((q) => q.id === "relacao")!, qs,
    );
    assert.ok(out.blocked);
  });
});
