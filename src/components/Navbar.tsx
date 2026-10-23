"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  HandCoins, 
  BookOpenCheck,
  User,
  LogOut,
  Handshake,
  MessageSquare,
} from "lucide-react";
import NotificacoesMenu from "@/components/NotificacoesMenu";
import { useSystemUiVersion } from "@/lib/theme";

export default function Navbar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const { isDark } = useSystemUiVersion();

  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/perfil")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.nome) {
          setUserName(data.user.nome);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const menuItems = [
    { name: "Início", path: "/", icon: LayoutDashboard },
    { name: "Clientes", path: "/clientes", icon: Users },
    { name: "Empréstimos", path: "/emprestimos", icon: HandCoins },
    { name: "Cheques", path: "/cheques", icon: BookOpenCheck },
    { name: "Parceiros", path: "/parceiros", icon: Handshake },
    { name: "Cobranças", path: "/cobrancas", icon: MessageSquare },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (err) {
      console.error("Erro ao sair", err);
    }
  };

  if (pathname === "/login" || pathname.startsWith("/sys-init")) {
    return null;
  }

  const mobileNavItems = [
    { name: "Início", path: "/", icon: LayoutDashboard },
    { name: "Clientes", path: "/clientes", icon: Users },
    { name: "Empréstimos", path: "/emprestimos", icon: HandCoins },
    { name: "Parceiros", path: "/parceiros", icon: Handshake },
    { name: "Cobranças", path: "/cobrancas", icon: MessageSquare },
  ];

  if (!isDark) {
    // ── VERSÃO CLÁSSICA RESTAURADA ──
    return (
      <>
        <header className="bg-[#064e3b] text-white shadow-md relative z-40">
          <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1880px] mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group active:scale-95 transition-transform min-w-0">
                <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 transition-transform duration-300 group-hover:scale-105 shrink-0">
                  <img
                    src="/shark-symbol-v3.png"
                    alt="Shark Soluções Financeiras"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain scale-[1.15] drop-shadow-[0_2px_10px_rgba(0,208,132,0.3)]"
                  />
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="font-black text-base sm:text-lg md:text-xl tracking-tight text-white leading-none drop-shadow-sm truncate">
                    Soluções<span className="hidden min-[360px]:inline text-emerald-400"> Financeiras</span>
                  </span>
                  <span className="hidden min-[380px]:block text-[9px] md:text-[10px] font-bold tracking-[0.2em] text-emerald-500/80 uppercase mt-1 truncate">
                    Gestão de Capital
                  </span>
                </div>
              </Link>

              <nav className="hidden md:flex space-x-1 bg-[#043e2f] p-1.5 rounded-full">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${
                        isActive
                          ? "bg-white text-[#064e3b] shadow-sm font-bold scale-[1.02]"
                          : "text-emerald-100 hover:text-white hover:bg-emerald-800/50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="hidden md:flex items-center space-x-3">
                <NotificacoesMenu />
                <Link 
                  href="/perfil"
                  className="flex items-center space-x-2 text-emerald-200 hover:text-white px-2.5 py-1 rounded-full hover:bg-emerald-800/50 transition-colors active:scale-95 text-xs font-semibold"
                  title={userName ? `Logado como ${userName}` : "Meu Perfil"}
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-800 border border-emerald-600/50 flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  {userName && (
                    <span className="max-w-[120px] truncate hidden lg:inline">
                      {userName}
                    </span>
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1.5 text-emerald-200 hover:text-red-300 text-sm font-medium transition-colors active:scale-95 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              </div>

              <div className="md:hidden flex items-center space-x-0.5 min-[360px]:space-x-1">
                <NotificacoesMenu />
                <Link 
                  href="/cheques"
                  className="p-1.5 min-[360px]:p-2 text-emerald-200 hover:text-white active:scale-95 transition-transform"
                  title="Cheques"
                >
                  <BookOpenCheck className="w-5 h-5" />
                </Link>
                <Link 
                  href="/perfil"
                  className="p-1.5 min-[360px]:p-2 text-emerald-200 hover:text-white active:scale-95 transition-transform"
                  title="Meu Perfil"
                >
                  <User className="w-5 h-5" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-1.5 min-[360px]:p-2 text-emerald-200 hover:text-red-300 active:scale-95 transition-transform cursor-pointer"
                  title="Sair"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 flex justify-around items-center min-h-[4rem] z-50 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 space-y-0.5 transition-all duration-200 active:scale-90 relative ${
                  isActive
                    ? "text-emerald-600"
                    : "text-slate-400 hover:text-emerald-600"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 w-8 h-0.5 bg-emerald-500 rounded-full animate-in fade-in zoom-in-90 duration-200" />
                )}
                <div className={`relative p-1 rounded-xl transition-all duration-300 ${isActive ? 'bg-emerald-50 scale-105' : ''}`}>
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </div>
                <span className={`text-[10px] tracking-wide truncate max-w-full px-0.5 transition-all ${isActive ? 'font-black' : 'font-semibold'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </>
    );
  }

  // ── NOVA VERSÃO ESCURA SHARK (BASEADA NA TELA DE LOGIN) ──
  return (
    <>
      <header className="sticky top-0 z-40 bg-[#12171d]/90 backdrop-blur-xl border-b border-white/[0.07] text-white shadow-[0_12px_36px_rgba(0,0,0,0.45)]">
        {/* Fita luminosa superior com a paleta da tela de login */}
        <div
          className="h-[2px] w-full opacity-90"
          style={{
            background:
              "linear-gradient(90deg, #022c22 0%, #059669 25%, #34d399 50%, #f59e0b 78%, #064e3b 100%)",
          }}
        />
        <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1880px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center space-x-2.5 sm:space-x-3 group active:scale-95 transition-transform min-w-0"
            >
              {/* Emblem Box igual ao da tela de login */}
              <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] bg-[#022c22]/90 border border-emerald-400/35 shadow-[0_6px_18px_rgba(0,0,0,0.45)] p-1.5 transition-transform duration-300 group-hover:scale-105 shrink-0">
                <img
                  src="/shark-symbol-v3.png"
                  alt="Shark Soluções Financeiras"
                  width={44}
                  height={44}
                  className="w-full h-full object-contain scale-110 drop-shadow-[0_2px_8px_rgba(16,185,129,0.35)]"
                />
              </div>

              <div className="flex flex-col min-w-0">
                <span className="font-black text-base sm:text-lg tracking-tight text-white leading-none truncate">
                  SHARK<span className="hidden min-[380px]:inline text-[#34d399] font-extrabold"> · Soluções</span>
                </span>
                <span className="hidden min-[380px]:block text-[9px] md:text-[10px] font-bold tracking-[0.18em] text-emerald-300/75 uppercase mt-1 truncate">
                  Soluções Financeiras
                </span>
              </div>
            </Link>

            {/* Menu Desktop — pílulas estilo Login Sheet (#1c222b + Card Face ID Gradient) */}
            <nav className="hidden md:flex items-center space-x-1 bg-[#1c222b] border border-white/[0.06] p-1.5 rounded-full shadow-inner">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.path ||
                  (item.path !== "/" && pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm transition-all duration-200 active:scale-95 ${
                      isActive
                        ? "bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-md shadow-emerald-950/60 border border-emerald-300/25 font-bold scale-[1.02]"
                        : "text-slate-300 hover:text-white hover:bg-[#232b36] font-medium"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User info / Sair - Desktop */}
            <div className="hidden md:flex items-center space-x-2.5">
              <NotificacoesMenu />
              <Link
                href="/perfil"
                className="flex items-center space-x-2 text-slate-200 hover:text-white px-3 py-1.5 rounded-full bg-[#1c222b] hover:bg-[#232b36] border border-white/[0.06] hover:border-emerald-400/30 transition-all active:scale-95 text-xs font-bold"
                title={userName ? `Logado como ${userName}` : "Meu Perfil"}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                  <User className="w-3.5 h-3.5" />
                </div>
                {userName && (
                  <span className="max-w-[120px] truncate hidden lg:inline">
                    {userName}
                  </span>
                )}
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#1c222b]/70 hover:bg-red-500/15 border border-white/[0.05] hover:border-red-500/30 text-slate-300 hover:text-red-300 text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>

            {/* Action Icons - Mobile Only (Top Bar) */}
            <div className="md:hidden flex items-center space-x-1">
              <NotificacoesMenu />
              <Link
                href="/cheques"
                className="p-2 rounded-full bg-[#1c222b] border border-white/[0.06] text-slate-200 hover:text-emerald-400 active:scale-95 transition-all"
                title="Cheques"
              >
                <BookOpenCheck className="w-4.5 h-4.5" />
              </Link>
              <Link
                href="/perfil"
                className="p-2 rounded-full bg-[#1c222b] border border-white/[0.06] text-slate-200 hover:text-emerald-400 active:scale-95 transition-all"
                title="Meu Perfil"
              >
                <User className="w-4.5 h-4.5" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 rounded-full bg-[#1c222b] border border-white/[0.06] text-slate-300 hover:text-red-400 active:scale-95 transition-all cursor-pointer"
                title="Sair"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation — Dark Sheet (#12171d) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#12171d]/95 backdrop-blur-xl border-t border-white/[0.08] flex justify-around items-center min-h-[4.25rem] z-50 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_36px_rgba(0,0,0,0.55)]">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.path ||
            (item.path !== "/" && pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 space-y-0.5 transition-all duration-200 active:scale-90 relative ${
                isActive
                  ? "text-[#34d399]"
                  : "text-slate-400 hover:text-emerald-300"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-gradient-to-r from-[#10b981] to-[#34d399] rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-in fade-in zoom-in-90 duration-200" />
              )}
              <div
                className={`relative p-1.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? "bg-emerald-500/15 border border-emerald-400/25 scale-105"
                    : ""
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? "stroke-[2.4px]" : "stroke-2"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] tracking-wide truncate max-w-full px-0.5 transition-all ${
                  isActive ? "font-black text-white" : "font-semibold"
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
