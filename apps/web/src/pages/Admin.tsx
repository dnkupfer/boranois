import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api";
import { Layout } from "../components";
import { useSession } from "../session";

// The maintainer's view of how the app is used. Open to members signed in with an e-mail listed in
// ADMIN_EMAILS (the API checks; the nav link is only a convenience). Two sources, labelled as such: the app's own tables (everyone) and
// analytics events (only devices that accepted measurement).

type Row = { key: string; label: string; count: number };
type Overview = {
  sinceDays: number;
  totals: { visitors: number; members: number; pessoas: number; willVote: number; voted: number; byPersona: Row[]; byChance: Row[]; byState: Row[]; outcomes: Row[] };
  consented: number;
  funnel: Row[];
  daily: { day: string; devices: number; added: number; replies: number }[];
  leftAt: Row[];
  typedIn: Row[];
  steps: { key: string; shown: number; sent: number; skipped: number }[];
  coach: { asks: number; replies: number; suggestionsUsed: number };
  signin: { links: number; done: number };
  aiRemainingToday: number;
};

const PERIODS = [{ days: 1, label: "Hoje" }, { days: 7, label: "7 dias" }, { days: 30, label: "30 dias" }];
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");

export function Admin() {
  const { member, isAdmin } = useSession();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setError(null);
    try {
      setData(await api<Overview>(`/admin/overview?days=${days}`));
    } catch (err) {
      setError(err instanceof ApiError ? `A API respondeu ${err.status}.` : "Sem conexão com a API.");
    }
  }, [isAdmin, days]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) {
    return (
      <Layout narrow>
        <section className="card">
          <h1>Admin</h1>
          {member?.email ? (
            <p><strong>{member.email}</strong> não está na lista de admin (ADMIN_EMAILS).</p>
          ) : (
            <>
              <p>Entre com o seu e-mail de admin para ver os números.</p>
              <Link className="button primary" to="/entrar">Entrar com e-mail</Link>
            </>
          )}
        </section>
      </Layout>
    );
  }

  const t = data?.totals;
  const first = data?.funnel[0]?.count ?? 0;
  return (
    <Layout>
      <div className="row between admin-head">
        <h1>Números</h1>
        <div className="chips">
          {PERIODS.map((p) => (
            <button key={p.days} type="button" className={`chip ${days === p.days ? "on" : ""}`} onClick={() => setDays(p.days)}>{p.label}</button>
          ))}
          <button type="button" className="chip" onClick={load} title="Atualizar">↻</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {!data || !t ? (
        <p className="muted">Carregando…</p>
      ) : (
        <>
          <p className="eyebrow">Desde o início · todo mundo</p>
          <section className="stats">
            <Stat n={t.visitors} label="aparelhos abriram o app" tone="sky" />
            <Stat n={t.members} label="adicionaram alguém" tone="mint" />
            <Stat n={t.pessoas} label="pessoas sendo convencidas" tone="peach" />
            <Stat n={t.willVote + t.voted} label={`vão votar ou votaram (${t.voted} já votaram)`} tone="butter" />
          </section>

          <h2 className="section-title">Por dia · últimos {data.sinceDays} {data.sinceDays === 1 ? "dia" : "dias"}</h2>
          <Daily daily={data.daily} />

          <div className="admin-grid">
            <section className="card">
              <h2>Funil</h2>
              <p className="muted small">Aparelhos que aceitaram a medição ({data.consented}) neste período.</p>
              <Bars rows={data.funnel} note={(r, i) => (i === 0 ? "" : `${pct(r.count, first)} do total`)} />
            </section>
            <section className="card">
              <h2>Onde param ao adicionar</h2>
              <p className="muted small">Última pergunta vista por quem saiu sem terminar.</p>
              <Bars rows={data.leftAt} empty="Ninguém parou no meio." />
            </section>
          </div>

          <div className="admin-grid">
            <section className="card">
              <h2>Perfis</h2>
              <Bars rows={t.byPersona} empty="Ainda ninguém." />
            </section>
            <section className="card">
              <h2>Chance</h2>
              <Bars rows={t.byChance} />
              <h2 className="sub-title">Em que pé está</h2>
              <Bars rows={t.byState} empty="Ainda ninguém." />
            </section>
          </div>

          <div className="admin-grid">
            <section className="card">
              <h2>O que responderam</h2>
              <p className="muted small">Desde o início, todo mundo.</p>
              <Bars rows={t.outcomes} empty="Nenhuma resposta registrada ainda." />
            </section>
            <section className="card">
              <h2>Passos</h2>
              <p className="muted small">Mostrados → enviados. Um passo muito pulado pede reescrita.</p>
              {data.steps.length === 0 ? <p className="muted">Nada ainda.</p> : (
                <table className="admin-table">
                  <thead><tr><th>Passo</th><th>Vistos</th><th>Enviados</th><th>Pulados</th></tr></thead>
                  <tbody>{data.steps.map((s) => <tr key={s.key}><td>{s.key}</td><td>{s.shown}</td><td>{s.sent} <span className="muted">({pct(s.sent, s.shown)})</span></td><td>{s.skipped}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          </div>

          <div className="admin-grid">
            <section className="card">
              <h2>Vira-voto coach</h2>
              <ul className="kv">
                <li><span>Perguntas</span><b>{data.coach.asks}</b></li>
                <li><span>Respostas coladas</span><b>{data.coach.replies}</b></li>
                <li><span>Sugestões usadas</span><b>{data.coach.suggestionsUsed}</b></li>
                <li><span>Chamadas de IA restantes hoje</span><b>{data.aiRemainingToday}</b></li>
              </ul>
            </section>
            <section className="card">
              <h2>Respostas digitadas (“+ outra”)</h2>
              <p className="muted small">Onde as opções não bastaram: candidatas a novas opções.</p>
              <Bars rows={data.typedIn} empty="Ninguém digitou ainda." />
              <ul className="kv">
                <li><span>Links de e-mail pedidos / entradas</span><b>{data.signin.links} / {data.signin.done}</b></li>
              </ul>
            </section>
          </div>

          <p className="muted small">
            “Desde o início” vem das tabelas do app e conta todo mundo. Funil, por dia (aparelhos), passos e coach vêm da medição,
            que só existe para quem aceitou.
          </p>
        </>
      )}
    </Layout>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={`stat ${tone}`}>
      <b>{n.toLocaleString("pt-BR")}</b>
      <span>{label}</span>
    </div>
  );
}

function Bars({ rows, note, empty = "Nada ainda." }: { rows: Row[]; note?: (r: Row, i: number) => string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="bars">
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="bar-label"><span>{r.label}</span><b>{r.count}{note && note(r, i) ? <em> · {note(r, i)}</em> : null}</b></div>
          <div className="bar"><span style={{ width: `${(100 * r.count) / max}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function Daily({ daily }: { daily: Overview["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => Math.max(d.devices, d.added)));
  const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return (
    <section className="card daily">
      <div className="legend"><span className="dot sky" /> aparelhos (com medição) <span className="dot peach" /> pessoas adicionadas</div>
      <div className="cols" style={{ gridTemplateColumns: `repeat(${daily.length}, 1fr)` }}>
        {daily.map((d) => (
          <div className="col" key={d.day} title={`${short(d.day)}: ${d.devices} aparelhos, ${d.added} pessoas, ${d.replies} respostas`}>
            <div className="pair">
              <span className="sky" style={{ height: `${(100 * d.devices) / max}%` }} />
              <span className="peach" style={{ height: `${(100 * d.added) / max}%` }} />
            </div>
            {daily.length <= 14 || Number(d.day.slice(8, 10)) % 5 === 0 ? <small>{short(d.day)}</small> : <small>&nbsp;</small>}
          </div>
        ))}
      </div>
    </section>
  );
}
