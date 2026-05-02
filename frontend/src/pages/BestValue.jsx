import React, { useEffect, useState } from "react";
import { getBestValue } from "../lib/api";
import { Link } from "react-router-dom";
import { Trophy, ArrowUpRight } from "lucide-react";

export default function BestValue() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBestValue().then((r) => { setRows(r); setLoading(false); }); }, []);

  return (
    <div className="fade-up">
      <div className="mb-10">
        <div className="label-overline mb-3 inline-flex items-center gap-2" style={{ color: "var(--accent)" }}>
          <Trophy size={12} strokeWidth={1.5} /> Negotiation Intelligence
        </div>
        <h1 className="serif text-6xl tracking-tight mb-3">Best Value</h1>
        <p className="text-white/60 max-w-xl">Lowest known price for each service across your vault. Use these as baselines when negotiating.</p>
      </div>

      {loading ? (
        <div className="text-white/50">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="glass p-16 text-center text-white/60">
          No priced services yet. Add providers with service prices to see winners.
        </div>
      ) : (
        <div className="glass p-2 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-white/50 text-xs uppercase tracking-[0.2em] border-b border-white/10">
                <th className="text-left py-4 px-5 font-medium">Service</th>
                <th className="text-left py-4 px-5 font-medium">Best Provider</th>
                <th className="text-left py-4 px-5 font-medium">City</th>
                <th className="text-right py-4 px-5 font-medium">Lowest Price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="py-4 px-5 text-sm font-medium" data-testid={`bv-service-${i}`}>{r.service_name}</td>
                  <td className="py-4 px-5 text-sm">
                    <Link to={`/providers/${r.provider_id}`} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--accent)" }}>
                      {r.provider_name} <ArrowUpRight size={12} strokeWidth={1.5} />
                    </Link>
                  </td>
                  <td className="py-4 px-5 text-sm text-white/60">{r.city || "—"}</td>
                  <td className="py-4 px-5 text-sm text-right mono">
                    <span className="chip chip-fav">{r.currency || "USD"} {r.price?.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
