import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chips, type ChipSets, type Contact, type Question, type QuestionsResponse } from "@boranois/shared";
import { api } from "../api";
import { ChipGroup, Layout, Progress } from "../components";
import { privateContacts, profile } from "../local";

type Answer = { optionIds: string[]; custom: string[] };
type Screen = "quem" | "pergunta" | "nota";

export function NovaPessoa() {
  const navigate = useNavigate();
  const [flow, setFlow] = useState<QuestionsResponse | null>(null);
  const [screen, setScreen] = useState<Screen>("quem");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [path, setPath] = useState<string[]>([]); // question ids asked so far, in order
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<QuestionsResponse>("/questions").then((f) => {
      setFlow(f);
      setPath([f.start]);
    });
  }, []);

  const byId = useMemo(() => new Map(flow?.questions.map((q) => [q.id, q]) ?? []), [flow]);
  const currentId = path[path.length - 1];
  const current = currentId ? byId.get(currentId) : undefined;
  const answer = (id: string): Answer => answers[id] ?? { optionIds: [], custom: [] };

  // Progress = answered / (answered + longest remaining path). Good enough for a tree this size.
  const longestFrom = (id: string | null, seen = new Set<string>()): number => {
    if (!id || seen.has(id)) return 0;
    const q = byId.get(id);
    if (!q) return 0;
    const nexts = q.next === null ? [] : typeof q.next === "string" ? [q.next] : [...new Set(Object.values(q.next))];
    return 1 + Math.max(0, ...nexts.map((n) => longestFrom(n, new Set([...seen, id]))));
  };
  const progress = screen === "quem" ? 0.05 : screen === "nota" ? 0.95 : (path.length + 1) / (path.length + 1 + longestFrom(currentId ?? null) + 1);

  const nextOf = (q: Question, a: Answer): string | null => {
    if (q.next === null) return null;
    if (typeof q.next === "string") return q.next;
    const first = a.optionIds[0];
    return (first && q.next[first]) || q.next["*"] || null;
  };

  const advance = (q: Question, a: Answer) => {
    const n = nextOf(q, a);
    if (n) setPath((p) => [...p, n]);
    else setScreen("nota");
  };

  const setAnswer = (q: Question, a: Answer, autoAdvance: boolean) => {
    setAnswers((prev) => ({ ...prev, [q.id]: a }));
    if (autoAdvance) setTimeout(() => advance(q, a), 160);
  };

  const back = () => {
    if (screen === "nota") return setScreen("pergunta");
    if (path.length > 1) return setPath((p) => p.slice(0, -1));
    setScreen("quem");
  };

  const submit = async () => {
    if (!flow) return;
    setBusy(true);
    setError(null);
    try {
      const merged: Required<Omit<ChipSets, "situation" | "relation" | "frequency" | "trustLoss">> & { tags: string[] } = {
        sayings: [], worries: [], groups: [], influencers: [], tags: [],
      };
      let situation: ChipSets["situation"], relation: ChipSets["relation"], frequency: ChipSets["frequency"], trustLoss: ChipSets["trustLoss"];
      const customAll: string[] = [];
      for (const qid of path) {
        const q = byId.get(qid)!;
        const a = answer(qid);
        customAll.push(...a.custom);
        for (const oid of a.optionIds) {
          const o = q.options.find((o) => o.id === oid);
          if (!o) continue;
          if (!o.sets) {
            if (oid !== "nao_sei") merged.tags.push(`${q.id}:${oid}`);
            continue;
          }
          situation = o.sets.situation ?? situation;
          relation = o.sets.relation ?? relation;
          frequency = o.sets.frequency ?? frequency;
          trustLoss = o.sets.trustLoss ?? trustLoss;
          for (const k of ["sayings", "worries", "groups", "influencers"] as const) for (const v of o.sets[k] ?? []) if (!merged[k].includes(v as never)) merged[k].push(v as never);
        }
      }
      const mine = profile.get().groups;
      const chips = Chips.parse({
        situation, relation, frequency, trustLoss,
        sayings: merged.sayings.slice(0, 3),
        worries: merged.worries.slice(0, 2),
        groups: merged.groups.slice(0, 3),
        influencers: merged.influencers.slice(0, 3),
        tags: merged.tags.slice(0, 12),
        sharedGroup: merged.groups.some((g) => mine.includes(g)),
      });
      const contact = await api<Contact>("/contacts", { body: { chips } });
      privateContacts.set(contact.id, { nickname: nickname.trim(), phone: phone.trim(), note: note.trim(), customChips: customAll });
      // Anonymous: which chips were used, which were typed in.
      api("/chips/usage", { body: { answers: path.map((qid) => ({ questionId: qid, ...answer(qid) })) } }).catch(() => {});
      navigate(`/pessoa/${contact.id}`, { replace: true });
    } catch {
      setError("Faltou alguma resposta. Volte e confira.");
      setBusy(false);
    }
  };

  const nome = nickname.trim() || "ela";

  return (
    <Layout narrow>
      <p><Link to="/">← Suas pessoas</Link></p>
      <Progress value={progress} />

      {screen === "quem" && (
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
          <div className="row end">
            <button className="primary" disabled={!nickname.trim() || !flow} onClick={() => setScreen("pergunta")}>Continuar</button>
          </div>
        </section>
      )}

      {screen === "pergunta" && current && (
        <QuestionCard
          key={current.id}
          q={current}
          nome={nome}
          answer={answer(current.id)}
          onAnswer={(a, auto) => setAnswer(current, a, auto)}
          onContinue={() => advance(current, answer(current.id))}
          onBack={back}
        />
      )}

      {screen === "nota" && (
        <section className="card">
          <h1>Mais alguma coisa sobre {nome}?</h1>
          <p className="muted small">Fica só no seu aparelho. Ajuda a escrever as mensagens do seu jeito.</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="ex.: o filho está desempregado; ela adora o neto; foi assaltada em março" autoFocus />
          {error && <p className="error">{error}</p>}
          <div className="row between">
            <button className="link" onClick={back}>← Voltar</button>
            <button className="primary" disabled={busy} onClick={submit}>{busy ? "Um momento…" : "Ver como conversar"}</button>
          </div>
        </section>
      )}
    </Layout>
  );
}

function QuestionCard({
  q, nome, answer, onAnswer, onContinue, onBack,
}: { q: Question; nome: string; answer: Answer; onAnswer: (a: Answer, autoAdvance: boolean) => void; onContinue: () => void; onBack: () => void }) {
  const single = q.max === 1;
  const answered = answer.optionIds.length + answer.custom.length > 0;
  return (
    <section className="card">
      <h1>{q.text.replaceAll("{nome}", nome)}</h1>
      {q.hint && <p className="muted small">{q.hint}</p>}
      {!single && <p className="muted small">Até {q.max}.</p>}
      <ChipGroup
        options={q.options}
        value={answer.optionIds}
        onChange={(ids) => onAnswer({ ...answer, optionIds: ids }, single && ids.length > 0)}
        max={q.max}
        custom={q.allowCustom ? answer.custom : undefined}
        onCustomChange={q.allowCustom ? (custom) => onAnswer({ ...answer, custom }, single && custom.length > 0) : undefined}
      />
      <div className="row between">
        <button className="link" onClick={onBack}>← Voltar</button>
        {(!single || q.optional) && (
          <button className={answered ? "primary" : "secondary"} onClick={onContinue}>{answered ? "Continuar" : q.optional ? "Pular" : "Continuar"}</button>
        )}
      </div>
    </section>
  );
}
