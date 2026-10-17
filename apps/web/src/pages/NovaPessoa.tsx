import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FREQUENCIES,
  GROUPS,
  INFLUENCERS,
  RELATIONS,
  SAYINGS,
  SITUATIONS,
  TRUST_LOSS,
  WORRIES,
  type Contact,
  type FrequencyId,
  type GroupId,
  type InfluencerId,
  type RelationId,
  type SayingId,
  type SituationId,
  type TrustLossId,
  type WorryId,
} from "@boranois/shared";
import { api } from "../api";
import { ChipGroup, Layout, Steps } from "../components";
import { privateContacts, profile } from "../local";

export function NovaPessoa() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState<RelationId[]>([]);
  const [frequency, setFrequency] = useState<FrequencyId[]>([]);
  const [groups, setGroups] = useState<GroupId[]>([]);
  const [situation, setSituation] = useState<SituationId[]>([]);
  const [sayings, setSayings] = useState<SayingId[]>([]);
  const [trustLoss, setTrustLoss] = useState<TrustLossId[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerId[]>([]);
  const [worries, setWorries] = useState<WorryId[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step1ok = nickname.trim() && relation.length && frequency.length;
  const step2ok = situation.length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const mine = profile.get().groups;
      const chips = {
        situation: situation[0],
        relation: relation[0],
        groups,
        worries,
        sayings,
        influencers,
        trustLoss: trustLoss[0],
        frequency: frequency[0],
        sharedGroup: groups.some((g) => mine.includes(g)),
      };
      const contact = await api<Contact>("/contacts", { body: { chips } });
      privateContacts.set(contact.id, { nickname: nickname.trim(), phone: phone.trim(), note: note.trim() });
      navigate(`/pessoa/${contact.id}`, { replace: true });
    } catch {
      setError("Não deu certo. Tente de novo.");
      setBusy(false);
    }
  };

  return (
    <Layout narrow>
      <p><Link to="/">← Suas pessoas</Link></p>
      <Steps current={step} total={3} />

      {step === 1 && (
        <section className="card">
          <h1>Quem é?</h1>
          <p className="muted small">Nome e telefone ficam só no seu aparelho.</p>
          <label>
            Como você chama essa pessoa?
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="tia Lu, Zé do mercado…" autoFocus />
          </label>
          <label>
            WhatsApp (com DDD) <span className="muted">(opcional)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="11 99999-0000" />
          </label>
          <p className="label">Ela é…</p>
          <ChipGroup options={RELATIONS} value={relation} onChange={setRelation} max={1} />
          <p className="label">Vocês se falam…</p>
          <ChipGroup options={FREQUENCIES} value={frequency} onChange={setFrequency} max={1} />
          <p className="label">De que grupos ela faz parte? <span className="muted">(opcional)</span></p>
          <ChipGroup options={GROUPS} value={groups} onChange={setGroups} max={3} />
          <div className="row end">
            <button className="primary" disabled={!step1ok} onClick={() => setStep(2)}>Continuar</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card">
          <h1>O que ela pensa?</h1>
          <p className="label">No 1º turno, ela…</p>
          <ChipGroup options={SITUATIONS} value={situation} onChange={setSituation} max={1} />
          <p className="label">O que ela costuma dizer? <span className="muted">(até 3)</span></p>
          <ChipGroup options={SAYINGS} value={sayings} onChange={setSayings} max={3} />
          <p className="label">Quando ela parou de acreditar? <span className="muted">(se souber)</span></p>
          <ChipGroup options={TRUST_LOSS} value={trustLoss} onChange={setTrustLoss} max={1} />
          <p className="label">Quem ela segue ou escuta? <span className="muted">(até 3)</span></p>
          <ChipGroup options={INFLUENCERS} value={influencers} onChange={setInfluencers} max={3} />
          <div className="row between">
            <button className="link" onClick={() => setStep(1)}>← Voltar</button>
            <button className="primary" disabled={!step2ok} onClick={() => setStep(3)}>Continuar</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card">
          <h1>O que pesa pra ela?</h1>
          <p className="label">Maiores preocupações <span className="muted">(até 2)</span></p>
          <ChipGroup options={WORRIES} value={worries} onChange={setWorries} max={2} />
          <label>
            Alguma coisa que ajude a falar com ela? <span className="muted">(opcional, fica só no seu aparelho)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="ex.: o filho está desempregado; ela adora o neto; foi assaltada em março" />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row between">
            <button className="link" onClick={() => setStep(2)}>← Voltar</button>
            <button className="primary" disabled={busy} onClick={submit}>{busy ? "Um momento…" : "Ver como conversar"}</button>
          </div>
        </section>
      )}
    </Layout>
  );
}
