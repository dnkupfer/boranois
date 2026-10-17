import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getObjective,
  MAX_INVITES_PER_GROUP,
  OBJECTIVES,
  type FeedResponse,
  type Invite,
  type MeResponse,
  type ObjectiveId,
} from "@boranois/shared";
import { api } from "../api";
import { CopyButton, Layout } from "../components";
import { useSession } from "../session";

export function Painel() {
  const { me, extension } = useSession();
  if (!me) return <Layout><p>Carregando…</p></Layout>;
  const isHost = me.member.role === "host";

  return (
    <Layout>
      <h1>Olá, {me.member.name}!</h1>
      {me.group.objective ? (
        <p className="objective-banner">
          Objetivo do grupo: <strong>{getObjective(me.group.objective).title}</strong>
        </p>
      ) : (
        !isHost && <p>Quem te convidou ainda está escolhendo o objetivo do grupo.</p>
      )}

      {isHost && <HostSetup me={me} />}

      {extension !== "connected" && (
        <section className="card">
          <h2>Instale a extensão</h2>
          <p>Com ela, você verifica um post do Instagram com um clique.</p>
          <Link className="button primary" to="/extensao">Como instalar</Link>
        </section>
      )}

      <Feed />
    </Layout>
  );
}

function HostSetup({ me }: { me: MeResponse }) {
  return (
    <>
      <ObjectivePicker current={me.group.objective} />
      <Invites invites={me.invites} />
      <InstagramGroup />
    </>
  );
}

function ObjectivePicker({ current }: { current: ObjectiveId | null }) {
  const { refresh } = useSession();
  const choose = async (objective: ObjectiveId) => {
    await api("/group", { method: "PUT", body: { objective } });
    await refresh();
  };
  return (
    <section className="card">
      <h2>1. Escolha o objetivo do grupo</h2>
      <p>Os posts serão avaliados de acordo com este objetivo.</p>
      <div className="options">
        {OBJECTIVES.map((o) => (
          <button
            key={o.id}
            className={`option ${current === o.id ? "selected" : ""}`}
            onClick={() => choose(o.id)}
          >
            <strong>{current === o.id ? "✓ " : ""}{o.title}</strong>
            <span>{o.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function whatsappLink(invite: Invite) {
  const url = `${window.location.origin}/entrar?codigo=${invite.code}`;
  const text =
    `Oi${invite.contactName ? `, ${invite.contactName}` : ""}! Estou montando um grupinho de 5 amigos ` +
    `para ajudar o Lula no segundo turno, compartilhando no Instagram os posts que valem a pena. ` +
    `Quer participar? É só abrir este link: ${url}`;
  let digits = (invite.phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`; // Brazilian number without country code
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function Invites({ invites }: { invites: Invite[] }) {
  const { refresh } = useSession();
  const free = MAX_INVITES_PER_GROUP - invites.length;
  const [rows, setRows] = useState(() => Array.from({ length: free }, () => ({ name: "", phone: "" })));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRows(Array.from({ length: free }, () => ({ name: "", phone: "" })));
  }, [free]);

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
    <section className="card">
      <h2>2. Convide até {MAX_INVITES_PER_GROUP} amigos</h2>
      {invites.length > 0 && (
        <ul className="invites">
          {invites.map((i) => (
            <li key={i.code}>
              <div>
                <strong>{i.contactName}</strong>
                <span className="muted">
                  {i.usedByName ? ` — entrou como ${i.usedByName} ✓` : ` — código ${i.code}`}
                </span>
              </div>
              {!i.usedByName && (
                <a className="button whatsapp" href={whatsappLink(i)} target="_blank" rel="noreferrer">
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
              <input
                placeholder="Nome"
                value={r.name}
                onChange={(e) => setRows(rows.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)))}
              />
              <input
                placeholder="WhatsApp (com DDD)"
                inputMode="tel"
                value={r.phone}
                onChange={(e) => setRows(rows.map((x, j) => (j === idx ? { ...x, phone: e.target.value } : x)))}
              />
            </div>
          ))}
          <button className="primary" disabled={busy}>Criar convites</button>
        </form>
      )}
    </section>
  );
}

const IG_STEPS = [
  "Espere seus amigos entrarem aqui (aparece ✓ ao lado do nome).",
  "No Instagram, abra as Mensagens (ícone de avião de papel ou balão, no alto).",
  "Toque no lápis (Nova mensagem) e escolha as pessoas do grupo.",
  "Toque em “Criar bate-papo em grupo” e dê um nome ao grupo.",
];

function InstagramGroup() {
  const [done, setDone] = useState<boolean[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("boranois.igSteps") ?? "[]");
    } catch {
      return [];
    }
  });
  const toggle = (i: number) => {
    const next = [...done];
    next[i] = !next[i];
    setDone(next);
    try {
      localStorage.setItem("boranois.igSteps", JSON.stringify(next));
    } catch {}
  };

  return (
    <section className="card">
      <h2>3. Crie o grupo no Instagram</h2>
      <ol className="checklist">
        {IG_STEPS.map((s, i) => (
          <li key={i}>
            <label>
              <input type="checkbox" checked={!!done[i]} onChange={() => toggle(i)} /> {s}
            </label>
          </li>
        ))}
      </ol>
      <p className="muted">
        Pronto! Para mandar um post ao grupo, é só usar o botão ✈️ (Compartilhar) do próprio Instagram.
      </p>
    </section>
  );
}

function Feed() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  useEffect(() => {
    api<FeedResponse>("/feed").then(setFeed).catch(() => setFeed({ items: [] }));
  }, []);
  if (!feed?.items.length) return null;
  return (
    <section className="card">
      <h2>Posts aprovados pelo grupo</h2>
      <ul className="feed">
        {feed.items.map((item) => (
          <li key={item.id}>
            <p>
              <strong>{item.handle ? `@${item.handle}` : "Post"}</strong>{" "}
              <span className="muted">— verificado por {item.checkedBy}</span>
            </p>
            <p className="excerpt">{item.captionExcerpt}</p>
            <div className="row">
              {item.postUrl && (
                <a className="button" href={item.postUrl} target="_blank" rel="noreferrer">Abrir post</a>
              )}
              {item.suggestedComment && <CopyButton text={item.suggestedComment} label="Copiar comentário" />}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
