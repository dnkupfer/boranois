import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { OUTCOMES, SAYINGS, type ClassifyResponse, type Contact, type Guide, type NextStepResponse, type OutcomeId, type SayingId, type Step } from "@boranois/shared";
import { api } from "../api";
import { ChipGroup, CopyButton, Layout, PriorityBadge } from "../components";
import { privateContacts, profile, whatsappLink } from "../local";
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

      {phase === "step" ? (
        <StepCard step={step} message={message} setMessage={setMessage} phone={priv.phone} busy={busy} onSent={() => sent(false)} onSkip={() => sent(true)} />
      ) : (
        <OutcomeCard busy={busy} aiAvailable={aiAvailable} onOutcome={outcome} />
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

function OutcomeCard({ busy, aiAvailable, onOutcome }: { busy: boolean; aiAvailable: boolean; onOutcome: (o: OutcomeId, s?: SayingId) => void }) {
  const [picked, setPicked] = useState<OutcomeId[]>([]);
  const [saying, setSaying] = useState<SayingId[]>([]);
  const [pasted, setPasted] = useState("");
  const [classifying, setClassifying] = useState(false);

  const classify = async () => {
    setClassifying(true);
    try {
      const r = await api<ClassifyResponse>("/classify", { body: { text: pasted } });
      setPicked([r.outcome]);
      setSaying(r.saying ? [r.saying] : []);
    } finally {
      setClassifying(false);
    }
  };

  const o = picked[0];
  return (
    <section className="card step-card">
      <p className="eyebrow">Depois</p>
      <h2>O que ela respondeu?</h2>
      <p className="muted">Se ainda não respondeu, volte depois. Mandar de novo agora parece cobrança.</p>
      {aiAvailable && (
        <label>
          Cole a resposta dela, se quiser <span className="muted">(não fica guardado)</span>
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={2} />
          {pasted && <button type="button" className="secondary" disabled={classifying} onClick={classify}>{classifying ? "Lendo…" : "Entender a resposta"}</button>}
        </label>
      )}
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
    </section>
  );
}
