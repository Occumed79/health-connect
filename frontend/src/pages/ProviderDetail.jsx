import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getProvider, deleteProvider, toggleFavorite } from "../lib/api";
import { MapPin, Phone, Mail, Globe, Tag, ArrowLeft, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const customIcon = L.divIcon({
  className: "custom-marker",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:linear-gradient(145deg,#fff,#c9d9ff);box-shadow:0 0 0 4px rgba(126,163,255,0.3),0 0 20px rgba(126,163,255,0.6);border:1px solid #fff"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function ProviderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);

  useEffect(() => { getProvider(id).then(setP).catch(() => toast.error("Provider not found")); }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Delete this provider?")) return;
    await deleteProvider(id);
    toast.success("Deleted");
    navigate("/providers");
  };

  const handleFav = async () => {
    const updated = await toggleFavorite(id);
    setP(updated);
  };

  if (!p) return <div className="text-white/50">Loading…</div>;

  return (
    <div className="fade-up">
      <Link to="/providers" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-8" data-testid="back-to-providers">
        <ArrowLeft size={16} strokeWidth={1.5} /> Back to providers
      </Link>

      <div className="grid lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-1 glass p-7">
          <div className="flex items-start justify-between mb-4">
            {p.specialty && <div className="label-overline" style={{ color: "var(--accent)" }}>{p.specialty}</div>}
            <button onClick={handleFav} className="p-1.5 rounded-full hover:bg-white/10" data-testid="fav-toggle">
              <Star size={18} strokeWidth={1.5} className={p.is_favorite ? "fill-yellow-300 text-yellow-300" : "text-white/40"} />
            </button>
          </div>
          <h1 className="serif text-5xl leading-[0.95] mb-6 tracking-tight" data-testid="provider-name">{p.name}</h1>

          <div className="space-y-3 text-sm">
            {p.address && <Detail icon={MapPin}>{[p.address, p.city, p.state, p.country].filter(Boolean).join(", ")}</Detail>}
            {p.phone && <Detail icon={Phone}><a href={`tel:${p.phone}`} className="hover:text-white" style={{ color: "var(--accent)" }}>{p.phone}</a></Detail>}
            {p.email && <Detail icon={Mail}><a href={`mailto:${p.email}`} className="hover:text-white break-all" style={{ color: "var(--accent)" }}>{p.email}</a></Detail>}
            {p.website && <Detail icon={Globe}><a href={p.website.startsWith("http") ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" className="hover:text-white break-all" style={{ color: "var(--accent)" }}>{p.website}</a></Detail>}
          </div>

          {p.tags?.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span key={t} className="chip"><Tag size={10} strokeWidth={1.5} />{t}</span>
              ))}
            </div>
          )}

          {p.notes && (
            <div className="mt-7 p-4 rounded-xl" style={{ background: "rgba(126,163,255,0.08)", border: "1px solid rgba(126,163,255,0.2)" }}>
              <div className="label-overline mb-2" style={{ color: "var(--accent)" }}>Notes</div>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{p.notes}</p>
            </div>
          )}

          {p.lat && p.lng && (
            <div className="mt-7 rounded-2xl overflow-hidden h-48">
              <MapContainer center={[p.lat, p.lng]} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
                <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                <Marker position={[p.lat, p.lng]} icon={customIcon}>
                  <Popup>{p.name}</Popup>
                </Marker>
              </MapContainer>
            </div>
          )}

          <button onClick={handleDelete} data-testid="delete-provider-btn" className="mt-8 inline-flex items-center gap-2 text-sm text-red-300 hover:text-red-200">
            <Trash2 size={14} strokeWidth={1.5} /> Delete provider
          </button>
        </div>

        <div className="lg:col-span-2 glass p-7">
          <div className="label-overline mb-4">Services & Pricing</div>
          {p.services?.length ? (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/5 text-white/50 text-xs uppercase tracking-[0.2em]">
                    <th className="text-left py-3.5 px-5 font-medium">Service</th>
                    <th className="text-left py-3.5 px-5 font-medium">Notes</th>
                    <th className="text-right py-3.5 px-5 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {p.services.map((s, i) => (
                    <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-5 text-sm">{s.name}</td>
                      <td className="py-4 px-5 text-sm text-white/50">{s.notes || "—"}</td>
                      <td className="py-4 px-5 text-sm text-right mono text-white/90">
                        {typeof s.price === "number" ? `${s.currency || "USD"} ${s.price.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center text-white/50">No services recorded.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-3 text-white/80">
      <Icon size={15} strokeWidth={1.5} className="mt-0.5 text-white/50 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
