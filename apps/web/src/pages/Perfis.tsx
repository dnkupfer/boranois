import { useEffect, useState } from "react";
import { SITUATIONS, labelOf, type CatalogueResponse } from "@boranois/shared";
import { api } from "../api";
import { Layout } from "../components";

/** The persona catalogue, readable. Public on purpose: anyone can see how we think about people. */
export function Perfis() {
  const [cat, setCat] = useState<CatalogueResponse | null>(null);
  useEffect(() => {
    api<CatalogueResponse>("/catalogue").then(setCat);
  }, []);

  return (
    <Layout>
      <h1>Os perfis</h1>
      <p>
        O app reconhece um jeito de pensar entre estes perfis e sugere como conversar. Eles são escritos por pessoas, não por
        máquina, e são públicos de propósito. Se você se vê num deles e acha injusto, nos diga.
      </p>
      <section className="card">
        {!cat && <p className="muted">Carregando…</p>}
        {cat?.personas.map((p) => (
          <details className="persona" key={p.id}>
            <summary>
              {p.name} <span>· {p.situations.map((s) => labelOf(SITUATIONS, s)).join(" · ")}{!p.engage ? " · não engajar" : ""}</span>
            </summary>
            <div className="body">
              <p>{p.summary}</p>
              <h3>Como chegou aqui</h3>
              <p>{p.profile.trust_story}</p>
              <p><strong>Sente:</strong> {p.profile.feelings.join(", ")}. <strong>Como se vê:</strong> {p.profile.identity}</p>
              <p><strong>Onde ouve o que ouve:</strong> {p.profile.media_diet.join(", ")}.</p>
              <p><strong>O que a fecha:</strong> {p.profile.shuts_down.join("; ")}.</p>
              <p><strong>O que a abre:</strong> {p.profile.opens_up.join("; ")}.</p>
              <p><strong>Em quem acredita:</strong> {p.profile.would_believe.join("; ")}.</p>
              <p><strong>O que pode virar a chave:</strong> {p.profile.turning_point}</p>
              <h3>Como falar</h3>
              <ol>
                {p.tactics.map((t, i) => (
                  <li key={i}><strong>{t.title}.</strong> {t.detail}</li>
                ))}
              </ol>
              {p.avoid.length > 0 && (
                <>
                  <h3>Evite</h3>
                  <ul>
                    {p.avoid.map((a, i) => (
                      <li key={i}><strong>{a.what}.</strong> <span className="muted">{a.why}</span></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </details>
        ))}
        {cat && <p className="muted small">Versão do catálogo: {cat.version}.</p>}
      </section>
    </Layout>
  );
}
