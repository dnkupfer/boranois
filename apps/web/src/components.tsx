import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import type { Priority } from "@boranois/shared";
import { useSession } from "./session";

export function Layout({ children }: { children: React.ReactNode }) {
  const { me, signOut } = useSession();
  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="brand">Boranois</Link>
        <nav>
          {me && <NavLink to="/">Pessoas</NavLink>}
          <NavLink to="/perfis">Perfis</NavLink>
          {me?.member.role === "host" && <NavLink to="/convites">Convites</NavLink>}
          {me && <button className="link" onClick={signOut}>Sair</button>}
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

const PRIORITY_LABEL: Record<Priority, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

export function PriorityBadge({ level, engage }: { level: Priority; engage: boolean }) {
  if (!engage) return <span className="badge stop">Não engajar</span>;
  return <span className={`badge ${level}`}>{PRIORITY_LABEL[level]}</span>;
}

/** A row of tappable chips. Single or multi select. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  max,
}: {
  options: readonly { id: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
  max?: number;
}) {
  const toggle = (id: T) => {
    if (value.includes(id)) return onChange(value.filter((v) => v !== id));
    if (max === 1) return onChange([id]);
    if (max && value.length >= max) return;
    onChange([...value, id]);
  };
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o.id} className={`chip ${value.includes(o.id) ? "on" : ""}`} onClick={() => toggle(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
