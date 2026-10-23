import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SessionProvider, useSession } from "./session";
import { Entrar } from "./pages/Entrar";
import { Pessoas } from "./pages/Pessoas";
import { NovaPessoa } from "./pages/NovaPessoa";
import { Pessoa } from "./pages/Pessoa";
import { ComoFunciona } from "./pages/ComoFunciona";
import { Perfil, Perfis } from "./pages/Perfis";
import { Termos } from "./pages/Termos";
import { Privacidade } from "./pages/Privacidade";
import { Admin } from "./pages/Admin";
import { Rua } from "./pages/Rua";
import { Lares } from "./lares/Lares";
import { Lar } from "./lares/Lar";
import { Painel } from "./lares/Painel";
import { Ajudar } from "./lares/Ajudar";
import "./styles.css";

/** Waits for the (anonymous or e-mail) session to exist. Nothing is gated behind an account. */
function RequireSession({ children }: { children: React.ReactNode }) {
  const { token } = useSession();
  return token ? children : <p className="muted" style={{ padding: 24 }}>Um momento…</p>;
}

/** Every page change glides back to the top (or to the #anchor it points at). */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const behavior: ScrollBehavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView({ behavior, block: "start" });
    else window.scrollTo({ top: 0, behavior });
  }, [pathname, hash]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/como-funciona" element={<ComoFunciona />} />
          <Route path="/perfis" element={<Perfis />} />
          <Route path="/perfis/:id" element={<Perfil />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/rua" element={<Rua />} />
          <Route path="/casas-de-repouso" element={<Lares />} />
          <Route path="/casas-de-repouso/painel" element={<Painel />} />
          <Route path="/casas-de-repouso/ajudar" element={<Ajudar />} />
          <Route path="/casas-de-repouso/:id" element={<Lar />} />
          <Route path="/" element={<RequireSession><Pessoas /></RequireSession>} />
          <Route path="/nova" element={<RequireSession><NovaPessoa /></RequireSession>} />
          <Route path="/pessoa/:id" element={<RequireSession><Pessoa /></RequireSession>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
);
