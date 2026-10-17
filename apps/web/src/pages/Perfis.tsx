import { useEffect, useState } from "react";
import { SITUATIONS, labelOf, type CatalogueResponse } from "@boranois/shared";
import { api } from "../api";
import { Layout } from "../components";

// Public on purpose. Anyone, including the people described here, can read how we
// think about them and what we never do.
export function Perfis() {
  const [cat, setCat] = useState<CatalogueResponse | null>(null);
  useEffect(() => {
    api<CatalogueResponse>("/catalogue").then(setCat);
  }, []);

  return (
    <Layout>
      <h1>Os perfis</h1>
      <p>
        O app agrupa as pessoas em perfis para sugerir como conversar. Eles são públicos de propósito. Se você se vê num deles e
        acha injusto, nos diga.
      </p>
      <p className="muted small">Versão do catálogo: {cat?.version ?? "…"}</p>
      {cat?.personas.map((p) => (
        <section className="card" key={p.id}>
          <h2>{p.name} {!p.engage && <span className="badge stop">Não engajar</span>}</h2>
          <p className="muted small">{p.situations.map((s) => labelOf(SITUATIONS, s)).join(" · ")}</p>
          <p>{p.description}</p>
          <blockquote>{p.narrative}</blockquote>
          <p><strong>Valoriza:</strong> {p.values.join(", ")}.</p>
          <p><strong>Quer:</strong> {p.wishes.join("; ")}.</p>
          <p><strong>O que nunca fazemos:</strong></p>
          <ul>{p.donts.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </section>
      ))}
    </Layout>
  );
}
