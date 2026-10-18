import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { OUTCOMES, SAYINGS, type CoachMessage, type CoachResponse, type Contact, type Guide, type NextStepResponse, type OutcomeId, type SayingId, type Step } from "@boranois/shared";
import { api } from "../api";
import { ChipGroup, CopyButton, Layout, PriorityBadge } from "../components";
import { coachThreads, privateContacts, profile, whatsappLink, type CoachTurn } from "../local";
import { useSession } from "../session";
import { ago } from "./Pessoas";

type Phase = "step" | "outcome";
const SENDING = ["abrir_conversa", "enviar_fato", "enviar_conteudo", "oferecer_ajuda", "lembrar"];
const isSending = (s: Step) => SENDING.includes(s.action) && !!s.message;

/** Pronouns for the UI strings; the catalogue texts come already inflected from the API. */
const pron = (g: "f" | "m") => (g === "m" ? { ela: "ele", Ela: "Ele", dela: "dele" } : { ela: "ela", Ela: "Ela", dela: "dela" });

export function Pessoa() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { aiAvailable } = useSession();
  const priv = privateContacts.get(id);
  const [contact, setContact] = useState<Contact | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("step");
  const [busy, setBusy] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showRead, setShowRead] = useState(true);
  /** Chips the coach read from a pasted reply, to pre-fill the outcome card. */
  const [prefill, setPrefill] = useState<{ outcome: OutcomeId | null; saying: SayingId | null } | null>(null);
  const stepRef = useRef<HTMLElement>(null);

  const note = [priv.note, priv.customChips.length ? `Sobre a pessoa: ${priv.customChips.join("; ")}` : ""].filter(Boolean).join("\n") || undefined;

  const loadNext = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<NextStepResponse>(`/contacts/${id}/next`, {
        body: { nickname: priv.nickname, note, voiceSample: profile.get().voiceSample || undefined },
      });
      setContact(r.contact);
      setStep(r.step);
      setGuide(r.guide);
      setMessage(r.step.message ?? "");
      setPhase("step");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadNext().catch(() => navigate("/"));
  }, [loadNext, navigate]);

  const sent = async (skipped = false) => {
    if (!step) return;
    const c = await api<Contact>(`/contacts/${id}/sent`, { body: { stepId: step.id, action: step.action, skipped } });
    setContact(c);
    if (skipped || !isSending(step)) await loadNext();
    else setPhase("outcome");
  };

  const outcome = async (o: OutcomeId, saying?: SayingId) => {
    if (!step) return;
    setBusy(true);
    try {
      await api<Contact>(`/contacts/${id}/interactions`, { body: { stepId: step.id, outcome: o, saying } });
      setPrefill(null);
      await loadNext();
    } finally {
      setBusy(false);
    }
  };

  /** A nudge was sent: the clock restarts, the state stays "aguardando". */
  const nudged = async () => {
    if (!step) return;
    await api<Contact>(`/contacts/${id}/sent`, { body: { stepId: step.id, action: step.action } });
    await loadNext();
  };

  const switchPersona = async (personaId: string) => {
    await api<Contact>(`/contacts/${id}/persona`, { method: "PUT", body: { personaId } });
    await loadNext();
  };

  const remove = async () => {
    if (!confirm(`Apagar ${priv.nickname || "esta pessoa"}?`)) return;
    await api(`/contacts/${id}`, { method: "DELETE" });
    privateContacts.remove(id);
    coachThreads.remove(id);
    navigate("/");
  };

  /** The coach proposed a message: put it in the step's box and scroll there. */
  const useSuggestion = (text: string) => {
    setMessage(text);
    setPhase("step");
    setTimeout(() => stepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  /** The coach read a pasted reply: pre-fill the outcome chips and go there. */
  const onReplyRead = (o: OutcomeId | null, s: SayingId | null) => {
    setPrefill({ outcome: o, saying: s });
    if (contact?.state === "aguardando" || phase === "outcome") setPhase("outcome");
  };

  if (!contact || !step || !guide) return <Layout narrow><p className="muted">Pensando no melhor jeito…</p></Layout>;
  const nome = priv.nickname || "a pessoa";
  const P = pron(contact.chips.gender);

  return (
    <Layout narrow>
      <p><Link to="/">← Suas pessoas</Link></p>
      <div className="person-head">
        <h1>{priv.nickname || "Pessoa"}</h1>
        <PriorityBadge level={contact.priority.level} engage={contact.priority.engage} />
      </div>
      <p className="persona-line">
        {guide.personaName}
        <button className="link" onClick={() => setShowWhy((v) => !v)}> · {showWhy ? "fechar" : "por quê?"}</button>
      </p>
      {showWhy && (
        <div className="card small">
          <p><strong>Perfil:</strong> {contact.match.because.join("; ")}.</p>
          <p><strong>Prioridade:</strong> {contact.priority.reasons.join("; ")}.</p>
          {contact.match.alternative && (
            <p>
              Ou será que é mais <em>{contact.match.alternative.personaName}</em>?{" "}
              <button className="link" onClick={() => switchPersona(contact.match.alternative!.personaId)}>Trocar</button>
            </p>
          )}
        </div>
      )}

      <section className="card read">
        <button className="link toggle" onClick={() => setShowRead((v) => !v)}>
          <strong>Por que {nome} pensa assim</strong> {showRead ? "▾" : "▸"}
        </button>
        {showRead && (
          <>
            <p>{guide.read}</p>
            <p><strong>Em quem {P.ela} acredita:</strong> {guide.wouldBelieve.join("; ")}.</p>
            <p><strong>O que pode virar a chave:</strong> {guide.turningPoint}</p>
          </>
        )}
      </section>

      <div ref={stepRef as React.RefObject<HTMLDivElement>}>
        {phase === "step" && contact.state === "aguardando" && step.action === "lembrar" ? (
          <WaitCard step={step} contact={contact} message={message} setMessage={setMessage} phone={priv.phone} busy={busy} P={P} onReplied={() => setPhase("outcome")} onNudged={nudged} />
        ) : phase === "step" ? (
          <StepCard step={step} message={message} setMessage={setMessage} phone={priv.phone} busy={busy} onSent={() => sent(false)} onSkip={() => sent(true)} />
        ) : (
          <OutcomeCard key={`${step.id}-${prefill?.outcome ?? ""}`} busy={busy} prefill={prefill} P={P} onOutcome={outcome} />
        )}
      </div>

      <CoachCard contactId={id} nickname={priv.nickname || "a pessoa"} note={note} aiAvailable={aiAvailable} P={P} onSuggestion={useSuggestion} onReplyRead={onReplyRead} />

      <section className="card">
        <h2>Como falar com {nome}</h2>
        <ol className="tactics">
          {guide.tactics.map((t, i) => (
            <li key={i}>
              <strong>{t.title}</strong>
              <p>{t.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      {guide.avoid.length > 0 && (
        <section className="card avoid">
          <h2>Evite</h2>
          <ul>
            {guide.avoid.map((a, i) => (
              <li key={i}>
                <strong>{a.what}.</strong> <span className="muted">{a.why}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p><button className="link danger" onClick={remove}>Apagar esta pessoa</button></p>
    </Layout>
  );
}

type Pron = ReturnType<typeof pron>;

function StepCard({
  step, message, setMessage, phone, busy, onSent, onSkip,
}: { step: Step; message: string; setMessage: (m: string) => void; phone: string; busy: boolean; onSent: () => void; onSkip: () => void }) {
  const sending = isSending(step);
  return (
    <section className="card step-card">
      <p className="eyebrow">Agora</p>
      <h2>{step.title}</h2>
      <p className="muted">{step.why}</p>
      {sending && (
        <>
          <label>
            Sua mensagem <span className="muted">(mude do seu jeito)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
          </label>
          {step.fact && (
            <p className="small muted">
              Fonte: <a href={step.fact.sourceUrl} target="_blank" rel="noreferrer">{step.fact.sourceName}</a>
            </p>
          )}
          {step.content && (
            <p className="small">
              Para enviar: <a href={step.content.url} target="_blank" rel="noreferrer">{step.content.summary}</a> <span className="muted">({step.content.messenger})</span>
            </p>
          )}
          <div className="row">
            {phone ? (
              <a className="button whatsapp" href={whatsappLink(phone, message)} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
            ) : (
              <CopyButton text={message} label="Copiar mensagem" className="whatsapp" />
            )}
            <button className="primary" disabled={busy} onClick={onSent}>Já mandei</button>
            <button className="link" disabled={busy} onClick={onSkip}>Pular</button>
          </div>
        </>
      )}
      {!sending && step.action !== "parar" && step.action !== "pausar" && (
        <div className="row"><button className="primary" disabled={busy} onClick={onSent}>Entendi</button></div>
      )}
    </section>
  );
}

/** Waiting for the reply. A suggestion with the clock shown; the person decides. */
function WaitCard({
  step, contact, message, setMessage, phone, busy, P, onReplied, onNudged,
}: { step: Step; contact: Contact; message: string; setMessage: (m: string) => void; phone: string; busy: boolean; P: Pron; onReplied: () => void; onNudged: () => void }) {
  const [nudging, setNudging] = useState(false);
  const sentAt = contact.lastSentAt ? new Date(contact.lastSentAt) : null;
  const waitH = step.waitHours ?? 24;
  const until = sentAt ? new Date(sentAt.getTime() + waitH * 3600000) : null;
  const fmt = (d: Date) => d.toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const overdue = until ? Date.now() > until.getTime() : false;
  return (
    <section className="card step-card">
      <p className="eyebrow">Agora</p>
      <h2>{step.title}</h2>
      {sentAt ? (
        <p>
          Você mandou <strong>{fmt(sentAt)}</strong> <span className="muted">({ago(contact.lastSentAt)})</span>.
          {until && (overdue ? <> Já passou o tempo sugerido ({waitH} h): se quiser, um lembrete leve.</> : <> Sugestão: espere até <strong>{fmt(until)}</strong> ({waitH} h).</>)}
        </p>
      ) : (
        <p className="muted">{step.why}</p>
      )}
      <div className="row">
        <button className="primary" disabled={busy} onClick={onReplied}>{P.Ela} respondeu</button>
        {!nudging && <button className="secondary" disabled={busy} onClick={() => setNudging(true)}>Mandar um lembrete</button>}
      </div>
      {nudging && (
        <>
          <label>
            Lembrete <span className="muted">(mude do seu jeito)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </label>
          <div className="row">
            {phone ? (
              <a className="button whatsapp" href={whatsappLink(phone, message)} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
            ) : (
              <CopyButton text={message} label="Copiar mensagem" className="whatsapp" />
            )}
            <button className="primary" disabled={busy} onClick={onNudged}>Já mandei</button>
            <button className="link" onClick={() => setNudging(false)}>Cancelar</button>
          </div>
        </>
      )}
    </section>
  );
}

/** What happened after a message, as chips. The coach (below) can pre-fill them from a pasted reply. */
function OutcomeCard({
  busy, prefill, P, onOutcome,
}: { busy: boolean; prefill: { outcome: OutcomeId | null; saying: SayingId | null } | null; P: Pron; onOutcome: (o: OutcomeId, s?: SayingId) => void }) {
  const [picked, setPicked] = useState<OutcomeId[]>(prefill?.outcome ? [prefill.outcome] : []);
  const [saying, setSaying] = useState<SayingId[]>(prefill?.saying ? [prefill.saying] : []);
  const o = picked[0];
  return (
    <section className="card step-card">
      <p className="eyebrow">Depois</p>
      <h2>O que {P.ela} respondeu?</h2>
      <p className="muted small">Quer entender a resposta antes? Cole o que {P.ela} disse no coach, logo abaixo.</p>
      <ChipGroup options={OUTCOMES} value={picked} onChange={setPicked} max={1} />
      {o === "discordou" && (
        <>
          <p className="label">O que {P.ela} disse?</p>
          <ChipGroup options={SAYINGS} value={saying} onChange={setSaying} max={1} />
        </>
      )}
      <div className="row">
        <button className="primary" disabled={!o || busy} onClick={() => onOutcome(o!, saying[0])}>Ver o próximo passo</button>
      </div>
    </section>
  );
}

/**
 * The coach, always on the page. Paste what she said, or ask anything about the next move.
 * The thread is kept on this device, per pessoa; the server stores none of it.
 */
function CoachCard({
  contactId, nickname, note, aiAvailable, P, onSuggestion, onReplyRead,
}: { contactId: string; nickname: string; note?: string; aiAvailable: boolean; P: Pron; onSuggestion: (text: string) => void; onReplyRead: (o: OutcomeId | null, s: SayingId | null) => void }) {
  const [chat, setChat] = useState<CoachTurn[]>(() => coachThreads.get(contactId));
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    coachThreads.set(contactId, chat);
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [chat, contactId]);

  const send = async (asReply: boolean) => {
    const t = text.trim();
    if (!t) return;
    setThinking(true);
    setError(null);
    const history: CoachMessage[] = chat.map((c) => ({ role: c.role, text: c.text }));
    if (!asReply) history.push({ role: "user", text: t });
    try {
      const r = await api<CoachResponse>(`/contacts/${contactId}/coach`, {
        body: { nickname, note, voiceSample: profile.get().voiceSample || undefined, reply: asReply ? t : undefined, messages: history.slice(-16) },
      });
      const mine: CoachTurn = { role: "user", text: asReply ? `${P.Ela} disse: “${t}”` : t };
      setChat([...chat, mine, { role: "coach", text: r.text, suggestion: r.suggestedMessage }]);
      setText("");
      if (asReply) onReplyRead(r.outcome, r.saying);
    } catch {
      setError("O coach não está disponível agora. Tente de novo em instantes.");
    } finally {
      setThinking(false);
    }
  };

  return (
    <section className="card coach">
      <p className="eyebrow">Coach</p>
      <h2>Converse sobre o próximo passo</h2>
      {!aiAvailable && <p className="muted small">O coach precisa da IA, que está indisponível agora.</p>}
      {chat.length === 0 && aiAvailable && (
        <p className="muted small">Cole o que {nickname} respondeu para entender o que está por trás, ou pergunte: “e se {P.ela} mandar um vídeo?”, “quero ser mais direto”.</p>
      )}
      {chat.length > 0 && (
        <div className="chat">
          {chat.map((c, i) => (
            <div key={i} className={`bubble ${c.role}`}>
              <p>{c.text}</p>
              {c.suggestion && (
                <div className="suggestion">
                  <p className="small muted">Mensagem sugerida:</p>
                  <blockquote>{c.suggestion}</blockquote>
                  <button type="button" className="secondary" onClick={() => onSuggestion(c.suggestion!)}>Usar como próxima mensagem</button>
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
      {aiAvailable && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !thinking) {
                e.preventDefault();
                send(false);
              }
            }}
            rows={2}
            placeholder={`Pergunte ao coach, ou cole o que ${nickname} respondeu`}
            disabled={thinking}
          />
          <div className="row">
            <button type="button" className="primary" disabled={thinking || !text.trim()} onClick={() => send(false)}>{thinking ? "Pensando…" : "Perguntar"}</button>
            <button type="button" className="secondary" disabled={thinking || !text.trim()} onClick={() => send(true)}>Isto é o que {P.ela} respondeu</button>
            {chat.length > 0 && <button type="button" className="link" onClick={() => setChat([])}>Limpar</button>}
          </div>
          {error && <p className="error small">{error}</p>}
          <p className="muted small">A conversa com o coach fica só neste aparelho.</p>
        </>
      )}
    </section>
  );
}
