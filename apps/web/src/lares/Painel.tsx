import { useEffect, useState } from "react";
import type { LaresStats, LarStatus } from "@boranois/shared";
import { LaresLayout, laresApi, STATUS_LABEL } from "./shared";

const ORDER: LarStatus[] = ["interessados", "ajudantes", "ligando", "livre", "sem_interesse", "telefone_errado"];

export function Painel() {
  const [s, setS] = useState<LaresStats | null>(null);
  useEffect(() => {
    const load = () => laresApi<LaresStats>("/stats").then(setS).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  if (!s) return <LaresLayout><p className="muted">Carregando…</p></LaresLayout>;
  const touched = s.total - (s.byStatus.livre ?? 0);
  return (
    <LaresLayout>
      <h1>Painel</h1>
      <p className="muted">Atualiza sozinho a cada 30 segundos.</p>
      <section className="stats">
        <div className="stat sky"><b>{s.total.toLocaleString("pt-BR")}</b><span>casas na lista</span></div>
        <div className="stat mint"><b>{s.callingNow}</b><span>ligando agora</span></div>
        <div className="stat peach"><b>{(s.byStatus.interessados ?? 0) + (s.byStatus.ajudantes ?? 0)}</b><span>casas com moradores interessados</span></div>
        <div className="stat butter"><b>{s.helpers}</b><span>vizinhos para domingo</span></div>
      </section>
      <div className="admin-grid">
        <section className="card">
          <h2>Por situação</h2>
          <ul className="bars">
            {ORDER.map((k) => {
              const n = s.byStatus[k] ?? 0;
              return <li key={k}><div className="bar-label"><span>{STATUS_LABEL[k]}</span><b>{n}</b></div><div className="bar"><span style={{ width: `${(100 * n) / Math.max(1, s.total)}%` }} /></div></li>;
            })}
          </ul>
          <p className="muted small">{touched} casas já receberam alguma ação.</p>
        </section>
        <section className="card">
          <h2>Por estado</h2>
          <table className="admin-table">
            <thead><tr><th>UF</th><th>Casas</th><th>Ligadas</th><th>Interessadas</th></tr></thead>
            <tbody>{s.byState.slice(0, 27).map((r) => <tr key={r.state}><td>{r.state}</td><td>{r.total}</td><td>{r.touched}</td><td>{r.interested}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </LaresLayout>
  );
}
