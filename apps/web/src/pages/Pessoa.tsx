import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { OUTCOMES, SAYINGS, type ClassifyResponse, type Contact, type NextStepResponse, type OutcomeId, type SayingId, type Step } from "@boranois/shared";
import { api } from "../api";
import { ChipGroup, CopyButton, Layout, PriorityBadge } from "../components";
import { privateContacts, profile, whatsappLink } from "../local";
import { useSession } from "../session";

type Phase = "step" | "outcome";

export function Pessoa() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { aiAvailable } = useSession();
  const priv = privateContacts.get(id);
  const [contact, setContact] = useState<Contact | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("step");
  const [busy, setBusy] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  const loadNext = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<NextStepResponse>(`/contacts/${id}/next`, {
        body: { nickname: priv.nickname, note: priv.note || undefined, voiceSample: profile.get().voiceSample || undefined },
      });
      setContact(r.contact);
      setStep(r.step);
      setMessage(r.step.message ?? "");
      setPhase("step");
    } finally {
      setBusy(false);
    }
  }, [id, priv.nickname, priv.note]);

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

  if (!contact || !step) return <Layout><p className="muted">Pensando no melhor jeito…</p></Layout>;

  return (
    <Layout>
      <p><Link to="/">← Suas pessoas</Link></p>
      <div className="person-head">
        <h1>{priv.nickname || "Pessoa"}</h1>
        <PriorityBadge level={contact.priority.level} engage={contact.priority.engage} />
      </div>
      <p>
        Parece <strong>{contact.match.personaName}</strong>
        <button className="link" onClick={() => setShowWhy((v) => !v)}> {showWhy ? "esconder" : "por quê?"}</button>
      </p>
      {showWhy && (
        <div className="card small">
          <p><strong>Perfil:</strong> {contact.match.because.join("; ")}.</p>
          <p><strong>Prioridade:</strong> {contact.priority.reasons.join("; ")}.</p>
          <p className="muted">Os perfis são públicos: veja todos em <Link to="/perfis">Perfis</Link>.</p>
        </div>
      )}
      {contact.match.alternative && (
        <p className="muted">
          Ou será que é mais <em>{contact.match.alternative.personaName}</em>?{" "}
          <button className="link" onClick={() => switchPersona(contact.match.alternative!.personaId)}>Trocar</button>
        </p>
      )}

      {phase === "step" ? (
        <StepCard step={step} message={message} setMessage={setMessage} phone={priv.phone} busy={busy} onSent={() => sent(false)} onSkip={() => sent(true)} />
      ) : (
        <OutcomeCard busy={busy} aiAvailable={aiAvailable} onOutcome={outcome} />
      )}

      {step.donts.length > 0 && (
        <section className="card">
          <h2>Com {priv.nickname || "ela"}, não:</h2>
          <ul>{step.donts.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </section>
      )}

      <p><button className="link danger" onClick={remove}>Apagar esta pessoa</button></p>
    </Layout>
  );
}

const isSending = (s: Step) => ["abrir_conversa", "enviar_fato", "enviar_conteudo", "oferecer_ajuda", "lembrar"].includes(s.action) && !!s.message;

function StepCard({
  step, message, setMessage, phone, busy, onSent, onSkip,
}: { step: Step; message: string; setMessage: (m: string) => void; phone: string; busy: boolean; onSent: () => void; onSkip: () => void }) {
  const sending = isSending(step);
  return (
    <section className="card step-card">
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
              Fonte do fato: <a href={step.fact.sourceUrl} target="_blank" rel="noreferrer">{step.fact.sourceName}</a>
            </p>
          )}
          {step.content && (
            <p className="small">
              Vídeo/post: <a href={step.content.url} target="_blank" rel="noreferrer">{step.content.summary}</a> <span className="muted">({step.content.messenger})</span>
            </p>
          )}
          <div className="row">
            {phone ? (
              <a className="button whatsapp" href={whatsappLink(phone, message)} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
            ) : (
              <CopyButton text={message} label="Copiar mensagem" className="whatsapp-copy" />
            )}
            <button className="primary" disabled={busy} onClick={onSent}>Já mandei</button>
            <button className="link" disabled={busy} onClick={onSkip}>Pular este passo</button>
          </div>
        </>
      )}
      {!sending && (
        <div className="row">
          {step.action !== "parar" && step.action !== "pausar" && <button className="primary" disabled={busy} onClick={onSent}>Entendi</button>}
        </div>
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
      <h2>E aí, o que aconteceu?</h2>
      <p className="muted">Marque quando ela responder. Se ainda não respondeu, pode voltar depois.</p>
      {aiAvailable && (
        <label>
          Se quiser, cole o que ela respondeu <span className="muted">(não fica guardado)</span>
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
