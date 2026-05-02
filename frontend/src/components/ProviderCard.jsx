import React from "react";
import { MapPin, Phone, ArrowUpRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { toggleFavorite } from "../lib/api";
import { toast } from "sonner";

export default function ProviderCard({ provider, onUpdate, rank, bestValueBadge }) {
  const { id, name, specialty, city, state, phone, services = [], tags = [], source_type, is_favorite } = provider;
  const prices = services.map((s) => s.price).filter((p) => typeof p === "number" && p > 0);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;

  const handleFav = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const updated = await toggleFavorite(id);
      onUpdate && onUpdate(updated);
    } catch {
      toast.error("Could not update favorite");
    }
  };

  return (
    <Link
      to={`/providers/${id}`}
      data-testid={`provider-card-${id}`}
      className="glass glass-hover relative flex flex-col h-full p-6 group"
    >
      {rank !== undefined && (
        <div className="absolute -top-3 -left-3 h-9 w-9 rounded-full grid place-items-center mono text-xs font-semibold z-10"
             style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(200,215,255,0.8))", color: "#0b0d16", boxShadow: "0 10px 28px -8px rgba(126,163,255,0.7)" }}>
          {rank}
        </div>
      )}

      <button onClick={handleFav} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 transition-colors z-10" data-testid={`fav-btn-${id}`}>
        <Star size={16} strokeWidth={1.5} className={is_favorite ? "fill-yellow-300 text-yellow-300" : "text-white/40"} />
      </button>

      <div className="mb-5 pr-8">
        {specialty && <div className="label-overline mb-2 text-[9px]" style={{ color: "var(--accent)" }}>{specialty}</div>}
        <h3 className="serif text-2xl leading-tight truncate">{name}</h3>
      </div>

      <div className="space-y-2 text-sm text-white/60 mb-5 flex-1">
        {(city || state) && (
          <div className="flex items-center gap-2">
            <MapPin size={13} strokeWidth={1.5} />
            <span className="truncate">{[city, state].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2">
            <Phone size={13} strokeWidth={1.5} />
            <span className="truncate">{phone}</span>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 pt-4 border-t border-white/10">
        <div>
          <div className="label-overline mb-1 text-[9px]">
            {services.length} service{services.length !== 1 ? "s" : ""}
          </div>
          {min !== null && (
            <div className="serif text-2xl">
              {min === max ? `$${min}` : `$${min}–$${max}`}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
          {bestValueBadge && <span className="chip chip-fav">Best Value</span>}
          {tags.slice(0, 1).map((t) => <span key={t} className="chip">{t}</span>)}
          {source_type && source_type !== "manual" && <span className="chip chip-ai">{source_type}</span>}
        </div>
      </div>

      <ArrowUpRight size={16} strokeWidth={1.5} className="absolute bottom-6 right-6 text-white/30 group-hover:text-white transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}
