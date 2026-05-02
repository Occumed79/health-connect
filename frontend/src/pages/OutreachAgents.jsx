import React, { useMemo, useState } from "react";
import { BotMessageSquare, Mail, MessageCircle, ShieldCheck, Send, Clipboard, Wand2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createOutreachThread, draftOutreachFollowup, draftOutreachMessage, logOutreachMessage, parseOutreachReply } from "../lib/api";

const AGENTS = [
  {
    id: "email-autonomous",
    label: "Email AI Agent - Autonomous",
    icon: Mail,
    badge: "Auto-send capable",
    description: "Drafts, sends, parses replies, and prepares follow-ups for clinic outreach. Best used only with approved guardrails and non-PHI service questions.",
    risk: "Higher risk: requires strict templates, unsubscribe/stop handling, and clear audit logs.",
  },
  {
    id: "email-human",
    label: "Email AI Agent + Human",
    icon: ShieldCheck,
    badge: "Recommended first",
    description: "AI drafts and analyzes outreach, but you approve every send. This is the safest first production workflow.",
    risk: "Lower risk: human approval before outreach leaves the system.",
  },
  {
    id: "whatsapp-autonomous",
    label: "Autonomous WhatsApp",
    icon: MessageCircle,
    badge: "International focus",
    description: "Designed for overseas clinics where WhatsApp is the fastest channel. Should identify itself as an assistant and escalate complex questions.",
    risk: "Requires WhatsApp Business/Twilio/360dialog setup and template/rate-limit compliance.",
  },
];

const DEFAULT_SERVICES = "General physical exam, chest X-ray, labs, EKG, audiogram, pulmonary function test, vaccines, drug screen, dental exam";

