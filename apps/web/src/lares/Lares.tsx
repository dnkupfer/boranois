import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Lar, LarStatus } from "@boranois/shared";
import { BASE, type CepInfo, fmtPhone, LaresLayout, laresApi, lookupCep, savedCep, STATUS_LABEL, statusLabel, UFS, volunteer, VolunteerForm } from "./shared";

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
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<Lar | null>(null);
  const isSunday = todayBR() >= ELECTION;

  const load = useCallback(async () => {
    if (!cep && !state) return setHomes(null);
    setError(null);
    const p = new URLSearchParams();
    if (cep) { p.set("cep", cep.cep); p.set("cepCity", cep.city); p.set("cepState", cep.state); }
    if (state) p.set("state", state);
    if (city) p.set("city", city);
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    if (withPhone) p.set("phone", "1");
    p.set("limit", "80");
    try { setHomes((await laresApi<{ homes: Lar[] }>(`?${p}`)).homes); } catch { setError("Não deu para carregar a lista. Tente de novo."); }
  }, [cep, state, city, status, q, withPhone]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setCity("");
    if (!state) return setCities([]);
    laresApi<{ cities: { city: string; n: number }[] }>(`/cities?state=${state}`).then((r) => setCities(r.cities)).catch(() => setCities([]));
  }, [state]);

  const useCep = async (e: React.FormEvent) => {
    e.preventDefault();
    setCepError(null);
    const info = await lookupCep(cepDraft);
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

      <section className="card law">
        <h2>Três regras, e são lei</h2>
        <p>
          <strong>Sem carro.</strong> Transporte de eleitor só pela Justiça Eleitoral (Lei 6.091/74): acompanhe a pé ou de ônibus, metrô, trem.{" "}
          <strong>Sem partido.</strong> Nenhum candidato, nenhum material, nenhuma conversa sobre voto.{" "}
          <strong>Só quem pedir.</strong> Acima de 70 anos o voto é facultativo. Ajudamos quem quer ir.
        </p>
      </section>

      <section className="rules lares-rules">
        <h2>Como funciona</h2>
        <ol>
          <li><b>1</b><span>Escolha uma casa perto de você e marque <strong>“estou ligando”</strong>. Ninguém mais liga para ela enquanto isso.</span></li>
          <li><b>2</b><span>Use o roteiro, registre o que aconteceu: não atendeu, sem interesse, têm interessados.</span></li>
          <li><b>3</b><span>Se houver interessados, combine quem acompanha no domingo. Vizinhos se oferecem <Link to={`${BASE}/ajudar`}>aqui</Link>.</span></li>
        </ol>
      </section>

      {isSunday && <p className="card law stop"><strong>Hoje é domingo:</strong> dia de acompanhar, não de ligar. Nada de voto na conversa; só companhia até a seção.</p>}

      <section className="finder">
        <form className="cep-form" onSubmit={useCep}>
          <label>Seu CEP, para ver as casas mais perto
            <div className="row">
              <input value={cepDraft} onChange={(e) => setCepDraft(e.target.value)} inputMode="numeric" placeholder="01310-100" maxLength={9} />
              <button className="primary" type="submit">Ver perto de mim</button>
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
      ) : homes === null ? (
        <p className="muted">Carregando…</p>
      ) : homes.length === 0 ? (
        <p className="muted">Nenhuma casa com esses filtros.</p>
      ) : (
        <ul className="homes">
          {homes.map((h) => (
            <li key={h.id} className={`home-row ${h.status}`}>
              <div className="home-main">
                <Link to={`${BASE}/${h.id}`} className="home-name">{h.name}</Link>
                <div className="home-where">{[h.neighbourhood, `${h.city}/${h.state}`].filter(Boolean).join(" · ")}</div>
                <div className="home-meta">
                  <a href={h.phone ? `tel:+55${h.phone}` : undefined} className="home-phone">{fmtPhone(h.phone)}</a>
                  <span className={`badge st-${h.status}`}>{statusLabel(h)}</span>
                  {h.calling_by && h.status === "ligando" && <span className="muted small">{h.calling_by} está ligando</span>}
                  {h.interested_count ? <span className="muted small">{h.interested_count} interessado{h.interested_count > 1 ? "s" : ""}</span> : null}
                </div>
              </div>
              {h.status !== "ligando" && h.phone && !isSunday && (
                <button type="button" className={h.status === "livre" ? "primary" : "secondary"} onClick={() => claim(h)}>Estou ligando</button>
              )}
              {h.status === "ligando" && <span className="muted small">ocupada</span>}
            </li>
          ))}
        </ul>
      )}
    </LaresLayout>
  );
}
