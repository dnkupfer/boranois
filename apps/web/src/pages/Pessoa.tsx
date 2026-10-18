import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { OUTCOMES, SAYINGS, type CoachMessage, type CoachResponse, type Contact, type Guide, type NextStepResponse, type OutcomeId, type SayingId, type Step } from "@boranois/shared";
import { api } from "../api";
import { ChipGroup, CopyButton, Layout, PriorityBadge } from "../components";
import { privateContacts, profile, whatsappLink } from "../local";
import { ago } from "./Pessoas";
import { useSession } from "../session";

type Phase = "step" | "outcome";
const SENDING = ["abrir_conversa", "enviar_fato", "enviar_conteudo", "oferecer_ajuda", "lembrar"];
const isSending = (s: Step) => SENDING.includes(s.action) && !!s.message;

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
  /** A message the coach proposed; replaces the next step's template once. */
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const loadNext = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<NextStepResponse>(`/contacts/${id}/next`, {
        body: {
          nickname: priv.nickname,
          note: [priv.note, priv.customChips.length ? `Sobre ela: ${priv.customChips.join("; ")}` : ""].filter(Boolean).join("\n") || undefined,
          voiceSample: profile.get().voiceSample || undefined,
        },
      });
      setContact(r.contact);
      setStep(r.step);
      setGuide(r.guide);
      setMessage(r.step.message ?? "");
      setPhase("step");
      setSuggestion((s) => {
        if (s && r.step.message !== null) setMessage(s);
        return null;
      });
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
    navigate("/");
  };

  if (!contact || !step || !guide) return <Layout narrow><p className="muted">Pensando no melhor jeito…</p></Layout>;
  const nome = priv.nickname || "ela";

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
            <p><strong>Em quem ela acredita:</strong> {guide.wouldBelieve.join("; ")}.</p>
            <p><strong>O que pode virar a chave:</strong> {guide.turningPoint}</p>
          </>
        )}
      </section>

      {phase === "step" && contact.state === "aguardando" && step.action === "lembrar" ? (
        <WaitCard step={step} contact={contact} message={message} setMessage={setMessage} phone={priv.phone} busy={busy} onReplied={() => setPhase("outcome")} onNudged={nudged} />
      ) : phase === "step" ? (
        <StepCard step={step} message={message} setMessage={setMessage} phone={priv.phone} busy={busy} onSent={() => sent(false)} onSkip={() => sent(true)} />
      ) : (
        <OutcomeCard
          contactId={id}
          nickname={priv.nickname}
          note={[priv.note, priv.customChips.length ? `Sobre ela: ${priv.customChips.join("; ")}` : ""].filter(Boolean).join("\n") || undefined}
          busy={busy}
          aiAvailable={aiAvailable}
          onOutcome={outcome}
          onSuggestion={setSuggestion}
        />
      )}

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

/** Waiting for her reply. A suggestion with the clock shown; the person decides. */
function WaitCard({
  step, contact, message, setMessage, phone, busy, onReplied, onNudged,
}: { step: Step; contact: Contact; message: string; setMessage: (m: string) => void; phone: string; busy: boolean; onReplied: () => void; onNudged: () => void }) {
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
        <button className="primary" disabled={busy} onClick={onReplied}>Ela respondeu</button>
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

type ChatTurn = { role: "user" | "coach"; text: string; suggestion?: string | null };

/**
 * After a message: what did she say, and what's the next move. Paste her reply and the coach reads it through
 * her persona; keep asking. The conversation lives in this tab only.
 */
function OutcomeCard({
  contactId, nickname, note, busy, aiAvailable, onOutcome, onSuggestion,
}: { contactId: string; nickname: string; note?: string; busy: boolean; aiAvailable: boolean; onOutcome: (o: OutcomeId, s?: SayingId) => void; onSuggestion: (text: string) => void }) {
  const [picked, setPicked] = useState<OutcomeId[]>([]);
  const [saying, setSaying] = useState<SayingId[]>([]);
  const [reply, setReply] = useState("");
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = chat.length > 0;

  const ask = async (text: string, fromReply: boolean) => {
    setThinking(true);
    setError(null);
    const history: CoachMessage[] = chat.map((t) => ({ role: t.role, text: t.text }));
    if (!fromReply) history.push({ role: "user", text });
    try {
      const r = await api<CoachResponse>(`/contacts/${contactId}/coach`, {
        body: { nickname, note, voiceSample: profile.get().voiceSample || undefined, reply: fromReply ? text : undefined, messages: history },
      });
      setChat([...(fromReply ? [{ role: "user" as const, text: `Ela disse: “${text}”` }] : [...chat, { role: "user" as const, text }]), { role: "coach", text: r.text, suggestion: r.suggestedMessage }]);
      if (r.outcome) setPicked([r.outcome]);
      if (r.saying) setSaying([r.saying]);
      setQuestion("");
    } catch {
      setError("O coach não está disponível agora. Marque abaixo o que aconteceu.");
    } finally {
      setThinking(false);
    }
  };

  const o = picked[0];
  return (
    <section className="card step-card">
      <p className="eyebrow">Depois</p>
      <h2>O que ela respondeu?</h2>
      {aiAvailable && !started && (
        <label>
          Cole a resposta dela <span className="muted">(não fica guardado)</span>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="O que ela escreveu, do jeito que escreveu" />
          {reply.trim() && (
            <button type="button" className="secondary" disabled={thinking} onClick={() => ask(reply.trim(), true)}>
              {thinking ? "Lendo…" : "O que está por trás disso?"}
            </button>
          )}
        </label>
      )}
      {started && (
        <div className="chat">
          {chat.map((t, i) => (
            <div key={i} className={`bubble ${t.role}`}>
              <p>{t.text}</p>
              {t.suggestion && (
                <div className="suggestion">
                  <p className="small muted">Mensagem sugerida:</p>
                  <blockquote>{t.suggestion}</blockquote>
                  <button type="button" className="secondary" onClick={() => onSuggestion(t.suggestion!)}>Usar como próxima mensagem</button>
                </div>
              )}
            </div>
          ))}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim()) ask(question.trim(), false);
            }}
          >
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Pergunte ao coach: e se ela mandar um vídeo? quero ser mais direto…" disabled={thinking} />
            <button className="secondary" disabled={thinking || !question.trim()}>{thinking ? "…" : "Perguntar"}</button>
          </form>
        </div>
      )}
      {error && <p className="error small">{error}</p>}

      <p className="label">O que aconteceu?</p>
      <ChipGroup options={OUTCOMES} value={picked} onChange={setPicked} max={1} />
      {o === "discordou" && (
        <>
          <p className="label">O que ela disse?</p>
          <ChipGroup options={SAYINGS} value={saying} onChange={setSaying} max={1} />
        </>
      )}
      <div className="row">
        <button className="primary" disabled={!o || busy} onClick={() => onOutcome(o!, saying[0])}>Ver o próximo passo</button>
      </div>
      <p className="muted small">Se ela ainda não respondeu, volte depois. Mandar de novo agora parece cobrança.</p>
    </section>
  );
}
