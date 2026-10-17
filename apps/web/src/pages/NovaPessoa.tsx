import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FREQUENCIES,
  GROUPS,
  RELATIONS,
  SAYINGS,
  SITUATIONS,
  WORRIES,
  type Contact,
  type FrequencyId,
  type GroupId,
  type RelationId,
  type SayingId,
  type SituationId,
  type WorryId,
} from "@boranois/shared";
import { api } from "../api";
import { ChipGroup, Layout } from "../components";
import { privateContacts, profile } from "../local";

export function NovaPessoa() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [situation, setSituation] = useState<SituationId[]>([]);
  const [relation, setRelation] = useState<RelationId[]>([]);
  const [groups, setGroups] = useState<GroupId[]>([]);
  const [worries, setWorries] = useState<WorryId[]>([]);
  const [sayings, setSayings] = useState<SayingId[]>([]);
  const [frequency, setFrequency] = useState<FrequencyId[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = nickname.trim() && situation.length && relation.length && frequency.length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
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
        frequency: frequency[0],
        sharedGroup: groups.some((g) => mine.includes(g)),
      };
      const contact = await api<Contact>("/contacts", { body: { chips } });
      privateContacts.set(contact.id, { nickname: nickname.trim(), phone: phone.trim(), note: note.trim() });
      navigate(`/pessoa/${contact.id}`);
    } catch {
      setError("Não deu certo. Tente de novo.");
      setBusy(false);
    }
  };

  return (
    <Layout>
      <h1>Uma pessoa que você conhece</h1>
      <p className="muted">O nome, o telefone e o que você escrever ficam só no seu aparelho.</p>
      <form onSubmit={submit} className="card">
        <label>
          Como você chama essa pessoa?
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="tia Lu, Zé do mercado…" required />
        </label>
        <label>
          WhatsApp dela (com DDD)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="11 99999-0000" />
        </label>

        <p className="label">Ela é…</p>
        <ChipGroup options={RELATIONS} value={relation} onChange={setRelation} max={1} />

        <p className="label">No 1º turno, ela…</p>
        <ChipGroup options={SITUATIONS} value={situation} onChange={setSituation} max={1} />

        <p className="label">O que ela costuma dizer? <span className="muted">(até 3)</span></p>
        <ChipGroup options={SAYINGS} value={sayings} onChange={setSayings} max={3} />

        <p className="label">O que mais preocupa ela? <span className="muted">(até 2)</span></p>
        <ChipGroup options={WORRIES} value={worries} onChange={setWorries} max={2} />

        <p className="label">De que grupos ela faz parte? <span className="muted">(opcional)</span></p>
        <ChipGroup options={GROUPS} value={groups} onChange={setGroups} max={3} />

        <p className="label">Vocês se falam…</p>
        <ChipGroup options={FREQUENCIES} value={frequency} onChange={setFrequency} max={1} />

        <label>
          Alguma coisa que ajude a falar com ela? <span className="muted">(opcional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="ex.: acha que não adianta porque o filho está desempregado" />
        </label>

        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={!ready || busy}>{busy ? "Um momento…" : "Ver como conversar"}</button>
      </form>
    </Layout>
  );
}
