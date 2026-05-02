import React, { useState } from "react";
import { aiSearch } from "../lib/api";
import ProviderCard from "../components/ProviderCard";
import { Sparkles, Search } from "lucide-react";
import { toast } from "sonner";

const examples = [
  "Cheapest MRI in Miami under $500",
  "Best rated dermatologists for acne",
  "Dental cleanings under $100 near me",
  "Top pediatricians with weekend hours",
];

export default function AiSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);

  const run = async (q) => {
    const question = (q ?? query).trim();
    if (!question) return;
    setLoading(true);
    try {
      const data = await aiSearch(question);
      setRes(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-up">
      <div className="mb-10">
        <div className="label-overline mb-3 inline-flex items-center gap-2" style={{ color: "var(--accent)" }}>
          <Sparkles size={12} strokeWidth={1.5} /> Natural Language
        </div>
        <h1 className="serif text-6xl md:text-7xl mb-4 leading-[0.92] tracking-tight">Ask your <span className="italic" style={{ color: "var(--accent)" }}>vault</span> anything.</h1>
        <p className="text-white/60 max-w-xl text-lg">Type like you'd text a smart friend. We'll rank the best options with reasoning.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="mb-5">
        <div className={`glass relative ${loading ? "ai-border-pulse" : ""}`} style={{ padding: 6 }}>
          <Sparkles size={20} strokeWidth={1.5} className="absolute left-6 top-1/2 -translate-y-1/2" style={{ color: "var(--accent)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Cheapest dermatologist under $150 in Austin"
            data-testid="ai-search-input"
            className="w-full bg-transparent pl-14 pr-32 py-4 text-lg outline-none placeholder:text-white/30 border-none"
          />
          <button data-testid="ai-search-submit" className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2">
            <Search size={14} strokeWidth={1.5} /> {loading ? "Thinking…" : "Ask"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 mb-12">
        {examples.map((ex) => (
          <button key={ex} onClick={() => { setQuery(ex); run(ex); }} className="chip hover:border-white/30 hover:bg-white/10 transition-colors">
            {ex}
          </button>
        ))}
      </div>

      {res && (
        <div>
          <div className="glass p-5 mb-8" style={{ borderColor: "rgba(126,163,255,0.3)" }}>
            <div className="label-overline mb-2" style={{ color: "var(--accent)" }}>Interpretation</div>
            <p className="text-white/90 mb-3">{res.interpretation || "—"}</p>
            {res.reasoning && (
              <>
                <div className="label-overline mb-2 mt-4" style={{ color: "var(--accent)" }}>Reasoning</div>
                <p className="text-sm text-white/60">{res.reasoning}</p>
              </>
            )}
          </div>

          {res.results.length === 0 ? (
            <div className="glass p-16 text-center text-white/50">No matches. Try broadening your query or add more providers.</div>
          ) : (
            <>
              <div className="label-overline mb-4">{res.results.length} ranked result{res.results.length !== 1 ? "s" : ""}</div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {res.results.map((p, i) => <ProviderCard key={p.id} provider={p} rank={i + 1} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
