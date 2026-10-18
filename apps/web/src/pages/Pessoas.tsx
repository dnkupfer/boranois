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
      <header className="intro">
        <h1>Convença alguém que você conhece a ir votar</h1>
        <p className="subtitle">
          Não são dicas. É um método com base científica, testado em campo.{" "}
          <Link to="/como-funciona#metodo">Veja a ciência por trás</Link>.
        </p>
        <ol className="points">
          <li>Redes importam. Mas quem decide o voto é quem está perto.</li>
          <li>Opinião não vem de fatos. Vem do grupo.</li>
          <li>O Boranois mostra como a pessoa pensa e o que dizer.</li>
          <li>Manipular é convencer contra o interesse dela. Influenciar é convencer a favor.</li>
        </ol>
      </header>

      <section className="card rules">
        <h2>As cinco regras</h2>
        <ol>
          <li>Pergunte. Depois cale.</li>
          <li>Não mande link.</li>
          <li>Fato só se ela pedir. Um.</li>
          <li>Não discuta. Nunca.</li>
          <li>Ela decide.</li>
        </ol>
        <p className="small"><Link to="/como-funciona">Por quê?</Link></p>
      </section>

      <div className="row between">
        <h2>Suas pessoas{member?.name ? `, ${member.name}` : ""}</h2>
        <Link className="button primary" to="/nova">+ Influenciar uma pessoa a votar certo</Link>
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
        <div>
          <strong>{name || "Pessoa"}</strong>
          <div className="muted small">{STATE_LABEL[c.state]}{c.state === "aguardando" && ago(c.lastSentAt) ? ` · ${ago(c.lastSentAt)}` : ""}</div>
        </div>
        <PriorityBadge level={c.priority.level} engage={c.priority.engage} />
      </Link>
    </li>
  );
}
