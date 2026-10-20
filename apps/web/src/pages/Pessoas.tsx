import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Contact, ContactState } from "@boranois/shared";
import { api } from "../api";
import { Layout, PriorityBadge } from "../components";
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
  "Rede social a gente já sabe: assiste até o fim, compartilha, salva, próximo.",
  "Tem 30 milhões de pessoas que não odeiam o Lula, ou odeiam mais o Flávio, e não vão votar.",
  "Para achar essas pessoas, todo mundo precisa conversar com todo mundo.",
  "Boa intenção não basta. Existe método para a conversa funcionar. Esta página mostra.",
];
/** "Faltam 5 dias", computed in Brazil's calendar; silent once the election has passed. */
function countdown(): string | null {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const days = Math.round((Date.UTC(2026, 9, 25) - Date.parse(today + "T00:00:00Z")) / 86400000);
  if (days > 1) return `Faltam ${days} dias.`;
  if (days === 1) return "É amanhã.";
  if (days === 0) return "É hoje.";
  return null;
}
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
        <h1>Conversar pra <mark>virar!</mark></h1>
        <p className="sub">
          Agora é cara a cara. {countdown() ?? ""} Não dá para gastar na conversa errada.
        </p>
      </header>

      <section className="points">
        {POINTS.map((p, i) => (
          <div className="card" key={i}><div className="ico">{i + 1}</div><p>{p}</p></div>
        ))}
      </section>

      <section className="paths">
        <h2>Dois caminhos</h2>
        <div className="path-grid">
          <div className="card path best">
            <p className="eyebrow">O melhor caminho</p>
            <h3>Alguém que você conhece</h3>
            <p>
              Pense bem: parente, amiga, vizinho, colega que <strong>não votou, anulou ou está em dúvida</strong>. Confiança é o que faz a conversa entrar.
            </p>
            <Link className="cta" to="/nova"><span className="plus">+</span> Influenciar uma pessoa a votar certo</Link>
          </div>
          <div className="card path">
            <p className="eyebrow">Não tem ninguém?</p>
            <h3>Vá para a rua</h3>
            <p>Feira, ponto de ônibus, porta de escola. Dois minutos, um plano para domingo.</p>
            <Link className="button" to="/rua">O guia da rua</Link>
            <p className="small muted">Até sábado, 22h.</p>
          </div>
        </div>
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
