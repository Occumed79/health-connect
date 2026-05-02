import React, { useEffect, useState, useCallback } from "react";
import { listProviders } from "../lib/api";
import ProviderCard from "../components/ProviderCard";
import { Search, Filter, X, Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function ProvidersList() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [favOnly, setFavOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (specialty) params.specialty = specialty;
    if (city) params.city = city;
    if (priceMax) params.price_max = priceMax;
    if (favOnly) params.favorites_only = true;
    const data = await listProviders(params);
    setProviders(data);
    setLoading(false);
  }, [q, specialty, city, priceMax, favOnly]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const clear = () => { setQ(""); setSpecialty(""); setCity(""); setPriceMax(""); setFavOnly(false); setTimeout(load, 0); };

  return (
    <div className="fade-up">
      <div className="mb-10">
        <div className="label-overline mb-3">The Vault</div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h1 className="serif text-6xl tracking-tight">Providers</h1>
          <div className="text-sm text-white/50">{providers.length} result{providers.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid md:grid-cols-[1fr_auto] gap-3 mb-6">
        <div className="relative">
          <Search size={18} strokeWidth={1.5} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="providers-keyword-search"
            placeholder="Search by name, service, city, tag…"
            className="input-glass pl-12 py-4 text-base"
          />
        </div>
        <button data-testid="providers-search-submit" className="btn-primary">Search</button>
      </form>

      <div className="grid md:grid-cols-[240px_1fr] gap-6">
        <aside className="glass p-5 h-max" data-testid="filter-sidebar">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Filter size={14} strokeWidth={1.5} className="text-white/60" />
              <div className="label-overline">Filters</div>
            </div>
            <button onClick={clear} data-testid="clear-filters" className="text-white/50 hover:text-white">
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          <div className="space-y-4">
            <Field label="Specialty"><input value={specialty} onChange={(e) => setSpecialty(e.target.value)} data-testid="filter-specialty" className="input-glass" /></Field>
            <Field label="City"><input value={city} onChange={(e) => setCity(e.target.value)} data-testid="filter-city" className="input-glass" /></Field>
            <Field label="Max Price"><input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} data-testid="filter-price-max" className="input-glass" /></Field>

            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div className={`w-4 h-4 rounded border transition-all grid place-items-center ${favOnly ? "bg-white border-white" : "border-white/30"}`}>
                {favOnly && <Star size={10} className="fill-[#0b0d16] text-[#0b0d16]" />}
              </div>
              <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} className="hidden" data-testid="filter-favorites" />
              <span className="text-xs text-white/70 group-hover:text-white">Favorites only</span>
            </label>

            <button onClick={load} data-testid="apply-filters" className="btn-primary w-full">Apply</button>
          </div>
        </aside>

        <section>
          {loading ? (
            <div className="text-white/50">Loading…</div>
          ) : providers.length === 0 ? (
            <div className="glass p-16 text-center">
              <p className="text-white/60 mb-5">No providers match. Adjust filters or add one.</p>
              <Link to="/upload" className="btn-primary inline-block">Upload a file</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {providers.map((p) => (
                <ProviderCard key={p.id} provider={p}
                  onUpdate={(u) => setProviders((prev) => prev.map((x) => x.id === u.id ? u : x))} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="label-overline mb-1.5">{label}</div>
      {children}
    </label>
  );
}
