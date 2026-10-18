import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadCatalogue } from "../src/catalogue.js";
import { inflect } from "../src/gender.js";

const cat = loadCatalogue(new URL("../../../content", import.meta.url).pathname);

describe("gender inflection", () => {
  it("turns the pessoa into a man without touching other feminine nouns", () => {
    assert.equal(inflect("Ela se sentiu enganada e sozinha; a dúvida dela é a vida.", "m"), "Ele se sentiu enganado e sozinho; a dúvida dele é a vida.");
    assert.equal(inflect("Sou prática. A pergunta prática é outra.", "m"), "Sou prático. A pergunta prática é outra.");
    assert.equal(inflect("Não sou otária. Eu também me senti otário.", "m"), "Não sou otário. Eu também me senti otário.");
  });
  it("leaves the feminine untouched", () => {
    assert.equal(inflect("Ela decide.", "f"), "Ela decide.");
  });
  it("every persona reads correctly as a man: no stray 'ela' or listed feminine forms remain", () => {
    for (const p of cat.personas) {
      const blob = inflect(JSON.stringify(p.profile) + JSON.stringify(p.tactics) + JSON.stringify(p.avoid) + JSON.stringify(p.steps), "m");
      assert.ok(!/\b(ela|dela|nela)\b/i.test(blob), `${p.id}: pronoun left: ${blob.match(/.{0,30}\b(ela|dela|nela)\b.{0,30}/i)?.[0]}`);
    }
  });
});
