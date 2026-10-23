import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { LarDetail } from "@boranois/shared";
import { BASE, LaresLayout, laresApi, lookupCep } from "./shared";

/** A neighbour offers to accompany residents on Sunday, near a given home or just near their CEP. */
export function Ajudar() {
  const [params] = useSearchParams();
  const homeId = params.get("home") ?? "";
  const [home, setHome] = useState<LarDetail["home"] | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [cep, setCep] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (homeId) laresApi<LarDetail>(`/${homeId}`).then((d) => setHome(d.home)).catch(() => {}); }, [homeId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const info = cep ? await lookupCep(cep) : null;
    try {
      await laresApi("/helpers", { body: { name: name.trim(), contact: contact.trim(), cep: info?.cep, neighbourhood: info?.neighbourhood, city: info?.city, state: info?.state, homeId: homeId || undefined } });
      setDone(true);
    } catch { setError("Não deu certo agora. Tente de novo."); }
    finally { setBusy(false); }
  };

  return (
    <LaresLayout narrow>
      <h1>Acompanhar no domingo</h1>
      <p className="lead">
        Quem mora perto de uma casa de repouso pode acompanhar moradores até a seção, a pé ou de transporte público. Sem carro, sem partido, sem conversa de voto: companhia.
      </p>
      {home && <p className="card law">Você está se oferecendo para <strong>{home.name}</strong>, {home.neighbourhood ? `${home.neighbourhood}, ` : ""}{home.city}/{home.state}.</p>}
      {done ? (
        <section className="card">
          <h2>Obrigado!</h2>
          <p>Quem estiver organizando {home ? "essa casa" : "as casas perto de você"} vai ver seu contato e combinar horário e ponto de encontro.</p>
          <p><Link to={BASE}>← Voltar para as casas</Link></p>
        </section>
      ) : (
        <form className="card" onSubmit={submit}>
          <label>Seu nome<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label>
          <label>WhatsApp ou e-mail<input value={contact} onChange={(e) => setContact(e.target.value)} required placeholder="(11) 99999-0000" /></label>
          <label>Seu CEP <span className="muted">(para saber o que é perto)</span><input value={cep} onChange={(e) => setCep(e.target.value)} inputMode="numeric" placeholder="01310-100" maxLength={9} /></label>
          {error && <p className="error small">{error}</p>}
          <p className="muted small">Seu contato é mostrado só aos voluntários organizando {home ? "essa casa" : "as casas da sua região"}, só para esta eleição, e apagado depois do dia 25.</p>
          <div className="row end"><button className="primary" disabled={busy}>{busy ? "Um momento…" : "Quero ajudar"}</button></div>
        </form>
      )}
    </LaresLayout>
  );
}
