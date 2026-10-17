import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import type { JoinResponse } from "@boranois/shared";
import { api, ApiError } from "../api";
import { Layout } from "../components";
import { useSession } from "../session";

const ERRORS: Record<string, string> = {
  not_found: "Não encontramos esse código. Confira se digitou certinho.",
  used: "Esse código já foi usado. Peça um novo para quem te convidou.",
};

export function Entrar() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("codigo") ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { token, signIn } = useSession();
  const navigate = useNavigate();

  if (token) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<JoinResponse>("/join", { body: { code, name } });
      signIn(res.token);
      navigate("/");
    } catch (err) {
      setError((err instanceof ApiError && ERRORS[err.code]) || "Algo deu errado. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <h1>Bem-vindo(a)!</h1>
      <p>Você recebeu um convite para um grupinho de 5 amigos. Cada um conversa com as pessoas que conhece sobre votar no dia 25. O app ajuda a saber com quem falar e o que dizer.</p>
      <form onSubmit={submit} className="card">
        <label>
          Código do convite
          <input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" required />
        </label>
        <label>
          Seu nome
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </Layout>
  );
}
