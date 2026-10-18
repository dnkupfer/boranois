import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider, useSession } from "./session";
import { Entrar } from "./pages/Entrar";
import { Pessoas } from "./pages/Pessoas";
import { NovaPessoa } from "./pages/NovaPessoa";
import { Pessoa } from "./pages/Pessoa";
import { ComoFunciona } from "./pages/ComoFunciona";
import { Perfis } from "./pages/Perfis";
import { Termos } from "./pages/Termos";
import { Privacidade } from "./pages/Privacidade";
import "./styles.css";

/** Waits for the (anonymous or e-mail) session to exist. Nothing is gated behind an account. */
function RequireSession({ children }: { children: React.ReactNode }) {
  const { token } = useSession();
  return token ? children : <p className="muted" style={{ padding: 24 }}>Um momento…</p>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/como-funciona" element={<ComoFunciona />} />
          <Route path="/perfis" element={<Perfis />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/" element={<RequireSession><Pessoas /></RequireSession>} />
          <Route path="/nova" element={<RequireSession><NovaPessoa /></RequireSession>} />
          <Route path="/pessoa/:id" element={<RequireSession><Pessoa /></RequireSession>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
);
