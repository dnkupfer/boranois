import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider, useSession } from "./session";
import { Entrar } from "./pages/Entrar";
import { Pessoas } from "./pages/Pessoas";
import { NovaPessoa } from "./pages/NovaPessoa";
import { Pessoa } from "./pages/Pessoa";
import { Perfis } from "./pages/Perfis";
import { Convites } from "./pages/Convites";
import "./styles.css";

function RequireSession({ children }: { children: React.ReactNode }) {
  const { token } = useSession();
  return token ? children : <Navigate to="/entrar" replace />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/perfis" element={<Perfis />} />
          <Route path="/" element={<RequireSession><Pessoas /></RequireSession>} />
          <Route path="/nova" element={<RequireSession><NovaPessoa /></RequireSession>} />
          <Route path="/pessoa/:id" element={<RequireSession><Pessoa /></RequireSession>} />
          <Route path="/convites" element={<RequireSession><Convites /></RequireSession>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
);
