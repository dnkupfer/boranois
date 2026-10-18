import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { Priority } from "@boranois/shared";
import { getConsent, setConsent, track } from "./analytics";
import { useSession } from "./session";

/** Feedback goes straight to the maintainer's WhatsApp, with a prefilled opener. */
const FEEDBACK_WHATSAPP = `https://wa.me/447866750132?text=${encodeURIComponent("Oi! Sobre o Boranois: ")}`;

export function Layout({ children }: { children: React.ReactNode; narrow?: boolean }) {
  const { token, member, emailAvailable, signOut } = useSession();
  const location = useLocation();
  useEffect(() => {
    track("page_view");
  }, [location.pathname]);
  return (
    <div className="page">
      <ConsentBanner />
      <header className="topbar">
        <Link to="/" className="brand">Boranois</Link>
        <nav>
          {token && <NavLink to="/">Pessoas</NavLink>}
          <NavLink to="/como-funciona">Como funciona</NavLink>
          {member?.email ? <button className="link" onClick={signOut}>Sair</button> : emailAvailable ? <NavLink to="/entrar">Entrar com e-mail</NavLink> : null}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <p className="feedback">
          Sugestões, dúvidas ou problemas: fale com{" "}
          <a href={FEEDBACK_WHATSAPP} target="_blank" rel="noreferrer">Daniel</a>.
        </p>
        <Link to="/como-funciona">Como funciona</Link> · <Link to="/perfis">Perfis</Link> · <Link to="/termos">Termos de uso</Link> ·{" "}
        <Link to="/privacidade">Privacidade</Link>
      </footer>
    </div>
  );
}

/** Storage for the app itself needs no consent; measuring use does. Shown once. */
function ConsentBanner() {
  const [choice, setChoice] = useState(getConsent);
  if (choice) return null;
  const pick = (c: "all" | "necessary") => {
    setConsent(c);
    setChoice(c);
  };
  return (
    <div className="consent" role="dialog" aria-label="Privacidade">
      <p>
        O app guarda no seu aparelho o que precisa para funcionar (sua sessão e as pessoas que você adiciona). Para melhorar o
        app, gostaríamos também de medir o uso de forma anônima: nunca nomes, telefones ou mensagens.
      </p>
      <div className="row">
        <button className="primary" onClick={() => pick("all")}>Aceitar</button>
        <button className="secondary" onClick={() => pick("necessary")}>Só o necessário</button>
        <Link to="/privacidade" className="small">Saiba mais</Link>
      </div>
    </div>
  );
}

export function CopyButton({ text, label, className = "secondary" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}

const PRIORITY_LABEL: Record<Priority, string> = { alta: "Comece por aqui", media: "Vale a conversa", baixa: "Depois" };

export function PriorityBadge({ level, engage }: { level: Priority; engage: boolean }) {
  if (!engage) return <span className="badge stop">Melhor não</span>;
  return <span className={`badge ${level}`}>{PRIORITY_LABEL[level]}</span>;
}

/**
 * A row of tappable chips. Single or multi select. With `onCustomChange`, a "+ outra"
 * chip lets the person type one in; typed chips are selected and listed alongside.
 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  max,
  custom = [],
  onCustomChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
  max?: number;
  custom?: string[];
  onCustomChange?: (next: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const committing = useRef(false); // Enter and blur both fire; commit once.

  const toggle = (id: T) => {
    if (value.includes(id)) return onChange(value.filter((v) => v !== id));
    if (max === 1) return onChange([id]);
    if (max && value.length + custom.length >= max) return;
    onChange([...value, id]);
  };

  const addCustom = () => {
    if (committing.current) return;
    committing.current = true;
    const text = draft.trim();
    setDraft("");
    setAdding(false);
    setTimeout(() => (committing.current = false), 0);
    if (!text || !onCustomChange || custom.includes(text)) return;
    if (max === 1) onChange([]);
    onCustomChange([...custom, text]);
  };

  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o.id} className={`chip ${value.includes(o.id) ? "on" : ""}`} onClick={() => toggle(o.id)}>
          {o.label}
        </button>
      ))}
      {custom.map((c) => (
        <button type="button" key={`c:${c}`} className="chip on custom" onClick={() => onCustomChange?.(custom.filter((x) => x !== c))} title="Tirar">
          {c} ×
        </button>
      ))}
      {onCustomChange && !adding && (
        <button type="button" className="chip add" onClick={() => setAdding(true)}>+ outra</button>
      )}
      {onCustomChange && adding && (
        <form
          className="chip-form"
          onSubmit={(e) => {
            e.preventDefault();
            addCustom();
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreva com suas palavras" maxLength={60} autoFocus onBlur={addCustom} />
        </form>
      )}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" aria-hidden>
      <span style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}