export default function OutreachAgents() {
  const [agentMode, setAgentMode] = useState("email-human");
  const [form, setForm] = useState({
    clinic_name: "",
    contact_name: "",
    email: "",
    whatsapp: "",
    phone: "",
    country: "",
    city: "",
    language: "English",
    services_needed: DEFAULT_SERVICES,
    context: "Occu-Med is trying to confirm whether this clinic can support assessment-only medical referrals and complete required forms. The provider is not being asked to clear the individual for work.",
    tone: "professional, warm, concise",
  });
  const [draft, setDraft] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectedAgent = useMemo(() => AGENTS.find((a) => a.id === agentMode), [agentMode]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const buildPayload = () => ({ ...form, agent_mode: agentMode });

  const generateDraft = async () => {
    if (!form.clinic_name.trim()) return toast.error("Add a clinic name first");
    setLoading(true);
    try {
      const data = await draftOutreachMessage(buildPayload());
      setDraft(data);
      toast.success("Draft generated");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not generate draft");
    } finally {
      setLoading(false);
    }
  };

  const saveThread = async () => {
    if (!draft?.message) return toast.error("Generate a draft first");
    setLoading(true);
    try {
      const thread = await createOutreachThread({ ...buildPayload(), status: "drafted", latest_summary: draft.message });
      await logOutreachMessage({ thread_id: thread.id, channel: draft.channel, direction: "outbound", body: draft.message, status: agentMode.includes("autonomous") ? "ready_for_automation" : "needs_human_approval" });
      toast.success("Saved to outreach log");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save outreach log");
    } finally {
      setLoading(false);
    }
  };

  const copyDraft = async () => {
    if (!draft?.message) return;
    await navigator.clipboard.writeText(draft.message);
    toast.success("Copied draft");
  };

  const parseReply = async () => {
    if (!replyText.trim()) return toast.error("Paste a clinic reply first");
    setLoading(true);
    try {
      const data = await parseOutreachReply({ ...buildPayload(), reply_text: replyText });
      setAnalysis(data);
      toast.success("Reply analyzed");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not analyze reply");
    } finally {
      setLoading(false);
    }
  };

  const generateFollowup = async () => {
    if (!replyText.trim()) return toast.error("Paste a clinic reply first");
    setLoading(true);
    try {
      const data = await draftOutreachFollowup({ ...buildPayload(), reply_text: replyText, analysis });
      setDraft(data);
      toast.success("Follow-up drafted");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not draft follow-up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-up" data-testid="outreach-agents-page">
      <div className="mb-9">
        <div className="label-overline mb-3 inline-flex items-center gap-2" style={{ color: "var(--accent)" }}>
          <BotMessageSquare size={13} strokeWidth={1.5} /> Outreach Automation
        </div>
        <h1 className="serif text-5xl md:text-7xl mb-4 leading-[0.92] tracking-tight">
          Clinic <span className="italic" style={{ color: "var(--accent)" }}>outreach</span> agents.
        </h1>
        <p className="text-white/60 max-w-3xl text-lg">
          Draft emails, analyze clinic replies, and prepare follow-ups for domestic and overseas provider sourcing. Start with human approval, then graduate to controlled automation.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        {AGENTS.map(({ id, label, icon: Icon, badge, description, risk }) => {
          const active = id === agentMode;
          return (
            <button
              key={id}
              onClick={() => setAgentMode(id)}
              className={`glass text-left p-5 transition-all ${active ? "ring-1 ring-white/30 bg-white/10" : "hover:bg-white/5"}`}
              data-testid={`agent-tab-${id}`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="h-11 w-11 rounded-2xl grid place-items-center bg-white/10 border border-white/10">
                  <Icon size={20} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                </div>
                <span className="chip text-[10px]">{badge}</span>
              </div>
              <div className="text-white font-medium mb-2">{label}</div>
              <p className="text-sm text-white/55 leading-relaxed mb-3">{description}</p>
              <p className="text-xs text-white/40 leading-relaxed">{risk}</p>
            </button>
          );
        })}
      </div>

      {selectedAgent?.id !== "email-human" && (
        <div className="glass p-4 mb-7 border" style={{ borderColor: "rgba(255, 197, 120, 0.35)" }}>
          <div className="flex gap-3 text-sm text-white/70">
            <AlertTriangle size={18} strokeWidth={1.5} style={{ color: "#ffc578" }} />
            <div>
              <strong className="text-white">Guardrail reminder:</strong> autonomous channels should only ask approved service, pricing, scheduling, and form-completion questions. Do not include PHI. Escalate complex, legal, medical, or employment-determination questions to a human.
            </div>
          </div>
        </div>
      )}

      <div className="grid xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <section className="glass p-6">
          <div className="label-overline mb-4">Clinic target</div>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <input className="input-dark" placeholder="Clinic name" value={form.clinic_name} onChange={(e) => setField("clinic_name", e.target.value)} data-testid="clinic-name-input" />
            <input className="input-dark" placeholder="Contact name, optional" value={form.contact_name} onChange={(e) => setField("contact_name", e.target.value)} />
            <input className="input-dark" placeholder="Email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            <input className="input-dark" placeholder="WhatsApp number" value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} />
            <input className="input-dark" placeholder="City" value={form.city} onChange={(e) => setField("city", e.target.value)} />
            <input className="input-dark" placeholder="Country" value={form.country} onChange={(e) => setField("country", e.target.value)} />
          </div>
          <input className="input-dark mb-3" placeholder="Language" value={form.language} onChange={(e) => setField("language", e.target.value)} />
          <textarea className="input-dark min-h-[90px] mb-3" placeholder="Services needed" value={form.services_needed} onChange={(e) => setField("services_needed", e.target.value)} />
          <textarea className="input-dark min-h-[120px] mb-4" placeholder="Context / instructions" value={form.context} onChange={(e) => setField("context", e.target.value)} />
          <button className="btn-primary inline-flex items-center gap-2" onClick={generateDraft} disabled={loading} data-testid="generate-outreach-draft">
            <Wand2 size={15} strokeWidth={1.5} /> {loading ? "Working…" : "Generate Outreach Draft"}
          </button>
        </section>

        <section className="glass p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-overline mb-1">Draft output</div>
              <div className="text-sm text-white/45">Mode: {selectedAgent?.label}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost inline-flex items-center gap-2" onClick={copyDraft} disabled={!draft?.message}><Clipboard size={14} /> Copy</button>
              <button className="btn-ghost inline-flex items-center gap-2" onClick={saveThread} disabled={!draft?.message}><Send size={14} /> Log</button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 min-h-[280px] whitespace-pre-wrap text-sm text-white/80 leading-relaxed" data-testid="outreach-draft-output">
            {draft?.message || "Generated outreach message will appear here. For human mode, copy/paste it into email or WhatsApp. For autonomous modes, this is the message that would enter the approval/automation queue."}
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-2 gap-6 mt-6">
        <section className="glass p-6">
          <div className="label-overline mb-4">Paste clinic reply</div>
          <textarea className="input-dark min-h-[220px] mb-4" placeholder="Paste the clinic's email or WhatsApp reply here..." value={replyText} onChange={(e) => setReplyText(e.target.value)} data-testid="clinic-reply-input" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={parseReply} disabled={loading}>Analyze Reply</button>
            <button className="btn-ghost" onClick={generateFollowup} disabled={loading}>Draft Follow-Up</button>
          </div>
        </section>

        <section className="glass p-6">
          <div className="label-overline mb-4">Structured reply analysis</div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 min-h-[220px] text-sm text-white/75" data-testid="reply-analysis-output">
            {analysis ? (
              <div className="space-y-3">
                <Row label="Status" value={analysis.status} />
                <Row label="Confirmed" value={(analysis.confirmed_services || []).join(", ") || "—"} />
                <Row label="Unavailable" value={(analysis.unavailable_services || []).join(", ") || "—"} />
                <Row label="Pricing" value={analysis.pricing || "—"} />
                <Row label="Payment" value={analysis.payment_terms || "—"} />
                <Row label="Forms" value={analysis.forms || "—"} />
                <Row label="Follow-up" value={analysis.follow_up_needed || "—"} />
                <Row label="Summary" value={analysis.summary || "—"} />
              </div>
            ) : (
              "AI will extract services confirmed, services unavailable, pricing, payment terms, form willingness, and next follow-up from the clinic reply."
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/35 mb-1">{label}</div>
      <div className="text-white/80 leading-relaxed">{value}</div>
    </div>
  );
}
