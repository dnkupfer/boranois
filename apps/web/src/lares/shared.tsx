import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { Lar, LarStatus } from "@boranois/shared";
import { track } from "../analytics";

// Casas de repouso: its own small world inside the app. Same look, different audience and nav.

export const BASE = "/casas-de-repouso";

/** The volunteer, on this device only. Asked once, on the first "estou ligando". */
export type Volunteer = { name: string; email: string };
const VOL_KEY = "boranois.lares.voluntario";
const CEP_KEY = "boranois.lares.cep";
export const volunteer = {
  get: (): Volunteer | null => { try { const r = localStorage.getItem(VOL_KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
  set: (v: Volunteer) => { try { localStorage.setItem(VOL_KEY, JSON.stringify(v)); } catch {} },
};
export type CepInfo = { cep: string; city: string; state: string; neighbourhood?: string; lat?: number; lng?: number };
export const savedCep = {
  get: (): CepInfo | null => { try { const r = localStorage.getItem(CEP_KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
  set: (c: CepInfo | null) => { try { c ? localStorage.setItem(CEP_KEY, JSON.stringify(c)) : localStorage.removeItem(CEP_KEY); } catch {} },
};

/** City, state, bairro and coordinates for a CEP, through our API (which caches and falls back to the public services). */
export async function lookupCep(raw: string): Promise<CepInfo | null> {
  const cep = raw.replace(/\D/g, "");
  if (cep.length !== 8) return null;
  try {
    const r = await fetch(`/api/lares/cep/${cep}`);
    if (!r.ok) return null;
    const d = await r.json();
    return { cep, city: d.city, state: d.state, neighbourhood: d.neighbourhood ?? undefined, lat: d.lat ?? undefined, lng: d.lng ?? undefined };
  } catch { return null; }
}

export async function laresApi<T>(path: string, init: { method?: string; body?: unknown; email?: string } = {}): Promise<T> {
  const res = await fetch(`/api/lares${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...(init.email ? { "x-volunteer-email": init.email } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "unknown"), { status: res.status, by: data.by });
  return data as T;
}

export const STATUS_LABEL: Record<LarStatus, string> = {
  livre: "Ninguém ligou ainda", ligando: "Alguém está ligando", telefone_errado: "Telefone errado", sem_interesse: "Sem interesse",
  interessados: "Têm interessados", ajudantes: "Ajuda combinada",
};
export function statusLabel(h: Lar) {
  if (h.status === "livre" && h.last_outcome === "nao_atendeu") return `Não atendeu (${h.tries}×)`;
  return STATUS_LABEL[h.status];
}
export const KIND_LABEL = { publico: "Pública", filantropico: "Filantrópica", privado: "Privada" } as const;
export const fmtPhone = (p: string | null) => (p ? p.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") : "sem telefone");
export const fmtCep = (c: string | null) => (c ? c.replace(/^(\d{5})(\d{3})$/, "$1-$2") : "");
export const fmtKm = (d: number | null | undefined) => (d == null ? null : d < 1 ? `${Math.round(d * 1000)} m` : d < 10 ? `${d.toFixed(1).replace(".", ",")} km` : `${Math.round(d)} km`);

export const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export const SCRIPT = [
  "Olá, meu nome é ___. Sou voluntário(a) de um grupo de vizinhos, sem ligação com partido ou campanha.",
  "Queremos saber se há moradores que gostariam de votar no domingo e precisam de companhia para chegar ao local de votação, a pé ou de transporte público.",
  "Podemos ajudar? Quantos moradores? Que horas seria melhor? Vocês sabem qual é o local de votação deles?",
  "Se for não: “Sem problema, obrigado(a) pelo tempo.” E a próxima casa.",
];

export function LaresLayout({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  const location = useLocation();
  useEffect(() => { track("page_view"); }, [location.pathname]);
  return (
    <div className={narrow ? "page narrow" : "page"}>
      <div className="blob b1" aria-hidden /><div className="blob b2" aria-hidden /><div className="blob b3" aria-hidden />
      <header className="topbar">
        <Link to={BASE} className="brand">Casas de repouso <span className="brand-sub">· Boranois</span></Link>
        <nav>
          <NavLink to={BASE} end>Casas</NavLink>
          <NavLink to={`${BASE}/painel`}>Painel</NavLink>
          <NavLink to={`${BASE}/ajudar`}>Ajudar no domingo</NavLink>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <span>Sem partido, sem candidato, sem carro. Só vizinhos. <Link to="/">O Boranois</Link> · <Link to="/privacidade">Privacidade</Link></span>
      </footer>
    </div>
  );
}

/** Name + e-mail, once. */
export function VolunteerForm({ onDone, title = "Antes de ligar, quem é você?" }: { onDone: (v: Volunteer) => void; title?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); const v = { name: name.trim(), email: email.trim().toLowerCase() }; if (!v.name || !v.email.includes("@")) return; volunteer.set(v); onDone(v); }}>
      <h2>{title}</h2>
      <p>Só uma vez. É para a casa ficar marcada com o seu nome e ninguém mais ligar para ela. Seu e-mail não aparece para ninguém.</p>
      <label>Seu nome<input value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="name" required /></label>
      <label>Seu e-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
      <div className="row end"><button className="primary">Continuar</button></div>
    </form>
  );
}
