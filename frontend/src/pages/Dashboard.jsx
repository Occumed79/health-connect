import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStats, listProviders, exportCsvUrl } from "../lib/api";
import { Upload, Sparkles, Database, TrendingUp, ArrowUpRight, Plus, MapPinned, Trophy, Download, Star } from "lucide-react";
import ProviderCard from "../components/ProviderCard";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    listProviders({ limit: 3 }).then(setRecent).catch(() => setRecent([]));
  }, []);

  return (
    <div className="fade-up">
      <div className="mb-14">
        <div className="label-overline mb-5">Overview · Private Vault</div>
        <h1 className="serif text-6xl md:text-7xl leading-[0.92] mb-6 max-w-4xl tracking-tight">
          A luminous intelligence for <span className="italic" style={{ color: "var(--accent)" }}>medical pricing</span> & providers.
        </h1>
        <p className="text-white/60 text-lg max-w-2xl leading-relaxed">
          Drop screenshots, PDFs, or spreadsheets. Claude Sonnet 4.5 organizes the chaos.
          Ask anything in plain English — surface your best options, mapped & ranked.
        </p>
      </div>

      {/* Stats bento */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10" data-testid="stats-grid">
        <Stat label="Providers" value={stats?.total_providers ?? "—"} icon={Database} />
        <Stat label="Services" value={stats?.total_services ?? "—"} icon={TrendingUp} />
        <Stat label="Avg Price" value={stats?.avg_service_price ? `$${Math.round(stats.avg_service_price)}` : "—"} icon={TrendingUp} />
        <Stat label="Favorites" value={stats?.favorites ?? "—"} icon={Star} />
        <Stat label="Cities" value={stats?.cities?.length ?? "—"} icon={MapPinned} />
      </div>

      {/* Actions — primary big hero + 4 small */}
      <div className="grid md:grid-cols-5 gap-3 mb-16">
        <ActionCard to="/search" icon={Sparkles} title="Ask AI" body='"Cheapest MRI under $500 in Miami"' hero testid="action-search" />
        <ActionCard to="/upload" icon={Upload} title="Upload" body="Image · PDF · Excel" testid="action-upload" />
        <ActionCard to="/map" icon={MapPinned} title="Map" body="Geo view of all providers" testid="action-map" />
        <ActionCard to="/best-value" icon={Trophy} title="Best Value" body="Lowest price per service" testid="action-best-value" />
        <ActionCard to="/add" icon={Plus} title="Add" body="Manual entry" testid="action-add" />
      </div>

      {/* Recent */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="label-overline mb-2">Recently Added</div>
          <h2 className="serif text-4xl">Latest in the vault</h2>
        </div>
        <div className="flex gap-2">
          <a href={exportCsvUrl} download className="btn-ghost inline-flex items-center gap-2" data-testid="export-csv-btn">
            <Download size={14} strokeWidth={1.5} /> Export CSV
          </a>
          <Link to="/providers" data-testid="view-all-providers" className="btn-ghost inline-flex items-center gap-2">
            View all <ArrowUpRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      {recent.length === 0 ? (
        <div className="glass p-16 text-center">
          <p className="text-white/60 mb-5">Your vault is empty. Drop a file or add your first provider.</p>
          <Link to="/upload" data-testid="empty-state-upload" className="btn-primary inline-block">Upload a file</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recent.map((p) => <ProviderCard key={p.id} provider={p} />)}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="glass p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="label-overline">{label}</div>
        <Icon size={14} strokeWidth={1.5} className="text-white/40" />
      </div>
      <div className="serif text-4xl tracking-tight">{value}</div>
    </div>
  );
}

function ActionCard({ to, icon: Icon, title, body, hero, testid }) {
  return (
    <Link
      to={to}
      data-testid={testid}
      className={`group glass glass-hover specular p-6 flex flex-col justify-between ${hero ? "md:col-span-2 md:row-span-1" : ""}`}
      style={hero ? { background: "linear-gradient(145deg, rgba(126,163,255,0.18), rgba(201,166,255,0.12))", borderColor: "rgba(126,163,255,0.4)" } : {}}
    >
      <Icon size={hero ? 32 : 22} strokeWidth={1.25} style={{ color: hero ? "var(--accent)" : "rgba(255,255,255,0.8)" }} />
      <div className="mt-6">
        <h3 className={`serif ${hero ? "text-3xl" : "text-xl"} tracking-tight`}>{title}</h3>
        <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{body}</p>
      </div>
    </Link>
  );
}
