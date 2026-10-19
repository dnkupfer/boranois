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
        <p className="quote big">{pr.identity}</p>
        <p className="lead">{p.summary}</p>
      </header>

      <section className="pane">
        <p className="eyebrow">Como ela chegou aqui</p>
        <p>{pr.trust_story}</p>
      </section>

      <section className="facts3">
        <div><p className="eyebrow">Sente</p><p>{pr.feelings.join(", ")}.</p></div>
        <div><p className="eyebrow">Onde ouve o que ouve</p><p>{pr.media_diet.join(", ")}.</p></div>
        <div><p className="eyebrow">Em quem acredita</p><p>{pr.would_believe.join("; ")}.</p></div>
      </section>

      <section className="two">
        <div className="pane closes"><p className="eyebrow">O que a fecha</p><ul>{pr.shuts_down.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div className="pane opens"><p className="eyebrow">O que a abre</p><ul>{pr.opens_up.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      </section>

      <section className="pane key">
        <p className="eyebrow">O que pode virar a chave</p>
        <p>{pr.turning_point}</p>
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
