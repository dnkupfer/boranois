import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GROUPS, type Contact, type ContactState, type GroupId } from "@boranois/shared";
import { api } from "../api";
import { ChipGroup, Layout, PriorityBadge } from "../components";
import { privateContacts, profile } from "../local";
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
const DONE: ContactState[] = ["votou", "perdido"];

export function Pessoas() {
  const { member } = useSession();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [prof, setProf] = useState(profile.get);
  const names = privateContacts.all();

  useEffect(() => {
    api<{ contacts: Contact[] }>("/contacts").then((r) => setContacts(r.contacts));
  }, []);

  const sorted = [...(contacts ?? [])].sort(
    (a, b) =>
      Number(DONE.includes(a.state)) - Number(DONE.includes(b.state)) ||
      Number(!a.priority.engage) - Number(!b.priority.engage) ||
      ORDER[a.priority.level] - ORDER[b.priority.level] ||
      Number(YOUR_TURN.includes(b.state)) - Number(YOUR_TURN.includes(a.state)),
  );
  const yourTurn = sorted.filter((c) => YOUR_TURN.includes(c.state) && c.priority.engage && c.state !== "novo");

  const saveGroups = (groups: GroupId[]) => {
    const next = { ...prof, groups };
    setProf(next);
    profile.set(next);
  };

  return (
    <Layout>
      <h1>Oi, {member?.name ?? ""}</h1>

      {prof.groups.length === 0 && (
        <section className="card accent">
          <h2>Antes, sobre você</h2>
          <p>De que grupos você faz parte? Quem é do mesmo grupo ouve mais o que você diz.</p>
          <ChipGroup options={GROUPS} value={prof.groups} onChange={saveGroups} max={3} />
        </section>
      )}

      {yourTurn.length > 0 && (
        <section className="card accent">
          <h2>Sua vez</h2>
          <ul className="people">
            {yourTurn.map((c) => (
              <Row key={c.id} c={c} name={names[c.id]?.nickname} />
            ))}
          </ul>
        </section>
      )}

      <div className="row between">
        <h2>Suas pessoas</h2>
        <Link className="button primary" to="/nova">+ Adicionar</Link>
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
          <div className="muted small">{STATE_LABEL[c.state]}</div>
        </div>
        <PriorityBadge level={c.priority.level} engage={c.priority.engage} />
      </Link>
    </li>
  );
}
