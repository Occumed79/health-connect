import React, { useCallback, useState } from "react";
import { extractFromFile, bulkCreate } from "../lib/api";
import { FileText, Image as ImageIcon, Sheet, Sparkles, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function UploadExtract() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState([]);
  const [sourceType, setSourceType] = useState(null);
  const navigate = useNavigate();

  const onFiles = async (files) => {
    if (!files?.length) return;
    const file = files[0];
    setLoading(true);
    try {
      const res = await extractFromFile(file);
      setExtracted(res.providers || []);
      setSourceType(res.source_type);
      if (!res.providers?.length) toast.warning("No providers detected. Try a clearer file.");
      else toast.success(`Extracted ${res.providers.length} provider(s).`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }, []);

  const saveAll = async () => {
    if (!extracted.length) return;
    try {
      const created = await bulkCreate(extracted);
      toast.success(`Saved ${created.length} provider(s) to your vault.`);
      navigate("/providers");
    } catch {
      toast.error("Save failed");
    }
  };

  const updateField = (idx, field, val) => setExtracted((p) => p.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  const updateService = (pidx, sidx, field, val) => {
    setExtracted((prev) => prev.map((p, i) => {
      if (i !== pidx) return p;
      const services = [...(p.services || [])];
      services[sidx] = { ...services[sidx], [field]: field === "price" ? (val === "" ? null : Number(val)) : val };
      return { ...p, services };
    }));
  };
  const addService = (pidx) => setExtracted((p) => p.map((x, i) => i === pidx ? { ...x, services: [...(x.services || []), { name: "", price: null, currency: "USD" }] } : x));
  const removeService = (pidx, sidx) => setExtracted((p) => p.map((x, i) => i === pidx ? { ...x, services: x.services.filter((_, j) => j !== sidx) } : x));
  const removeProvider = (idx) => setExtracted((p) => p.filter((_, i) => i !== idx));

  return (
    <div className="fade-up">
      <div className="mb-10">
        <div className="label-overline mb-3">Input</div>
        <h1 className="serif text-6xl mb-4 tracking-tight">Drop it. <span className="italic" style={{ color: "var(--accent)" }}>We'll read it.</span></h1>
        <p className="text-white/60 max-w-xl">Screenshots, PDFs, Excel — Claude Sonnet 4.5 extracts clinics, addresses, services, and prices.</p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-testid="upload-zone"
        className={`glass relative block p-16 md:p-24 text-center cursor-pointer transition-all ${
          dragging ? "border-white/40" : ""
        } ${loading ? "ai-border-pulse" : ""}`}
        style={{ borderStyle: dragging ? "solid" : "dashed", borderWidth: 2 }}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf,.xlsx,.xls"
          onChange={(e) => onFiles(e.target.files)}
          className="hidden"
          disabled={loading}
          data-testid="upload-input"
        />
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-6 text-white/40">
            <ImageIcon size={30} strokeWidth={1.25} />
            <FileText size={30} strokeWidth={1.25} />
            <Sheet size={30} strokeWidth={1.25} />
          </div>
          <div className="serif text-4xl tracking-tight">{loading ? "Reading your document…" : "Drop a file, or click to browse"}</div>
          <p className="text-sm text-white/50 max-w-sm">
            {loading ? (
              <span className="inline-flex items-center gap-2"><Sparkles size={14} style={{ color: "var(--accent)" }} strokeWidth={1.5} /> Claude Sonnet 4.5 is extracting structured data.</span>
            ) : "PNG, JPEG, WEBP, PDF, XLSX"}
          </p>
        </div>
      </label>

      {extracted.length > 0 && (
        <div className="mt-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="label-overline mb-2 inline-flex items-center gap-2" style={{ color: "var(--accent)" }}>
                <Sparkles size={12} strokeWidth={1.5} /> AI Extracted · {sourceType}
              </div>
              <h2 className="serif text-4xl tracking-tight">Review & save</h2>
            </div>
            <button onClick={saveAll} data-testid="save-all-btn" className="btn-primary">Save {extracted.length} to vault</button>
          </div>

          <div className="space-y-4">
            {extracted.map((p, idx) => (
              <div key={idx} className="glass p-6 md:p-7" data-testid={`extracted-provider-${idx}`}>
                <div className="flex items-start justify-between mb-5">
                  <span className="chip chip-ai"><Sparkles size={10} strokeWidth={1.5} /> AI extracted</span>
                  <button onClick={() => removeProvider(idx)} className="text-red-300 hover:text-red-200" data-testid={`remove-extracted-${idx}`}>
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <Input label="Name *" value={p.name || ""} onChange={(v) => updateField(idx, "name", v)} testid={`ext-name-${idx}`} />
                  <Input label="Specialty" value={p.specialty || ""} onChange={(v) => updateField(idx, "specialty", v)} />
                  <Input label="Address" value={p.address || ""} onChange={(v) => updateField(idx, "address", v)} />
                  <Input label="City" value={p.city || ""} onChange={(v) => updateField(idx, "city", v)} />
                  <Input label="State" value={p.state || ""} onChange={(v) => updateField(idx, "state", v)} />
                  <Input label="Phone" value={p.phone || ""} onChange={(v) => updateField(idx, "phone", v)} />
                  <Input label="Email" value={p.email || ""} onChange={(v) => updateField(idx, "email", v)} />
                  <Input label="Website" value={p.website || ""} onChange={(v) => updateField(idx, "website", v)} />
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <div className="label-overline">Services</div>
                  <button onClick={() => addService(idx)} className="text-xs inline-flex items-center gap-1 hover:underline" style={{ color: "var(--accent)" }}>
                    <Plus size={12} strokeWidth={1.5} /> Add service
                  </button>
                </div>
                <div className="space-y-2">
                  {(p.services || []).map((s, sidx) => (
                    <div key={sidx} className="grid grid-cols-[1fr_100px_80px_auto] gap-2 items-center">
                      <input value={s.name || ""} onChange={(e) => updateService(idx, sidx, "name", e.target.value)} placeholder="Service" className="input-glass py-2" />
                      <input type="number" value={s.price ?? ""} onChange={(e) => updateService(idx, sidx, "price", e.target.value)} placeholder="Price" className="input-glass py-2" />
                      <input value={s.currency || "USD"} onChange={(e) => updateService(idx, sidx, "currency", e.target.value)} className="input-glass py-2" />
                      <button onClick={() => removeService(idx, sidx)} className="text-red-300 p-2">
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, testid }) {
  return (
    <label className="block">
      <div className="label-overline mb-1.5">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} className="input-glass py-2" />
    </label>
  );
}
