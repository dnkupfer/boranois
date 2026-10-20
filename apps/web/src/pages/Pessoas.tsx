import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Contact, ContactState } from "@boranois/shared";
import { api } from "../api";
import { Layout, PriorityBadge, QuoteGrid } from "../components";
import { useCatalogue } from "./Perfis";
import { privateContacts } from "../local";
import { useSession } from "../session";

const ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
const STATE_LABEL: Record<ContactState, string> = {
  novo: "ainda não conversaram",
  aguardando: "esperando resposta",
  conversando: "respondeu — sua vez",
  objecao: "discordou — sua vez",
  cortou: "cortou o assunto",
  vai_votar: "vai votar ✓",
  votou: "votou ✓",
  perdido: "não vai votar",
  pausado: "em pausa",
};
const YOUR_TURN: ContactState[] = ["conversando", "objecao", "novo"];

const POINTS = [
  "Redes importam. Mas quem decide o voto é quem está perto.",
  "Opinião não vem de fatos. Vem do grupo.",
  "O Boranois mostra como a pessoa pensa e o que dizer.",
  "Manipular é convencer contra o interesse dela. Influenciar é convencer a favor.",
];
const RULES = ["Pergunte. Depois cale.", "Não mande link.", "Fato só se ela pedir. Um.", "Não discuta. Nunca.", "Ela decide."];

export function ago(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600000));
  if (h < 1) return "agora há pouco";
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}
const DONE: ContactState[] = ["votou", "perdido"];

export function Pessoas() {
  const { member } = useSession();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const names = privateContacts.all();
  const cat = useCatalogue();

  useEffect(() => {
    api<{ contacts: Contact[] }>("/contacts").then((r) => setContacts(r.contacts));
  }, []);

  // One list: people waiting for your move first, then by priority; finished ones last.
  const turn = (c: Contact) => (YOUR_TURN.includes(c.state) && c.state !== "novo" && c.priority.engage ? 0 : 1);
  const sorted = [...(contacts ?? [])].sort(
    (a, b) =>
      Number(DONE.includes(a.state)) - Number(DONE.includes(b.state)) ||
      turn(a) - turn(b) ||
      Number(!a.priority.engage) - Number(!b.priority.engage) ||
      ORDER[a.priority.level] - ORDER[b.priority.level],
  );

  return (
    <Layout>
      <header className="hero">
        <h1>Convença alguém que você conhece a <mark>ir votar</mark></h1>
        <p className="sub">
          Usando <Link to="/como-funciona">método científico</Link>, testado em campo.
        </p>
        <Link className="cta" to="/nova"><span className="plus">+</span> Influenciar uma pessoa a votar certo</Link>
      </header>

      <section className="points">
        {POINTS.map((p, i) => (
          <div className="card" key={i}><div className="ico">{i + 1}</div><p>{p}</p></div>
        ))}
      </section>

      <section className="rules">
        <h2>As cinco regras</h2>
        <ol>
          {RULES.map((r, i) => (
            <li key={i}><b>{i + 1}</b>{r}</li>
          ))}
        </ol>
        <p className="why"><Link to="/como-funciona">Por quê?</Link></p>
      </section>

      <section className="by-quote">
        <h2>Comece pelo que a pessoa diz</h2>
        <p className="muted">Reconheça o jeito de pensar e veja o que funciona. Sem cadastro, sem salvar nada.</p>
        {cat && <QuoteGrid personas={cat.personas} hrefFor={(id) => `/perfis/${id}`} />}
        <p className="muted small">Vai conversar com gente que você não conhece? <Link to="/rua">O guia da rua</Link> é diferente.</p>
      </section>

      <div className="row between people-head">
        <h2>Suas pessoas{member?.name ? `, ${member.name}` : ""}</h2>
        {sorted.length > 0 && <Link className="button secondary" to="/nova">+ Adicionar</Link>}
      </div>

      {contacts === null ? (
        <p className="muted">Carregando…</p>
      ) : sorted.length === 0 ? (
        <section className="card">
          <p>Pense em alguém que você conhece que não votou no 1º turno, votou em branco, ou está em dúvida.</p>
          <p className="muted">Três ou quatro pessoas bastam. O app diz por quem começar.</p>
        </section>
      ) : (
        <ul className="people">
          {sorted.map((c) => (
            <Row key={c.id} c={c} name={names[c.id]?.nickname} />
          ))}
        </ul>
      )}
    </Layout>
  );
}

function Row({ c, name }: { c: Contact; name?: string }) {
  return (
    <li>
      <Link to={`/pessoa/${c.id}`}>
        <div className="l">
          <div className="av" aria-hidden>{(name || "P").trim().charAt(0).toUpperCase()}</div>
          <div>
            <strong>{name || "Pessoa"}</strong>
            <div className="state">{STATE_LABEL[c.state]}{c.state === "aguardando" && ago(c.lastSentAt) ? ` · ${ago(c.lastSentAt)}` : ""}</div>
          </div>
        </div>
        <PriorityBadge level={c.priority.level} engage={c.priority.engage} />
      </Link>
    </li>
  );
}
