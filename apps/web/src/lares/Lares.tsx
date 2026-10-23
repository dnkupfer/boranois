import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Lar, LarStatus } from "@boranois/shared";
import { BASE, type CepInfo, fmtKm, fmtPhone, LaresLayout, laresApi, lookupCep, savedCep, STATUS_LABEL, statusLabel, UFS, volunteer, VolunteerForm } from "./shared";

const ELECTION = "2026-10-25";
const todayBR = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export function Lares() {
  const navigate = useNavigate();
  const [cep, setCep] = useState<CepInfo | null>(savedCep.get);
  const [cepDraft, setCepDraft] = useState("");
  const [cepError, setCepError] = useState<string | null>(null);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState<{ city: string; n: number }[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [withPhone, setWithPhone] = useState(true);
  const [homes, setHomes] = useState<Lar[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<Lar | null>(null);
  const isSunday = todayBR() >= ELECTION;

  const load = useCallback(async () => {
    if (!cep && !state) return setHomes(null);
    setError(null); setLoading(true);
    const p = new URLSearchParams();
    if (cep) { p.set("cep", cep.cep); p.set("cepCity", cep.city); p.set("cepState", cep.state); if (cep.lat != null && cep.lng != null) { p.set("lat", String(cep.lat)); p.set("lng", String(cep.lng)); } }
    if (state) p.set("state", state);
    if (city) p.set("city", city);
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    if (withPhone) p.set("phone", "1");
    p.set("limit", "80");
    // The API restarts now and then; try three times before showing an error.
    let last: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { setHomes((await laresApi<{ homes: Lar[] }>(`?${p}`)).homes); setLoading(false); return; }
      catch (err) { last = err; await new Promise((r) => setTimeout(r, 700 * (attempt + 1))); }
    }
    const e = last as { status?: number; message?: string } | null;
    setHomes([]); setLoading(false);
    setError(`Não deu para carregar a lista (${e?.status ? `erro ${e.status}` : "sem resposta do servidor"}${e?.message && e.message !== "unknown" ? `: ${e.message}` : ""}). Tente de novo em instantes.`);
  }, [cep, state, city, status, q, withPhone]);

  useEffect(() => { load(); }, [load]);
  // A CEP saved before coordinates existed: look it up again so the list can be ranked by distance.
  useEffect(() => {
    if (cep && cep.lat == null) lookupCep(cep.cep).then((info) => { if (info?.lat != null) { savedCep.set(info); setCep(info); } });
  }, [cep]);
  useEffect(() => {
    setCity("");
    if (!state) return setCities([]);
    laresApi<{ cities: { city: string; n: number }[] }>(`/cities?state=${state}`).then((r) => setCities(r.cities)).catch(() => setCities([]));
  }, [state]);

  const useCep = async (e: React.FormEvent) => {
    e.preventDefault();
    setCepError(null); setCepBusy(true);
    const info = await lookupCep(cepDraft);
    setCepBusy(false);
    if (!info) return setCepError("CEP não encontrado. Confira os 8 números.");
    savedCep.set(info); setCep(info); setState(""); setCity("");
  };

  const claim = async (h: Lar) => {
    const v = volunteer.get();
    if (!v) return setClaiming(h);
    try {
      await laresApi(`/${h.id}/claim`, { body: v });
      navigate(`${BASE}/${h.id}`);
    } catch (err) {
      const e = err as { status?: number; by?: string };
      setError(e.status === 409 ? `${e.by ?? "Alguém"} já está ligando para essa casa.` : "Não deu certo agora. Tente de novo.");
      load();
    }
  };

  return (
    <LaresLayout>
      <header className="hero lares-hero">
        <p className="eyebrow">Sábado: ligar · Domingo: acompanhar</p>
        <h1>Ligue para uma casa de repouso. <mark>Domingo, acompanhe quem quer votar.</mark></h1>
        <p className="sub">
          Muita gente com mais de 70 anos quer votar e não tem com quem ir. Vizinhos ligam no sábado, combinam, e no domingo acompanham a pé ou de transporte público.
        </p>
      </header>

      <section className="card law rules3">
        <h2>Três regras, e são lei</h2>
        <div className="rule3">
          <span className="tag peach">Sem carro</span>
          <div>
            <p>Acompanhe a pé, de transporte público (grátis acima de 65), na van da própria casa, ou em táxi pago pela própria pessoa. <strong>Nunca no seu carro.</strong></p>
            <p className="muted small">No dia da eleição, só a Justiça Eleitoral pode transportar eleitor (Lei 6.091/74, art. 11). É crime mesmo com boa intenção, e a casa responde junto.</p>
          </div>
        </div>
        <div className="rule3">
          <span className="tag butter">Sem voto no domingo</span>
          <div>
            <p>Até sábado às 22h você pode dizer em quem vota e conversar sobre a eleição. <strong>No domingo, não:</strong> você é companhia, só isso.</p>
            <p className="muted small">A propaganda acaba sábado às 22h (Código Eleitoral, art. 240). No dia da eleição só vale manifestação individual e silenciosa (Lei 9.504, art. 39-A).</p>
          </div>
        </div>
        <div className="rule3">
          <span className="tag mint">Só quem pedir</span>
          <div>
            <p>A ajuda é para quem quer votar, em quem for. Acima de 70 anos o voto é facultativo. <strong>Nunca condicione a ajuda ao voto, nunca insista.</strong></p>
            <p className="muted small">Condicionar é corrupção eleitoral (Código Eleitoral, art. 299); pressionar quem depende de você é coação (art. 301).</p>
          </div>
        </div>
        <p className="small rules3-link"><Link to={`${BASE}/domingo`}>O que fazer no domingo, passo a passo</Link></p>
      </section>

      <section className="rules lares-rules">
        <h2>O que você vai fazer</h2>
        <ol>
          <li><b>1</b><span>Escolha uma casa na lista abaixo e aperte <strong>“Vou ligar para esta”</strong>. A casa fica marcada como sua: assim outra pessoa não liga para a mesma.</span></li>
          <li><b>2</b><span>Ligue pelo número que aparece. Tem um roteiro pronto do que dizer.</span></li>
          <li><b>3</b><span>Depois da ligação, marque o que aconteceu: não atenderam, não têm interesse, a casa leva na van, ou têm moradores que precisam de companhia.</span></li>
          <li><b>4</b><span>Se houver moradores interessados, um vizinho combina de acompanhar no domingo. Quem mora perto se oferece <Link to={`${BASE}/ajudar`}>aqui</Link>.</span></li>
        </ol>
      </section>

      {isSunday && <p className="card law stop"><strong>Hoje é domingo:</strong> dia de acompanhar, não de ligar. <Link to={`${BASE}/domingo`}>O guia do domingo</Link>.</p>}

      <section className="finder">
        <form className="cep-form" onSubmit={useCep}>
          <label>Seu CEP, para ver as casas mais perto
            <div className="row">
              <input value={cepDraft} onChange={(e) => setCepDraft(e.target.value)} inputMode="numeric" placeholder="01310-100" maxLength={9} />
              <button className="primary" type="submit" disabled={cepBusy || loading}>{cepBusy ? <><span className="spinner" /> Procurando…</> : loading ? <><span className="spinner" /> Carregando…</> : "Ver perto de mim"}</button>
            </div>
          </label>
          {cepError && <p className="error small">{cepError}</p>}
          {cep && <p className="small">Perto de <strong>{cep.neighbourhood ? `${cep.neighbourhood}, ` : ""}{cep.city}/{cep.state}</strong> · <button type="button" className="link" onClick={() => { savedCep.set(null); setCep(null); }}>trocar</button></p>}
        </form>
        <div className="filters">
          <select value={state} onChange={(e) => { setState(e.target.value); if (e.target.value) { savedCep.set(null); setCep(null); } }} aria-label="Estado">
            <option value="">{cep ? "Outro estado…" : "Ou escolha um estado"}</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          {cities.length > 0 && (
            <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Cidade">
              <option value="">Todas as cidades</option>
              {cities.slice(0, 300).map((c) => <option key={c.city} value={c.city}>{c.city} ({c.n})</option>)}
            </select>
          )}
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação">
            <option value="">Qualquer situação</option>
            {(Object.keys(STATUS_LABEL) as LarStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar" />
          <label className="check"><input type="checkbox" checked={withPhone} onChange={(e) => setWithPhone(e.target.checked)} /> só com telefone</label>
        </div>
      </section>

      {claiming && (
        <VolunteerForm onDone={() => { const h = claiming; setClaiming(null); claim(h); }} />
      )}
      {error && <p className="error">{error}</p>}

      {!cep && !state ? (
        <p className="muted">Digite seu CEP ou escolha um estado para ver as casas. São {`12 mil`} em todo o Brasil, {`9 mil`} com telefone.</p>
      ) : homes === null || (loading && homes.length === 0) ? (
        <ul className="homes" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <li key={i} className="home-row skeleton"><div className="home-main"><div className="sk sk-name" /><div className="sk sk-where" /><div className="sk sk-meta" /></div><div className="sk sk-btn" /></li>)}
        </ul>
      ) : homes.length === 0 ? (
        <p className="muted">Nenhuma casa com esses filtros.</p>
      ) : (
        <>
        <h2 className="list-title">Casas {cep ? `perto de ${cep.neighbourhood ?? cep.city}` : city ? `em ${city}` : state ? `em ${state}` : ""}</h2>
        <p className="muted small">{cep?.lat != null ? "Da mais perto para a mais longe. " : ""}Escolha uma e aperte o botão. Cinza = ninguém ligou ainda. Amarela = alguém está ligando agora.</p>
        <ul className={`homes ${loading ? "dim" : ""}`}>
          {homes.map((h) => (
            <li key={h.id} className={`home-row ${h.status}`}>
              <div className="home-main">
                <Link to={`${BASE}/${h.id}`} className="home-name">{h.name}</Link>
                <div className="home-where">
                  {fmtKm(h.distance_km) && <strong className="home-km">a {fmtKm(h.distance_km)}</strong>}
                  {[h.neighbourhood, `${h.city}/${h.state}`].filter(Boolean).join(" · ")}
                </div>
                <div className="home-meta">
                  <a href={h.phone ? `tel:+55${h.phone}` : undefined} className="home-phone">{fmtPhone(h.phone)}</a>
                  <span className={`badge st-${h.status}`}>{statusLabel(h)}</span>
                  {h.interested_count ? <span className="muted small">{h.interested_count} interessado{h.interested_count > 1 ? "s" : ""}</span> : null}
                </div>
              </div>
              {h.status !== "ligando" && h.phone && !isSunday && (
                <button type="button" className={h.status === "livre" ? "primary" : "secondary"} onClick={() => claim(h)}>
                  {h.status === "livre" ? "Vou ligar para esta" : "Vou ligar de novo"}
                </button>
              )}
              {h.status === "ligando" && <span className="muted small">{h.calling_by ?? "alguém"} está ligando</span>}
            </li>
          ))}
        </ul>
        </>
      )}
    </LaresLayout>
  );
}
