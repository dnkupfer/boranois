import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import type { MagicLinkResponse, MeResponse, VerifyResponse } from "@boranois/shared";
import { api } from "../api";
import { Layout } from "../components";
import { useSession } from "../session";

type Phase = "email" | "sent" | "verifying" | "name" | "invalid";

export function Entrar() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { token, member, signIn, setMember } = useSession();
  const t = params.get("t");
  const [phase, setPhase] = useState<Phase>(t ? "verifying" : "email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!t) return;
    api<VerifyResponse>("/auth/verify", { body: { t } })
      .then((r) => {
        signIn(r.token, r.member);
        if (r.member.name) navigate("/", { replace: true });
        else setPhase("name");
      })
      .catch(() => setPhase("invalid"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  if (token && member?.name && phase !== "name") return <Navigate to="/" replace />;

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
          <h1>Uma ferramenta para influenciar eleitores</h1>
          <p>
            Faltam poucos dias para o 2º turno. Você conhece alguém que não votou, votou em branco ou está em dúvida. O Boranois
            te ajuda a saber com quem falar primeiro e como conversar, do seu jeito, para que essa pessoa vá votar e decida melhor.
          </p>
          <div className="card accent">
            <p><strong>Influenciar não é manipular.</strong></p>
            <p className="small">
              Influenciar é ajudar alguém a decidir <em>no interesse dela</em>: com o que é verdade, ouvindo, e respeitando a
              decisão final. Manipular é levar alguém a agir <em>contra o próprio interesse</em>: com mentira, medo ou pressão.
              O teste é simples: se ela soubesse exatamente o que você está fazendo e por quê, ela te agradeceria ou se
              sentiria usada?
            </p>
            <p className="small">
              Aqui só se faz o primeiro. Sem fatos inventados, sem pressão, sem mensagem que você não mandaria na frente dela.{" "}
              <a href="/como-funciona">Entenda o método</a>.
            </p>
          </div>
          <form onSubmit={sendLink} className="card">
            <label>
              Seu e-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <button className="primary" disabled={busy}>{busy ? "Enviando…" : "Receber link de acesso"}</button>
            <p className="muted small">Sem senha. Você recebe um link por e-mail e entra com um toque.</p>
          </form>
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
