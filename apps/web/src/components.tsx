import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "./session";

export function Layout({ children }: { children: React.ReactNode }) {
  const { me, signOut } = useSession();
  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="brand">Boranois</Link>
        {me && (
          <nav>
            <Link to="/extensao">Extensão</Link>
            <button className="link" onClick={signOut}>Sair</button>
          </nav>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}

export function CopyButton({ text, label, className = "secondary" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
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
