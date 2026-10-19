import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SITUATIONS, labelOf, type CatalogueResponse, type PublicPersona } from "@boranois/shared";
import { api } from "../api";
import { Layout } from "../components";

let cache: CatalogueResponse | null = null;
function useCatalogue() {
  const [cat, setCat] = useState<CatalogueResponse | null>(cache);
  useEffect(() => {
    if (!cache) api<CatalogueResponse>("/catalogue").then((c) => ((cache = c), setCat(c)));
  }, []);
  return cat;
}

/** Twelve cards. One line each; tap for the whole profile. */
export function Perfis() {
  const cat = useCatalogue();
  return (
    <Layout>
      <h1>Os perfis</h1>
      <p className="lead">
        O app reconhece um jeito de pensar entre estes perfis e sugere como conversar. São escritos por pessoas, não por máquina,
        e são públicos de propósito. Se você se vê num deles e acha injusto, nos diga.
      </p>
      {!cat && <p className="muted">Carregando…</p>}
      <section className="persona-grid">
        {cat?.personas.map((p) => (
          <Link className={`persona-card ${p.engage ? "" : "stop"}`} to={`/perfis/${p.id}`} key={p.id}>
            <h2>{p.name}</h2>
            <p className="quote">{p.profile.identity}</p>
            <p className="muted small">{p.summary}</p>
          </Link>
        ))}
      </section>
      <p className="muted small">Escritos no feminino; o app adapta para ele/elu. Versão {cat?.version ?? "…"}.</p>
    </Layout>
  );
}

function Fact({ tone, label, children }: { tone: "peach" | "mint" | "sky" | "butter"; label: string; children: React.ReactNode }) {
  return (
    <div className="fact">
      <span className={`tag ${tone}`}>{label}</span>
      <p>{children}</p>
    </div>
  );
}

/** One profile, laid out to be read. */
export function Perfil() {
  const { id } = useParams();
  const cat = useCatalogue();
  const p: PublicPersona | undefined = cat?.personas.find((x) => x.id === id);
  if (!cat) return <Layout><p className="muted">Carregando…</p></Layout>;
  if (!p) return <Layout><p>Perfil não encontrado. <Link to="/perfis">Ver todos</Link>.</p></Layout>;
  const pr = p.profile;
  return (
    <Layout>
      <p><Link to="/perfis">← Todos os perfis</Link></p>
      <header className="persona-head">
        <p className="eyebrow">{p.situations.map((s) => labelOf(SITUATIONS, s)).join(" · ")}</p>
        <h1>{p.name}</h1>
        <p className="lead">{p.summary}</p>
        <blockquote className="says">
          <span className="eyebrow">Como ela se vê</span>
          <p>{pr.identity}</p>
        </blockquote>
      </header>

      <section className="persona-section">
        <h2 className="section-title">Como ela chegou aqui</h2>
        <p className="story">{pr.trust_story}</p>
      </section>

      {/* One row per thing to know, in the same rhythm as the tactics below: label on the left, one line on the right. */}
      <h2 className="section-title">Antes de falar</h2>
      <section className="fact-list">
        <Fact tone="peach" label="Sente">{pr.feelings.join(", ")}.</Fact>
        <Fact tone="sky" label="Onde ouve">{pr.media_diet.join(", ")}.</Fact>
        <Fact tone="mint" label="Em quem acredita">{pr.would_believe.join("; ")}.</Fact>
        <Fact tone="peach" label="O que a fecha">{pr.shuts_down.join("; ")}.</Fact>
        <Fact tone="mint" label="O que a abre">{pr.opens_up.join("; ")}.</Fact>
        <Fact tone="butter" label="O que vira a chave">{pr.turning_point}</Fact>
      </section>

      {p.engage ? (
        <>
          <h2 className="section-title">Como falar</h2>
          <section className="tactic-list">
            {p.tactics.map((t, i) => (
              <article className="tactic" key={i}>
                <span className="num">{i + 1}</span>
                <div><h3>{t.title}</h3><p>{t.detail}</p></div>
              </article>
            ))}
          </section>
        </>
      ) : (
        <section className="pane closes">
          <p className="eyebrow">Melhor não engajar</p>
          {p.tactics.map((t, i) => <p key={i}><strong>{t.title}.</strong> {t.detail}</p>)}
        </section>
      )}

      {p.avoid.length > 0 && (
        <>
          <h2 className="section-title">Evite</h2>
          <section className="avoid-list">
            {p.avoid.map((a, i) => (
              <p key={i}><strong>{a.what}.</strong> <span className="muted">{a.why}</span></p>
            ))}
          </section>
        </>
      )}
    </Layout>
  );
}
