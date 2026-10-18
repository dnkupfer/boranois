import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import type { MagicLinkResponse, MeResponse, VerifyResponse } from "@boranois/shared";
import { api } from "../api";
import { Layout } from "../components";
import { useSession } from "../session";

type Phase = "email" | "sent" | "verifying" | "name" | "invalid";

export function Entrar() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { token, member, signIn, setMember } = useSession();
  const anonToken = token && !member?.email ? token : undefined;
  const t = params.get("t");
  const [phase, setPhase] = useState<Phase>(t ? "verifying" : "email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!t) return;
    api<VerifyResponse>("/auth/verify", { body: { t, anonToken } })
      .then((r) => {
        signIn(r.token, r.member);
        if (r.member.name) navigate("/", { replace: true });
        else setPhase("name");
      })
      .catch(() => setPhase("invalid"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  if (member?.email && phase === "email") return <Navigate to="/" replace />;

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<MagicLinkResponse>("/auth/link", { body: { email } });
      setDevLink(r.devLink ?? null);
      setPhase("sent");
    } finally {
      setBusy(false);
    }
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api<MeResponse>("/me", { method: "PUT", body: { name } });
    setMember(r.member);
    navigate("/", { replace: true });
  };

  return (
    <Layout narrow>
      {phase === "email" && (
        <>
          <h1>Entrar com e-mail</h1>
          <p>
            Você não precisa de conta para usar o Boranois: tudo já funciona neste aparelho. Entre com e-mail só se quiser{" "}
            <strong>continuar de outro aparelho</strong>. Suas pessoas vêm junto.
          </p>
          <form onSubmit={sendLink} className="card">
            <label>
              Seu e-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <button className="primary" disabled={busy}>{busy ? "Enviando…" : "Receber link de acesso"}</button>
            <p className="muted small">Sem senha. Você recebe um link por e-mail e entra com um toque.</p>
          </form>
          <p className="muted small">
            Nomes, telefones e anotações ficam sempre só no aparelho onde você os escreveu, com ou sem e-mail.{" "}
            <Link to="/">Voltar</Link>
          </p>
        </>
      )}

      {phase === "sent" && (
        <div className="card">
          <h1>Olha seu e-mail</h1>
          <p>Mandamos um link para <strong>{email}</strong>. Abra no celular, de preferência: é lá que ficam as conversas.</p>
          {devLink && (
            <p>
              <a className="button primary" href={devLink}>Abrir o link (modo de teste)</a>
            </p>
          )}
        </div>
      )}

      {phase === "verifying" && <p className="muted">Entrando…</p>}

      {phase === "invalid" && (
        <div className="card">
          <h1>Esse link não vale mais</h1>
          <p>Links duram 30 minutos e só funcionam uma vez.</p>
          <button className="primary" onClick={() => setPhase("email")}>Pedir outro</button>
        </div>
      )}

      {phase === "name" && (
        <form onSubmit={saveName} className="card">
          <h1>Como você quer ser chamado(a)?</h1>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required autoFocus />
          <button className="primary">Continuar</button>
        </form>
      )}
    </Layout>
  );
}
