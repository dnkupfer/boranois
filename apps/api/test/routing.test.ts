import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextTargets } from "@boranois/shared";
import { loadCatalogue } from "../src/catalogue.js";

const cat = loadCatalogue(new URL("../../../content", import.meta.url).pathname);
const q = (id: string) => cat.questions.questions.find((q) => q.id === id)!;

describe("routing with several answers", () => {
  it("visits every matching branch, in the tree's order", () => {
    // não conseguiu (logistics, most actionable) + desanimou (trust) → obstáculo first, then confiança
    assert.deepEqual(nextTargets(q("nao_votou_porque"), ["desanimou", "nao_conseguiu"]), ["obstaculo", "confianca"]);
  });
  it("collapses answers that share a branch", () => {
    assert.deepEqual(nextTargets(q("nao_votou_porque"), ["desanimou", "nenhum"]), ["confianca"]);
  });
  it("falls back to '*' when nothing matched (typed answer with no mapping)", () => {
    assert.deepEqual(nextTargets(q("nao_votou_porque"), []), ["confianca"]);
  });
  it("a forced next (from an interpreted answer) wins", () => {
    assert.deepEqual(nextTargets(q("nao_votou_porque"), ["nao_conseguiu"], "influencias"), ["influencias"]);
  });
  it("a plain next is itself", () => {
    assert.deepEqual(nextTargets(q("obstaculo"), ["trabalho_domingo", "criancas"]), ["preocupacoes"]);
  });
});
