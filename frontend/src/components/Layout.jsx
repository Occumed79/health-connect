import React from "react";
import Sidebar from "./Sidebar";
import { Toaster } from "sonner";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen text-white relative">
      <div className="aurora" />
      <div className="aurora-extra" />
      <div className="grain" />
      <div className="relative z-10 flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-14">{children}</div>
        </main>
      </div>
      <Toaster position="top-right" theme="dark" toastOptions={{ style: { background: "rgba(20,22,35,0.9)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: "14px" } }} />
    </div>
  );
}
