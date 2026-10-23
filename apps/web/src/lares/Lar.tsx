import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LAR_OUTCOMES, type LarDetail, type LarOutcome } from "@boranois/shared";
import { ChipGroup, CopyButton } from "../components";
import { BASE, fmtCep, fmtPhone, KIND_LABEL, LaresLayout, laresApi, SCRIPT, statusLabel, volunteer, VolunteerForm } from "./shared";

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "agora" : m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`;
};
const OUTCOME_LABEL = Object.fromEntries(LAR_OUTCOMES.map((o) => [o.id, o.label]));

export function Lar() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [vol, setVol] = useState(volunteer.get);
  const [d, setD] = useState<LarDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<LarOutcome[]>([]);
  const [interested, setInterested] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [askWho, setAskWho] = useState(false);

  const load = useCallback(async () => {
    try { setD(await laresApi<LarDetail>(`/${id}`, { email: volunteer.get()?.email })); } catch { navigate(BASE); }
  }, [id, navigate]);
  useEffect(() => { load(); }, [load]);

  const claim = async () => {
    const v = volunteer.get();
    if (!v) return setAskWho(true);
    setError(null);
    try { await laresApi(`/${id}/claim`, { body: v }); await load(); }
    catch (err) { const e = err as { status?: number; by?: string }; setError(e.status === 409 ? `${e.by ?? "Alguém"} já está ligando.` : "Não deu certo agora."); load(); }
  };
  const release = async () => {
    const v = volunteer.get(); if (!v) return;
    await laresApi(`/${id}/release`, { body: v }).catch(() => {});
    load();
  };
  const save = async () => {
    const v = volunteer.get(); const o = outcome[0];
    if (!v || !o) return;
    setBusy(true); setError(null);
    try {
      await laresApi(`/${id}/outcome`, { body: { ...v, outcome: o, interested: interested ? Number(interested) : undefined, notes: notes.trim() || undefined } });
      setOutcome([]); setInterested(""); setNotes("");
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { const e = err as { status?: number; by?: string }; setError(e.status === 409 ? `${e.by ?? "Alguém"} está ligando para essa casa agora.` : "Não deu para registrar. Tente de novo."); }
    finally { setBusy(false); }
  };

  if (!d) return <LaresLayout narrow><p className="muted">Carregando…</p></LaresLayout>;
  const { home, calling, helpers, history } = d;
  const needsCount = ["interessados", "ajudantes", "van", "ja_tem"].includes(outcome[0] ?? "");

  return (
    <LaresLayout narrow>
      <p><Link to={BASE}>← Casas</Link></p>
      <header className="lar-head">
        <p className="eyebrow">{KIND_LABEL[home.kind]} · {home.city}/{home.state}</p>
        <h1>{home.name}</h1>
        {home.legal_name && home.legal_name.toLowerCase() !== home.name.toLowerCase() && <p className="muted small">{home.legal_name}</p>}
        <p>{[home.address, home.neighbourhood, fmtCep(home.cep)].filter(Boolean).join(" · ")}</p>
        <div className="row">
          {home.phone ? <a className="button primary tel" href={`tel:+55${home.phone}`}>📞 {fmtPhone(home.phone)}</a> : <span className="badge st-telefone_errado">sem telefone</span>}
          {home.phone2 && <a className="button secondary" href={`tel:+55${home.phone2}`}>{fmtPhone(home.phone2)}</a>}
          <span className={`badge st-${home.status}`}>{statusLabel(home)}</span>
        </div>
        {calling && !calling.mine && <p className="card law"><strong>{calling.name}</strong> está ligando para esta casa agora ({ago(calling.since)}). Para não ligarem duas vezes, escolha outra casa.</p>}
        {calling?.mine && <p className="card law">Esta casa está marcada com o seu nome. Ninguém mais vai ligar para ela. Ligue, e depois marque abaixo o que aconteceu.</p>}
      </header>

      {askWho && <VolunteerForm onDone={(v) => { setVol(v); setAskWho(false); claim(); }} />}
      {error && <p className="error">{error}</p>}

      {!calling && home.phone && (
        <section className="card">
          <h2>Quer ligar para esta casa?</h2>
          <p>Aperte o botão. A casa fica marcada com o seu nome, aparece o roteiro do que dizer, e ninguém mais liga para ela.</p>
          <button className="primary" onClick={claim}>Vou ligar para esta</button>
        </section>
      )}

      {calling?.mine && (
        <>
          <section className="card script">
            <p className="eyebrow">1. Ligue e diga</p>
            {SCRIPT.map((s, i) => <p key={i}>{s}</p>)}
            <CopyButton text={SCRIPT.slice(0, 3).join(" ")} label="Copiar roteiro" />
          </section>

          <section className="card step-card">
            <p className="eyebrow">2. Depois da ligação, marque o que aconteceu</p>
            <ChipGroup options={LAR_OUTCOMES} value={outcome} onChange={setOutcome} max={1} />
            {needsCount && (
              <label>Quantos moradores querem ir?
                <input value={interested} onChange={(e) => setInterested(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="ex.: 3" />
              </label>
            )}
            <label>Anotações <span className="muted">(horário, nome de quem atendeu, seção, o que combinar)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Só o que a equipe disse. Nada sobre os moradores." />
            </label>
            <div className="row between">
              <button className="link danger" onClick={release}>Não vou ligar, liberar a casa</button>
              <button className="primary" disabled={!outcome[0] || busy} onClick={save}>{busy ? "Um momento…" : "Salvar o que aconteceu"}</button>
            </div>
          </section>
        </>
      )}

      {home.notes && (
        <section className="card read">
          <p className="eyebrow">Anotações de quem já ligou</p>
          <pre className="notes">{home.notes}</pre>
        </section>
      )}

      <section className="card">
        <h2>Vizinhos para domingo</h2>
        {helpers.length === 0 ? (
          <p className="muted">Ninguém ainda. {home.status === "interessados" ? "Essa casa tem moradores que precisam de companhia: " : ""}<Link to={`${BASE}/ajudar?home=${home.id}`}>Quero acompanhar daqui</Link>.</p>
        ) : (
          <ul className="plain">
            {helpers.map((h, i) => <li key={i}><strong>{h.name}</strong>{h.neighbourhood ? ` (${h.neighbourhood})` : ""}: {h.contact}</li>)}
          </ul>
        )}
        {helpers.length > 0 && <p className="small"><Link to={`${BASE}/ajudar?home=${home.id}`}>Também quero ajudar</Link></p>}
      </section>

      {history.length > 0 && (
        <section className="card small">
          <p className="eyebrow">Histórico</p>
          <ul className="plain">
            {history.map((h, i) => <li key={i}>{h.volunteer_name}: {h.outcome ? (OUTCOME_LABEL[h.outcome] ?? h.outcome) : "ligando"} · {ago(h.released_at ?? h.claimed_at)}</li>)}
          </ul>
        </section>
      )}
      <p className="muted small"><Link to={`${BASE}/domingo`}>O que fazer no domingo</Link>. {vol ? `Você: ${vol.name}.` : ""}</p>
    </LaresLayout>
  );
}
