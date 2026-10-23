"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
    <>
      <Navbar />
      <main className="flex-grow w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1880px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-24 md:pb-8">
        {children}
      </main>
    </>
  );
}
