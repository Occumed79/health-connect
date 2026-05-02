import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Database, Upload, Plus, Sparkles, MapPinned, Trophy, Stethoscope, BotMessageSquare } from "lucide-react";

const items = [
  { to: "/", icon: LayoutDashboard, label: "Overview", testid: "nav-dashboard" },
  { to: "/providers", icon: Database, label: "Providers", testid: "nav-providers" },
  { to: "/outreach", icon: BotMessageSquare, label: "Outreach Agents", testid: "nav-outreach" },
  { to: "/map", icon: MapPinned, label: "Map", testid: "nav-map" },
  { to: "/best-value", icon: Trophy, label: "Best Value", testid: "nav-best-value" },
  { to: "/search", icon: Sparkles, label: "AI Search", testid: "nav-search" },
  { to: "/upload", icon: Upload, label: "Upload & Extract", testid: "nav-upload" },
  { to: "/add", icon: Plus, label: "Add Manually", testid: "nav-add" },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 sticky top-0 h-screen flex-col p-5" data-testid="sidebar">
      <div className="glass-strong flex-1 flex flex-col p-5">
        <div className="px-2 py-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl grid place-items-center"
                 style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(200,215,255,0.7))", boxShadow: "inset 0 1px 0 rgba(255,255,255,1), 0 8px 24px -8px rgba(126,163,255,0.6)" }}>
              <Stethoscope size={19} strokeWidth={1.75} className="text-[#0b0d16]" />
            </div>
            <div>
              <div className="serif text-2xl leading-none tracking-tight">Provi<span className="italic" style={{ color: "var(--accent)" }}>dex</span></div>
              <div className="label-overline mt-1 text-[9px]">Medical Intelligence</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {items.map(({ to, icon: Icon, label, testid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? "bg-white/10 text-white border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                    : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                }`
              }
            >
              <Icon size={17} strokeWidth={1.5} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="label-overline mb-2 text-[9px]">Private Vault</div>
          <p className="text-xs text-white/50 leading-relaxed">
            Your personal, AI-organized intelligence of medical providers and pricing.
          </p>
        </div>
      </div>
    </aside>
  );
}
