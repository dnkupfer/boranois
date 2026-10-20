import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PublicPersona } from "@boranois/shared";
import { Layout, QuoteGrid } from "../components";
import { useCatalogue } from "./Perfis";

// Two minutes with a stranger. Nothing here needs an account, the database or the AI:
// the page is the catalogue's street text, read straight from /api/catalogue.

const ELECTION_DAY = "2026-10-25";
const todayBR = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

const RULES = [
  { t: "Pergunte. Depois cale.", d: "A primeira pergunta é sobre ela, não sobre candidato. O que ela diz nos primeiros 30 segundos diz quem ela é." },
  { t: "Dois minutos.", d: "Na rua ninguém muda de ideia na hora. Você planta uma dúvida e um plano. Agradeça e siga." },
  { t: "Não discuta. Nunca.", d: "Se ela quiser brigar, não é a sua pessoa: “valeu pelo papo” e a próxima. Tem gente em dúvida a dez metros." },
  { t: "Feche com hora e lugar.", d: "“Que horas você vai? Sabe onde é a seção?” Quem sai da conversa com um plano, vai." },
];

const OPENERS = [
  "“Posso te fazer uma pergunta rápida? Você vai votar domingo?”",
  "“Você votou no 1º turno? Como foi?”",
  "“Tá difícil decidir, né? O que mais pesa pra você?”",
];

export function Rua() {
  const cat = useCatalogue();
  const [open, setOpen] = useState<string | null>(null);
  const electionDay = todayBR() >= ELECTION_DAY;
  const current: PublicPersona | undefined = cat?.personas.find((p) => p.id === open);
  const cardRef = useRef<HTMLElement>(null);
  // The card opens below the twelve quotes; on a phone that's far from the one tapped.
  useEffect(() => {
    if (open) setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }, [open]);

  return (
    <Layout>
      <header className="hero rua-hero">
        <p className="eyebrow">Na rua · até sábado, 22h</p>
        <h1>Dois minutos com quem você <mark>não conhece</mark></h1>
        <p className="sub">
          Feira, ponto de ônibus, fila, porta de escola. Sem relação de confiança, o objetivo muda: não é convencer, é deixar uma dúvida e um plano para domingo.
        </p>
      </header>

      {electionDay ? (
        <section className="card law stop">
          <h2>Hoje não.</h2>
          <p>
            No dia da eleição, abordar eleitor para pedir voto é <strong>boca de urna</strong>, crime previsto na Lei 9.504, art. 39, §5º. Vale camiseta, adesivo e silêncio. Se quiser ajudar hoje: leve alguém para votar.
          </p>
        </section>
      ) : (
        <section className="card law">
          <h2>Antes de sair</h2>
          <p>
            Conversar com eleitor na rua é permitido <strong>até sábado às 22h</strong>. No domingo vira <strong>boca de urna</strong>, crime (Lei 9.504, art. 39, §5º): só camiseta e silêncio. Não filme ninguém, não peça telefone, não entregue nada na mão de quem não pediu. Vá em dupla.
          </p>
        </section>
      )}

      <section className="rules rua-rules">
        <h2>As quatro regras da rua</h2>
        <ol>
          {RULES.map((r, i) => (
            <li key={i}><b>{i + 1}</b><span><strong>{r.t}</strong> {r.d}</span></li>
          ))}
        </ol>
      </section>

      <h2 className="section-title">Como abrir</h2>
      <div className="openers">
        {OPENERS.map((o, i) => <div className="opener" key={i}>{o}</div>)}
      </div>
      <p className="muted">A resposta diz quem ela é. Encontre a frase dela abaixo.</p>

      <h2 className="section-title">Em 30 segundos: ela diz…</h2>
      {!cat && <p className="muted">Carregando…</p>}
      {cat && <QuoteGrid personas={cat.personas} selected={open} onPick={(id) => setOpen(id === open ? null : id)} />}

      {current && current.rua && (
        <section className="card street" key={current.id} ref={cardRef}>
          <p className="eyebrow">{current.engage ? "Na rua, com" : "Melhor não insistir com"}</p>
          <h2>{current.name}</h2>
          <p className="street-quote">{current.profile.identity}</p>
          <div className="street-steps">
            <div><span className="tag mint">Abra</span><p>{current.rua.abra}</p></div>
            <div><span className="tag sky">Diga</span><ul>{current.rua.diga.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
            <div><span className="tag butter">Feche</span><p>{current.rua.feche}</p></div>
            {current.avoid.length > 0 && (
              <div><span className="tag peach">Evite</span><p>{current.avoid.map((a) => a.what).join(". ")}.</p></div>
            )}
          </div>
          <p className="muted small">
            Quer entender essa pessoa a fundo? <Link to={`/perfis/${current.id}`}>Veja o perfil completo</Link>.
          </p>
        </section>
      )}

      <section className="card avoid rua-no">
        <h2>Na rua, nunca</h2>
        <ul>
          <li><strong>Panfleto na mão.</strong> Vira campanha. A conversa vira folheto e acaba.</li>
          <li><strong>Número, pesquisa, link.</strong> Em dois minutos, um fato só, e só se ela pedir.</li>
          <li><strong>Falar do candidato antes dela falar dela.</strong> Primeiro a vida dela. Depois, se couber, o voto.</li>
          <li><strong>Insistir.</strong> Ela decide. Você já fez a sua parte quando saiu com um plano combinado.</li>
        </ul>
      </section>

      <p className="muted">
        Conversando com alguém que você conhece? Aí dá para acompanhar: <Link to="/nova">adicione a pessoa</Link> e o app sugere cada passo.
      </p>
    </Layout>
  );
}
