"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useSystemUiVersion } from "@/lib/theme";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isDark } = useSystemUiVersion();
  const isSysInit = pathname?.startsWith("/sys-init");
  const isLogin = pathname === "/login";

  if (isSysInit) {
    return (
      <div className="min-h-screen w-full bg-[#060d0b] text-white selection:bg-emerald-500/30 selection:text-emerald-200 sys-scrollbar">
        {children}
      </div>
    );
  }

  if (isLogin) {
    return (
      <main className="fixed inset-0 w-full h-[100dvh] overflow-hidden overscroll-none bg-[#12171d]">
        {children}
      </main>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col relative transition-colors duration-300 ${
        isDark
          ? "shark-shell-dark bg-[#0d1218] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200"
          : "shark-shell-classic bg-slate-50 text-slate-900"
      }`}
    >
      {/* Ambient Emerald Glow & Topographic Backdrop (Login Screen DNA — Dark Mode Only) */}
      {isDark && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[980px] h-[420px] rounded-full opacity-55 blur-[110px]"
            style={{
              background:
                "radial-gradient(circle, rgba(5, 150, 105, 0.24) 0%, rgba(6, 78, 59, 0.12) 55%, transparent 100%)",
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-[520px] h-[520px] rounded-full opacity-30 blur-[120px]"
            style={{
              background:
                "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 75%)",
            }}
          />
        </div>
      )}

      <Navbar />
      <main className="relative z-10 flex-grow w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1880px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  );
}
