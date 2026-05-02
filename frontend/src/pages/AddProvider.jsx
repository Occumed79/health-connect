import React, { useState } from "react";
import { createProvider } from "../lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";

const empty = {
  name: "", specialty: "", address: "", city: "", state: "", country: "",
  phone: "", email: "", website: "", tags: "", notes: "",
  services: [{ name: "", price: "", currency: "USD", notes: "" }],
};

export default function AddProvider() {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const nav = useNavigate();

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const updateService = (i, k, v) => setForm((p) => ({ ...p, services: p.services.map((s, idx) => idx === i ? { ...s, [k]: v } : s) }));
  const addService = () => setForm((p) => ({ ...p, services: [...p.services, { name: "", price: "", currency: "USD", notes: "" }] }));
  const removeService = (i) => setForm((p) => ({ ...p, services: p.services.filter((_, idx) => idx !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      services: form.services.filter((s) => s.name.trim()).map((s) => ({ ...s, price: s.price === "" ? null : Number(s.price) })),
    };
    try {
      const created = await createProvider(payload);
      toast.success("Provider saved");
      nav(`/providers/${created.id}`);
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-up max-w-3xl">
      <div className="mb-10">
        <div className="label-overline mb-3">Manual Entry</div>
        <h1 className="serif text-6xl mb-3 tracking-tight">Add a provider</h1>
        <p className="text-white/60">Fill in what you know. Everything except name is optional. Addresses auto-geocode.</p>
      </div>

      <form onSubmit={submit} className="glass p-8 space-y-6">
        <div className="grid md:grid-cols-2 gap-5">
          <F label="Name *"><Inp value={form.name} onChange={(v) => setField("name", v)} testid="form-name" /></F>
          <F label="Specialty"><Inp value={form.specialty} onChange={(v) => setField("specialty", v)} testid="form-specialty" /></F>
          <F label="Address" wide><Inp value={form.address} onChange={(v) => setField("address", v)} testid="form-address" /></F>
          <F label="City"><Inp value={form.city} onChange={(v) => setField("city", v)} testid="form-city" /></F>
          <F label="State"><Inp value={form.state} onChange={(v) => setField("state", v)} testid="form-state" /></F>
          <F label="Country"><Inp value={form.country} onChange={(v) => setField("country", v)} testid="form-country" /></F>
          <F label="Phone"><Inp value={form.phone} onChange={(v) => setField("phone", v)} testid="form-phone" /></F>
          <F label="Email"><Inp value={form.email} onChange={(v) => setField("email", v)} testid="form-email" /></F>
          <F label="Website"><Inp value={form.website} onChange={(v) => setField("website", v)} testid="form-website" /></F>
          <F label="Tags (comma separated)"><Inp value={form.tags} onChange={(v) => setField("tags", v)} testid="form-tags" /></F>
        </div>

        <F label="Notes">
          <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={4} className="input-glass resize-y" data-testid="form-notes" />
        </F>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="label-overline">Services & Prices</div>
            <button type="button" onClick={addService} className="text-xs inline-flex items-center gap-1 hover:underline" style={{ color: "var(--accent)" }} data-testid="add-service-btn">
              <Plus size={12} strokeWidth={1.5} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {form.services.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_80px_auto] gap-2 items-center">
                <input value={s.name} onChange={(e) => updateService(i, "name", e.target.value)} placeholder="Service name" className="input-glass py-2" data-testid={`form-service-name-${i}`} />
                <input type="number" value={s.price} onChange={(e) => updateService(i, "price", e.target.value)} placeholder="Price" className="input-glass py-2" data-testid={`form-service-price-${i}`} />
                <input value={s.currency} onChange={(e) => updateService(i, "currency", e.target.value)} className="input-glass py-2" />
                <button type="button" onClick={() => removeService(i)} className="text-red-300 p-2"><Trash2 size={14} strokeWidth={1.5} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-white/10">
          <button type="submit" disabled={saving} data-testid="submit-provider" className="btn-primary">{saving ? "Saving…" : "Save to vault"}</button>
          <button type="button" onClick={() => setForm(empty)} className="btn-ghost">Reset</button>
        </div>
      </form>
    </div>
  );
}

function F({ label, wide, children }) {
  return (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <div className="label-overline mb-1.5">{label}</div>
      {children}
    </label>
  );
}
function Inp({ value, onChange, testid }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} className="input-glass py-2" />;
}
