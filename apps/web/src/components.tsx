import { useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import type { Priority } from "@boranois/shared";
import { useSession } from "./session";

export function Layout({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  const { token, signOut } = useSession();
  return (
    <div className={`page ${narrow ? "narrow" : ""}`}>
      <header className="topbar">
        <Link to="/" className="brand">Boranois</Link>
        <nav>
          {token && <NavLink to="/">Pessoas</NavLink>}
          <NavLink to="/como-funciona">Como funciona</NavLink>
          {token && <button className="link" onClick={signOut}>Sair</button>}
        </nav>
      </header>
      <main>{children}</main>
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
