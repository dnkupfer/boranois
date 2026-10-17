import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chips, type ChipSets, type Contact, type Interpretation, type Question, type QuestionsResponse } from "@boranois/shared";
import { api } from "../api";
import { ChipGroup, Layout, Progress } from "../components";
import { privateContacts, profile } from "../local";
import { useSession } from "../session";

type Answer = { optionIds: string[]; custom: string[]; interpreted?: Interpretation | null };
type Screen = "quem" | "pergunta" | "nota";

export function NovaPessoa() {
  const navigate = useNavigate();
  const { aiAvailable } = useSession();
  const [flow, setFlow] = useState<QuestionsResponse | null>(null);
  /** Follow-up questions the model inserted for this person. Live here only. */
  const [extra, setExtra] = useState<Record<string, Question>>({});
  const [screen, setScreen] = useState<Screen>("quem");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [path, setPath] = useState<string[]>([]); // question ids asked so far, in order
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<QuestionsResponse>("/questions").then((f) => {
      setFlow(f);
      setPath([f.start]);
    });
  }, []);

  const byId = useMemo(() => {
    const m = new Map(flow?.questions.map((q) => [q.id, q]) ?? []);
    for (const q of Object.values(extra)) m.set(q.id, q);
    return m;
  }, [flow, extra]);
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
    if (a.interpreted?.nextQuestionId) return a.interpreted.nextQuestionId;
    if (q.next === null) return null;
    if (typeof q.next === "string") return q.next;
    const first = a.optionIds[0] ?? a.interpreted?.optionId ?? undefined;
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

  /** A typed answer: ask the model where it fits. Without AI it's kept as a tag and the tree's default applies. */
  const onCustom = async (q: Question, custom: string[]) => {
    const a = answer(q.id);
    const added = custom.find((c) => !a.custom.includes(c));
    if (!added) return setAnswer(q, { ...a, custom }, false);
    setBlocked(null);
    let interpreted: Interpretation | null = null;
    if (aiAvailable) {
      setThinking(true);
      try {
        interpreted = await api<Interpretation>("/chips/interpret", { body: { questionId: q.id.startsWith("ai_") ? q.id.slice(3).split("_")[0] : q.id, text: added } });
      } catch {
        interpreted = null;
      } finally {
        setThinking(false);
      }
    }
    if (interpreted?.blocked) {
      setBlocked(interpreted.blocked);
      return;
    }
    const next: Answer = { optionIds: q.max === 1 ? [] : a.optionIds, custom, interpreted };
    if (interpreted?.followup) {
      const id = `ai_${q.id}_${path.length}`;
      const fq: Question = { id, text: interpreted.followup.text, options: interpreted.followup.options, max: 1, optional: true, allowCustom: false, next: nextOf(q, { ...next, interpreted: { ...interpreted, nextQuestionId: null } }) };
      setExtra((e) => ({ ...e, [id]: fq }));
      setAnswers((prev) => ({ ...prev, [q.id]: next }));
      setTimeout(() => setPath((p) => [...p, id]), 160);
      return;
    }
    setAnswer(q, next, q.max === 1);
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
      const merged = { sayings: [] as string[], worries: [] as string[], groups: [] as string[], influencers: [] as string[], tags: [] as string[] };
      let situation: ChipSets["situation"], relation: ChipSets["relation"], frequency: ChipSets["frequency"], trustLoss: ChipSets["trustLoss"];
      const customAll: string[] = [];
      const applySets = (sets: ChipSets | undefined) => {
        if (!sets) return;
        situation = sets.situation ?? situation;
        relation = sets.relation ?? relation;
        frequency = sets.frequency ?? frequency;
        trustLoss = sets.trustLoss ?? trustLoss;
        for (const k of ["sayings", "worries", "groups", "influencers"] as const) for (const v of sets[k] ?? []) if (!merged[k].includes(v)) merged[k].push(v);
      };
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
          applySets(o.sets);
        }
        if (a.interpreted) {
          applySets(a.interpreted.sets);
          merged.tags.push(...a.interpreted.tags);
        }
      }
      const mine = profile.get().groups;
      const chips = Chips.parse({
        situation, relation, frequency, trustLoss,
        sayings: merged.sayings,
        worries: merged.worries,
        groups: merged.groups,
        influencers: merged.influencers,
        tags: merged.tags.slice(0, 30),
        sharedGroup: merged.groups.some((g) => mine.includes(g as never)),
      });
      const contact = await api<Contact>("/contacts", { body: { chips } });
      privateContacts.set(contact.id, { nickname: nickname.trim(), phone: phone.trim(), note: note.trim(), customChips: customAll });
      // Anonymous: which chips were used. Typed answers were already counted when interpreted.
      const real = path.filter((qid) => !qid.startsWith("ai_"));
      api("/chips/usage", { body: { answers: real.map((qid) => ({ questionId: qid, optionIds: answer(qid).optionIds, custom: aiAvailable ? [] : answer(qid).custom })) } }).catch(() => {});
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
          thinking={thinking}
          blocked={blocked}
          onAnswer={(a, auto) => setAnswer(current, a, auto)}
          onCustom={(custom) => onCustom(current, custom)}
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
  q, nome, answer, thinking, blocked, onAnswer, onCustom, onContinue, onBack,
}: {
  q: Question; nome: string; answer: Answer; thinking: boolean; blocked: string | null;
  onAnswer: (a: Answer, autoAdvance: boolean) => void; onCustom: (custom: string[]) => void; onContinue: () => void; onBack: () => void;
}) {
  const single = q.max === 1;
  const answered = answer.optionIds.length + answer.custom.length > 0;
  return (
    <section className="card">
      <h1>{q.text.replaceAll("{nome}", nome)}</h1>
      {q.hint && <p className="muted small">{q.hint}</p>}
      {!single && <p className="muted small">Marque quantas quiser.</p>}
      <ChipGroup
        options={q.options}
        value={answer.optionIds}
        onChange={(ids) => onAnswer({ ...answer, optionIds: ids, interpreted: ids.length ? null : answer.interpreted }, single && ids.length > 0)}
        max={q.max}
        custom={q.allowCustom ? answer.custom : undefined}
        onCustomChange={q.allowCustom ? onCustom : undefined}
      />
      {thinking && <p className="muted small">Entendendo…</p>}
      {blocked && <p className="error small">{blocked}</p>}
      {answer.interpreted?.rationale && !thinking && <p className="muted small">{answer.interpreted.rationale}</p>}
      <div className="row between">
        <button className="link" onClick={onBack}>← Voltar</button>
        {(!single || q.optional || answer.custom.length > 0) && (
          <button className={answered ? "primary" : "secondary"} disabled={thinking} onClick={onContinue}>{answered ? "Continuar" : q.optional ? "Pular" : "Continuar"}</button>
        )}
      </div>
    </section>
  );
}
