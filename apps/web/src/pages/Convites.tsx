import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { MAX_INVITES_PER_GROUP, type Invite } from "@boranois/shared";
import { api } from "../api";
import { Layout } from "../components";
import { whatsappLink } from "../local";
import { useSession } from "../session";

function inviteText(invite: Invite) {
  const url = `${window.location.origin}/entrar?codigo=${invite.code}`;
  return (
    `Oi${invite.contactName ? `, ${invite.contactName}` : ""}! Tô montando um grupinho de 5 amigos pra conversar, cada um com gente que conhece, ` +
    `sobre votar no dia 25. Nada de discussão: é falar com quem não votou ou tá em dúvida, do nosso jeito. ` +
    `Quer participar? É só abrir este link: ${url}`
  );
}

export function Convites() {
  const { me, refresh } = useSession();
  const invites = me?.invites ?? [];
  const free = MAX_INVITES_PER_GROUP - invites.length;
  const [rows, setRows] = useState(() => Array.from({ length: Math.max(free, 0) }, () => ({ name: "", phone: "" })));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRows(Array.from({ length: Math.max(free, 0) }, () => ({ name: "", phone: "" })));
  }, [free]);

  if (me && me.member.role !== "host") return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const contacts = rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name, phone: r.phone || undefined }));
    if (!contacts.length) return;
    setBusy(true);
    try {
      await api("/invites", { body: { contacts } });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <h1>Convide até {MAX_INVITES_PER_GROUP} amigos</h1>
      <p>Cada um vai conversar com as pessoas que conhece. Diga a eles que a conta de Instagram ou WhatsApp é deles, e as conversas também.</p>
      <section className="card">
        {invites.length > 0 && (
          <ul className="invites">
            {invites.map((i) => (
              <li key={i.code}>
                <div>
                  <strong>{i.contactName}</strong>
                  <span className="muted">{i.usedByName ? ` — entrou como ${i.usedByName} ✓` : ` — código ${i.code}`}</span>
                </div>
                {!i.usedByName && (
                  <a className="button whatsapp" href={whatsappLink(i.phone ?? "", inviteText(i))} target="_blank" rel="noreferrer">
                    Enviar no WhatsApp
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        {free > 0 && (
          <form onSubmit={submit}>
            {rows.map((r, idx) => (
              <div className="row" key={idx}>
                <input placeholder="Nome" value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)))} />
                <input placeholder="WhatsApp (com DDD)" inputMode="tel" value={r.phone} onChange={(e) => setRows(rows.map((x, j) => (j === idx ? { ...x, phone: e.target.value } : x)))} />
              </div>
            ))}
            <button className="primary" disabled={busy}>Criar convites</button>
          </form>
        )}
      </section>
    </Layout>
  );
}
