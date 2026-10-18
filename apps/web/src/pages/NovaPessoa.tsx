import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chips, nextTargets, type ChipSets, type Contact, type Interpretation, type Question, type QuestionsResponse } from "@boranois/shared";
import { api } from "../api";
import { ChipGroup, Layout, Progress } from "../components";
import { privateContacts, profile } from "../local";
import { useSession } from "../session";

type Answer = { optionIds: string[]; custom: string[]; interpreted?: Interpretation | null };
type Screen = "quem" | "pergunta" | "nota";
/** One visited question plus the branches still waiting after it; kept as history so "Voltar" restores the queue. */
type Visit = { id: string; queue: string[] };

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
  const [visits, setVisits] = useState<Visit[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [busy, setBusy] = useState(false);
  const [thinkingFor, setThinkingFor] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<QuestionsResponse>("/questions").then((f) => {
      setFlow(f);
      setVisits([{ id: f.start, queue: [] }]);
    });
  }, []);

  const byId = useMemo(() => {
    const m = new Map(flow?.questions.map((q) => [q.id, q]) ?? []);
    for (const q of Object.values(extra)) m.set(q.id, q);
    return m;
  }, [flow, extra]);
  const last = visits[visits.length - 1];
  const current = last ? byId.get(last.id) : undefined;
  const asked = visits.map((v) => v.id);
  const answer = (id: string): Answer => answers[id] ?? { optionIds: [], custom: [] };

  // Progress = answered / (answered + longest remaining path). Good enough for a tree this size.
  const longestFrom = (id: string | null, seen = new Set<string>()): number => {
    if (!id || seen.has(id)) return 0;
    const q = byId.get(id);
    if (!q) return 0;
    const nexts = q.next === null ? [] : typeof q.next === "string" ? [q.next] : [...new Set(Object.values(q.next))];
    return 1 + Math.max(0, ...nexts.map((n) => longestFrom(n, new Set([...seen, id]))));
  };
  const progress =
    screen === "quem" ? 0.05 : screen === "nota" ? 0.95 : (visits.length + 1) / (visits.length + 1 + (last?.queue.length ?? 0) + longestFrom(last?.id ?? null) + 1);

  /** Branches to visit after `q`, given its answer. */
  const targetsOf = (q: Question, a: Answer) =>
    nextTargets(q, [...a.optionIds, ...(a.interpreted?.optionId ? [a.interpreted.optionId] : [])], a.interpreted?.nextQuestionId);

  /** Go on: pending branches first, then this question's own, never a question already asked. */
  const advance = (q: Question, a: Answer) => {
    setVisits((vs) => {
      const cur = vs[vs.length - 1];
      if (!cur || cur.id !== q.id) return vs;
      const done = new Set(vs.map((v) => v.id));
      const queue = [...cur.queue, ...targetsOf(q, a)].filter((id, i, arr) => !done.has(id) && arr.indexOf(id) === i);
      if (!queue.length) {
        setScreen("nota");
        return vs;
      }
      const [next, ...rest] = queue;
      return [...vs, { id: next, queue: rest }];
    });
  };

  const setAnswer = (q: Question, a: Answer, autoAdvance: boolean) => {
    setAnswers((prev) => ({ ...prev, [q.id]: a }));
    if (autoAdvance) setTimeout(() => advance(q, a), 160);
  };

  /**
   * A typed answer. The chip is stored at once (it shows, survives "Voltar", enables "Continuar");
   * the model's interpretation fills in afterwards. Without AI, the chip stays as a tag and the tree's default applies.
   */
  const onCustom = async (q: Question, custom: string[]) => {
    const a = answer(q.id);
    const added = custom.find((c) => !a.custom.includes(c));
    const stored: Answer = { optionIds: q.max === 1 ? [] : a.optionIds, custom, interpreted: added ? undefined : a.interpreted };
    setAnswers((prev) => ({ ...prev, [q.id]: stored }));
    setBlocked(null);
    if (!added) return;
    if (!aiAvailable) return setAnswers((prev) => ({ ...prev, [q.id]: { ...stored, interpreted: null } }));

    setThinkingFor(q.id);
    let interpreted: Interpretation | null = null;
    try {
      const questionId = q.id.startsWith("ai_") ? q.id.slice(3).split("_")[0] : q.id;
      // Never make the person wait on the network: after 8s we go on without the interpretation.
      interpreted = await Promise.race([
        api<Interpretation>("/chips/interpret", { body: { questionId, text: added } }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
    } catch {
      interpreted = null;
    } finally {
      setThinkingFor(null);
    }

    if (interpreted?.blocked) {
      setBlocked(interpreted.blocked);
      setAnswers((prev) => ({ ...prev, [q.id]: { ...stored, custom: custom.filter((c) => c !== added), interpreted: null } }));
      return;
    }
    const withResult: Answer = { ...stored, interpreted };
    setAnswers((prev) => ({ ...prev, [q.id]: withResult }));

    if (interpreted?.followup) {
      const id = `ai_${q.id}_${visits.length}`;
      const fq: Question = { id, text: interpreted.followup.text, options: interpreted.followup.options, max: 1, optional: true, allowCustom: false, next: null };
      setExtra((e) => ({ ...e, [id]: fq }));
      // The follow-up is asked now; the original question's branches wait in the queue behind it.
      setVisits((vs) => {
        const cur = vs[vs.length - 1];
        if (!cur || cur.id !== q.id) return vs;
        const own = targetsOf(q, { ...withResult, interpreted: { ...interpreted!, nextQuestionId: null } });
        return [...vs, { id, queue: [...cur.queue, ...own] }];
      });
      return;
    }
    if (q.max === 1) advance(q, withResult);
  };

  const back = () => {
    if (screen === "nota") return setScreen("pergunta");
    if (visits.length > 1) return setVisits((vs) => vs.slice(0, -1));
    setScreen("quem");
  };

  const submit = async () => {
    if (!flow) return;
    setBusy(true);
    setError(null);
    try {
      const merged = { sayings: [] as string[], worries: [] as string[], groups: [] as string[], influencers: [] as string[], trustLoss: [] as string[], tags: [] as string[] };
      let situation: ChipSets["situation"], relation: ChipSets["relation"], frequency: ChipSets["frequency"];
      const customAll: string[] = [];
      const applySets = (sets: ChipSets | undefined) => {
        if (!sets) return;
        situation = sets.situation ?? situation;
        relation = sets.relation ?? relation;
        frequency = sets.frequency ?? frequency;
        for (const k of ["sayings", "worries", "groups", "influencers", "trustLoss"] as const) for (const v of sets[k] ?? []) if (!merged[k].includes(v)) merged[k].push(v);
      };
      for (const qid of asked) {
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
        situation, relation, frequency,
        sayings: merged.sayings, worries: merged.worries, groups: merged.groups, influencers: merged.influencers, trustLoss: merged.trustLoss,
        tags: merged.tags.slice(0, 30),
        sharedGroup: merged.groups.some((g) => mine.includes(g as never)),
      });
      const contact = await api<Contact>("/contacts", { body: { chips } });
      privateContacts.set(contact.id, { nickname: nickname.trim(), phone: phone.trim(), note: note.trim(), customChips: customAll });
      // Anonymous: which chips were used. Typed answers were already counted when interpreted.
      const real = asked.filter((qid) => !qid.startsWith("ai_"));
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
          thinking={thinkingFor === current.id}
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
      {thinking && <p className="muted small">Entendendo… (pode continuar)</p>}
      {blocked && <p className="error small">{blocked}</p>}
      {answer.interpreted?.rationale && !thinking && <p className="muted small">{answer.interpreted.rationale}</p>}
      <div className="row between">
        <button className="link" onClick={onBack}>← Voltar</button>
        {(!single || q.optional || answered) && (
          <button className={answered ? "primary" : "secondary"} onClick={onContinue}>
            {answered ? "Continuar" : q.optional ? "Pular" : "Continuar"}
          </button>
        )}
      </div>
    </section>
  );
}
