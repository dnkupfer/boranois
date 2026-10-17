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
  conversando: "conversando",
  objecao: "ela discordou",
  cortou: "cortou o assunto",
  vai_votar: "vai votar ✓",
  votou: "votou ✓",
  perdido: "não vai votar",
  pausado: "em pausa",
};

export function Pessoas() {
  const { me } = useSession();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [prof, setProf] = useState(profile.get);
  const names = privateContacts.all();

  useEffect(() => {
    api<{ contacts: Contact[] }>("/contacts").then((r) => setContacts(r.contacts));
  }, []);

  const sorted = [...(contacts ?? [])].sort((a, b) => {
    const done = (c: Contact) => (c.state === "votou" || c.state === "perdido" ? 1 : 0);
    return done(a) - done(b) || Number(!a.priority.engage) - Number(!b.priority.engage) || ORDER[a.priority.level] - ORDER[b.priority.level];
  });

  const saveGroups = (groups: GroupId[]) => {
    const next = { ...prof, groups };
    setProf(next);
    profile.set(next);
  };

  return (
    <Layout>
      <h1>Olá, {me?.member.name ?? ""}!</h1>
      <p>Com quem você vai conversar até dia 25? Comece pelas pessoas de prioridade alta.</p>

      {prof.groups.length === 0 && (
        <section className="card">
          <h2>Antes, sobre você</h2>
          <p>De que grupos você faz parte? Quem é do mesmo grupo que você ouve mais o que você diz.</p>
          <ChipGroup options={GROUPS} value={prof.groups} onChange={saveGroups} max={3} />
        </section>
      )}

      <Link className="button primary" to="/nova">+ Adicionar uma pessoa</Link>

      {contacts === null ? (
        <p className="muted">Carregando…</p>
      ) : sorted.length === 0 ? (
        <p className="muted">Nenhuma pessoa ainda. Pense em alguém que você conhece que não votou no 1º turno.</p>
      ) : (
        <ul className="people">
          {sorted.map((c) => (
            <li key={c.id}>
              <Link to={`/pessoa/${c.id}`}>
                <div>
                  <strong>{names[c.id]?.nickname || "Pessoa"}</strong>
                  <span className="muted"> · {c.match.personaName}</span>
                  <div className="muted small">{STATE_LABEL[c.state]}</div>
                </div>
                <PriorityBadge level={c.priority.level} engage={c.priority.engage} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
