import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validatePhrasing } from "../src/gemini.js";

const base = {
  template: "Tia, olha o que eu vi: 33,4 milhões de pessoas não votaram no 1º turno. Dessa vez o seu voto pesa.",
  factText: "No 1º turno, 33,4 milhões de pessoas não votaram (21% dos eleitores).",
  contentSummary: null,
  note: "minha tia, 62 anos",
  maxChars: 450,
};

describe("phrasing validator", () => {
  it("accepts a faithful rewrite", () => {
    assert.deepEqual(validatePhrasing("Tia, vi que 33,4 milhões de pessoas não votaram no 1º turno. Dessa vez seu voto pesa, viu?", base), []);
  });
  it("rejects numbers the model made up", () => {
    const p = validatePhrasing("Tia, 40 milhões ficaram em casa e o Lula está 10 pontos atrás!", base);
    assert.ok(p.some((x) => x.startsWith("new number: 40")));
    assert.ok(p.some((x) => x.startsWith("new number: 10")));
  });
  it("rejects links that weren't in the inputs", () => {
    assert.ok(validatePhrasing("Olha aqui: https://exemplo.com/x", base).some((x) => x.startsWith("new link")));
  });
  it("rejects more than one question, hashtags and over-length text", () => {
    assert.ok(validatePhrasing("Vai votar? Posso te buscar?", base).includes("more than one question"));
    assert.ok(validatePhrasing("Bora #Lula", base).includes("hashtag"));
    assert.ok(validatePhrasing("x".repeat(451), base)[0].startsWith("too long"));
  });
  it("numbers from the member's note are allowed", () => {
    assert.deepEqual(validatePhrasing("Tia, com 62 anos você já viu de tudo, né? Dessa vez seu voto pesa.", base), []);
  });
});
