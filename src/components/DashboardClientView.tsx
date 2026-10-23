"use client";

import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  AlertCircle,
  Plus,
  Users,
  ArrowUpRight,
  Wallet,
  BadgeDollarSign,
  BarChart3,
  Sparkles,
  Clock3,
  CheckCircle2,
  Target,
  ShieldCheck,
} from "lucide-react";
import { ProjecaoBarChart } from "@/components/ProjecaoBarChart";
import { CarteiraPieChart } from "@/components/CarteiraPieChart";
import { useSystemUiVersion } from "@/lib/theme";

export interface MesProjecaoItem {
  year: number;
  month: number;
  label: string;
  valor: number;
}

export interface ParceiroResumoItem {
  nome: string;
  total: number;
  count: number;
}

export interface DashboardMetricsProps {
  dataFormatada: string;
  anoAtual: number;
  totalEmprestado: number;
  totalAReceber: number;
  lucroEstimado: number;
  emprestimosAtivosCount: number;
  ativosEmDiaCount: number;
  totalAtrasadosCount: number;
  atrasadosOntemCount: number;
  atrasadosAnterioresCount: number;
  vencendoHojeCount: number;
  receberHoje: number;
  receberSemana: number;
  receberMes: number;
  receberAno: number;
  receberProprio: number;
  receberParceiros: number;
  totalRecebiveisCalculados: number;
  pctProprio: number;
  pctParceiros: number;
  mesesProjecao: MesProjecaoItem[];
  ganhoTotal: number;
  ganhoMesAtual: number;
  ganhoAnoAtual: number;
  faturadoTotal: number;
  emprestimosQuitadosCount: number;
  totalEmprestimosGeral: number;
  taxaSucesso: number;
  ticketMedioQuitado: number;
  parceirosList: ParceiroResumoItem[];
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function DashboardClientView(props: DashboardMetricsProps) {
  const { isClassic } = useSystemUiVersion();

  const {
    dataFormatada,
    anoAtual,
    totalEmprestado,
    totalAReceber,
    lucroEstimado,
    emprestimosAtivosCount,
    ativosEmDiaCount,
    totalAtrasadosCount,
    atrasadosOntemCount,
    atrasadosAnterioresCount,
    vencendoHojeCount,
    receberHoje,
    receberSemana,
    receberMes,
    receberAno,
    receberProprio,
    receberParceiros,
    totalRecebiveisCalculados,
    pctProprio,
    pctParceiros,
    mesesProjecao,
    ganhoTotal,
    ganhoMesAtual,
    ganhoAnoAtual,
    faturadoTotal,
    emprestimosQuitadosCount,
    totalEmprestimosGeral,
    taxaSucesso,
    ticketMedioQuitado,
    parceirosList,
  } = props;

  // ══════════════════════════════════════════════════════════════════════════
  // VERSÃO CLÁSSICA RESTAURADA (LIGHT MODE COM PALETA HARMONIZADA)
  // ══════════════════════════════════════════════════════════════════════════
  if (isClassic) {
    return (
      <div className="space-y-8 w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1880px] mx-auto px-1 animate-fade-in text-zinc-900">
        {/* ── CABEÇALHO ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Ao vivo</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Painel Geral
            </h1>
            <p className="text-sm sm:text-base text-slate-500 mt-1 capitalize">{dataFormatada}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Link
              href="/clientes/novo"
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 border border-zinc-200 bg-white text-slate-700 hover:bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 text-center"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Novo Cliente</span>
            </Link>
            <Link
              href="/emprestimos/novo"
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 text-center"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Novo Empréstimo</span>
            </Link>
          </div>
        </div>

        {/* ── ROW 1: CAPITAL + A RECEBER ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Link
            href="/emprestimos"
            className="relative overflow-hidden bg-white card-accent border border-zinc-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-400">
                Capital em Campo
              </span>
              <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center group-hover:bg-zinc-200 transition-colors">
                <Wallet className="w-4 h-4 text-zinc-600" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 leading-none break-words">
              {formatBRL(totalEmprestado)}
            </div>
            <div className="mt-3 text-xs sm:text-sm text-zinc-400 flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-emerald-600">{ativosEmDiaCount} em dia</span>
                <span className="text-zinc-300">•</span>
                <span className="font-bold text-red-600">{totalAtrasadosCount} atrasados</span>
                <span className="text-xs text-zinc-400">({emprestimosAtivosCount} total)</span>
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-zinc-100/50 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
          </Link>

          <Link
            href="/emprestimos"
            className="relative overflow-hidden bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm hover:shadow-emerald-500/10 hover:shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-emerald-600">
                A Receber
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 leading-none break-words">
              {formatBRL(totalAReceber)}
            </div>
            <div className="mt-3 text-xs sm:text-sm text-zinc-400 flex items-center justify-between flex-wrap gap-2">
              <span>
                Juros incluso: <span className="text-emerald-500 font-bold">{formatBRL(lucroEstimado)}</span>
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
            </div>
            <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-emerald-50/50 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
          </Link>
        </div>

        {/* ── ROW 2: ALERTAS (3 cards) ── */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4">
          <Link
            href="/emprestimos?filtro=hoje"
            className="relative overflow-hidden bg-white border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-amber-500/10 hover:shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-600 truncate">
                Vencendo Hoje
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors shrink-0">
                <Clock3 className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-amber-600 leading-none">
              {vencendoHojeCount}
            </div>
            <div className="mt-2 text-xs sm:text-sm text-zinc-400 flex items-center justify-between">
              <span className="truncate">{vencendoHojeCount === 1 ? "vence hoje" : "vencem hoje"}</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500 shrink-0" />
            </div>
          </Link>

          <Link
            href="/cobrancas?filtro=ontem"
            className="relative overflow-hidden bg-white border border-orange-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-orange-500/10 hover:shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-orange-500 truncate">
                Atrasados Ontem
              </span>
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors shrink-0">
                <Clock3 className="w-4 h-4 text-orange-500" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-orange-600 leading-none">
              {atrasadosOntemCount}
            </div>
            <div className="mt-2 text-xs sm:text-sm text-zinc-400 flex items-center justify-between">
              <span className="truncate">{atrasadosOntemCount === 1 ? "venceu ontem" : "venceram ontem"}</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-orange-500 shrink-0" />
            </div>
          </Link>

          <Link
            href="/cobrancas?filtro=anteriores"
            className="relative overflow-hidden bg-white border border-red-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-red-500/10 hover:shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer active:scale-[0.98]"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-red-600 truncate">
                Atrasados Anteriores
              </span>
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors shrink-0">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <div className="flex items-end justify-between gap-1">
              <div>
                <div className="text-xl sm:text-2xl font-black tracking-tight text-red-600 leading-none">
                  {atrasadosAnterioresCount}
                </div>
                <div className="mt-2 text-xs sm:text-sm text-zinc-400 flex items-center gap-1.5">
                  <span className="truncate">há 2+ dias</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 shrink-0" />
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] sm:text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                  Total: {totalAtrasadosCount}
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* ── ROW 3: RECEBÍVEIS POR PERÍODO ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
            <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest">
              Recebíveis por Período
            </h2>
          </div>
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: "Hoje", value: receberHoje, accent: "border-l-amber-500", text: "text-amber-600" },
              { label: "Esta semana (7d)", value: receberSemana, accent: "border-l-emerald-500", text: "text-emerald-600" },
              { label: "No mês (30d)", value: receberMes, accent: "border-l-teal-500", text: "text-teal-600" },
              { label: "No ano (365d)", value: receberAno, accent: "border-l-emerald-700", text: "text-emerald-800" },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`bg-white card-accent border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-sm border-l-4 ${item.accent} hover:shadow-md transition-all`}
              >
                <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-400">
                  {item.label}
                </span>
                <div className={`text-lg sm:text-2xl font-black mt-2 leading-none break-words ${item.text}`}>
                  {formatBRL(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ROW 4: GRÁFICOS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white card-accent border border-zinc-200 rounded-2xl p-6 lg:col-span-2 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                Projeção de Recebimentos
              </h3>
              <span className="text-sm font-bold text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full">
                Próximos 6 meses
              </span>
            </div>
            <ProjecaoBarChart data={mesesProjecao} />
          </div>

          <div className="bg-white card-accent border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                Distribuição de Carteira
              </h3>
              <CarteiraPieChart
                receberProprio={receberProprio}
                receberParceiros={receberParceiros}
                totalRecebivel={totalRecebiveisCalculados}
                pctProprio={pctProprio}
                pctParceiros={pctParceiros}
              />
              <div className="space-y-2.5 mt-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 shadow-sm shadow-emerald-500/50" />
                    <span className="text-zinc-500">Capital Próprio</span>
                    <span className="text-sm font-black text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">
                      {pctProprio.toFixed(0)}%
                    </span>
                  </div>
                  <span className="font-black text-zinc-900 text-sm">{formatBRL(receberProprio)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0 shadow-sm shadow-amber-500/50" />
                    <span className="text-zinc-500">Parceiros</span>
                    <span className="text-sm font-black text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">
                      {pctParceiros.toFixed(0)}%
                    </span>
                  </div>
                  <span className="font-black text-zinc-900 text-sm">{formatBRL(receberParceiros)}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-zinc-200/60 pt-3 mt-4 flex items-center justify-between">
              <span className="text-zinc-400 uppercase text-sm font-black">Total Recebível</span>
              <span className="font-black text-emerald-600 text-sm">{formatBRL(totalRecebiveisCalculados)}</span>
            </div>
          </div>
        </div>

        {/* ── ROW 5: GANHOS & FATURAMENTO ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest">
              Ganhos & Faturamento Real
            </h2>
            <span className="text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
              Baseado em quitados
            </span>
          </div>
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="col-span-1 relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 shadow-lg shadow-emerald-500/25 text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs sm:text-sm font-black uppercase tracking-widest opacity-80">
                  Juros Ganhos (Total)
                </span>
                <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center">
                  <BadgeDollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black leading-none break-words">
                {formatBRL(ganhoTotal)}
              </div>
              <div className="mt-2 text-xs sm:text-sm opacity-70">
                De {emprestimosQuitadosCount} contratos quitados
              </div>
              <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
            </div>

            <div className="col-span-1 relative overflow-hidden bg-white card-accent border border-zinc-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-400">
                  Faturado Este Mês
                </span>
                <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black leading-none text-emerald-600 break-words">
                {formatBRL(ganhoMesAtual)}
              </div>
              <div className="mt-2 text-xs sm:text-sm text-zinc-400">Parcelas quitadas no mês</div>
            </div>

            <div className="col-span-1 relative overflow-hidden bg-white card-accent border border-zinc-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-400">
                  Faturado Este Ano
                </span>
                <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center">
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black leading-none text-amber-600 break-words">
                {formatBRL(ganhoAnoAtual)}
              </div>
              <div className="mt-2 text-xs sm:text-sm text-zinc-400">
                Parcelas quitadas em {anoAtual}
              </div>
            </div>

            <div className="col-span-1 relative overflow-hidden bg-white card-accent border border-zinc-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-400">
                  Taxa de Quitação
                </span>
                <div className="w-7 h-7 rounded-xl bg-teal-50 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                </div>
              </div>
              <div className="text-2xl font-black leading-none text-teal-600">
                {taxaSucesso.toFixed(1)}%
              </div>
              <div className="mt-1.5 w-full bg-zinc-100 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all duration-700"
                  style={{ width: `${taxaSucesso}%` }}
                />
              </div>
              <div className="mt-1.5 text-xs sm:text-sm text-zinc-400">
                {emprestimosQuitadosCount} de {totalEmprestimosGeral} contratos
              </div>
            </div>
          </div>

          <div className="bg-white card-accent border border-zinc-200 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6 items-start sm:items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Target className="w-4.5 h-4.5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-400">
                    Total Faturado (Bruto)
                  </div>
                  <div className="text-lg sm:text-xl font-black text-zinc-900 leading-tight">
                    {formatBRL(faturadoTotal)}
                  </div>
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-200 hidden sm:block" />
              <div className="h-px w-full bg-zinc-100 sm:hidden" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <BadgeDollarSign className="w-4.5 h-4.5 text-teal-600" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-400">
                    Lucro Potencial (Carteira Ativa)
                  </div>
                  <div className="text-lg sm:text-xl font-black text-teal-600 leading-tight">
                    {formatBRL(lucroEstimado)}
                  </div>
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-200 hidden sm:block" />
              <div className="h-px w-full bg-zinc-100 sm:hidden" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4.5 h-4.5 text-amber-500" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-400">
                    Ticket Médio (Quitados)
                  </div>
                  <div className="text-lg sm:text-xl font-black text-amber-600 leading-tight">
                    {formatBRL(ticketMedioQuitado)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 6: PARCEIROS ── */}
        {parceirosList.length > 0 && (
          <div className="bg-white card-accent border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              Recebíveis por Parceiros
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-3 sm:gap-4">
              {parceirosList.map((p, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col justify-between hover:border-amber-300 transition-all"
                >
                  <span className="text-sm font-black text-slate-700 truncate">{p.nome}</span>
                  <div className="mt-3 flex items-end justify-between">
                    <span className="text-sm font-black text-amber-600">{formatBRL(p.total)}</span>
                    <span className="text-xs text-zinc-400 font-bold">{p.count} parcelas</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOVA VERSÃO ROSTO DO SISTEMA — TEMA ESCURO SHARK (INSPIRADO NO LOGIN)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-7 w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1880px] mx-auto px-1 animate-fade-in text-slate-100">
      {/* ── HERO BANNER SHARK (DNA VISUAL DA TELA DE LOGIN) ── */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#065f46] via-[#047857] to-[#022c22] border border-emerald-500/20 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.75)]">
        {/* Linhas Topográficas Suaves */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.14] pointer-events-none select-none"
          viewBox="0 0 1200 320"
          preserveAspectRatio="none"
        >
          <path
            d="M-100,60 C250,160 550,-40 900,80 C1050,130 1150,40 1300,90"
            fill="none"
            stroke="#6ee7b7"
            strokeWidth="1.5"
          />
          <path
            d="M-100,130 C300,230 600,10 950,150 C1100,210 1180,100 1300,160"
            fill="none"
            stroke="#34d399"
            strokeWidth="1.2"
          />
          <path
            d="M-100,210 C220,90 640,260 980,120 C1120,70 1200,190 1300,140"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
        </svg>

        {/* Brilho Radial Esmeralda & Dourado */}
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(52,211,153,0.22) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-28 right-1/4 w-80 h-80 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 70%)",
          }}
        />

        {/* Fitas Curvas Multicoloridas no canto direito (Assinatura da Tela de Login) */}
        <div className="absolute right-0 top-0 bottom-0 w-72 sm:w-96 pointer-events-none overflow-hidden opacity-85 hidden sm:block">
          <svg
            className="w-full h-full"
            viewBox="0 0 400 260"
            preserveAspectRatio="none"
          >
            <path d="M160,-20 Q280,110 420,40 L420,280 L160,280 Z" fill="#022c22" fillOpacity="0.55" />
            <path d="M210,-20 Q310,130 420,80 L420,280 L210,280 Z" fill="#f59e0b" fillOpacity="0.85" />
            <path d="M245,-20 Q335,145 420,105 L420,280 L245,280 Z" fill="#ffffff" fillOpacity="0.9" />
            <path d="M275,-20 Q355,160 420,130 L420,280 L275,280 Z" fill="#6ee7b7" fillOpacity="0.85" />
            <path d="M310,-20 Q375,180 420,165 L420,280 L310,280 Z" fill="#0d1218" fillOpacity="0.92" />
          </svg>
        </div>

        {/* Conteúdo do Hero */}
        <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#022c22]/70 border border-emerald-400/25 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse shadow-[0_0_8px_#34d399]" />
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-[0.18em]">
                Painel Operacional Ao Vivo
              </span>
              <span className="text-emerald-600">•</span>
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Shark Dark
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight drop-shadow-sm">
              Visão Geral da Carteira
            </h1>
            <p className="text-xs sm:text-sm font-medium text-emerald-100/80 capitalize">
              {dataFormatada} — Acompanhamento em tempo real de capital, recebíveis e liquidez
            </p>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <Link
              href="/clientes/novo"
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-[#12171d]/90 hover:bg-[#1c222b] text-white border border-white/10 hover:border-emerald-400/40 px-4 sm:px-5 py-3 rounded-2xl text-xs sm:text-sm font-extrabold tracking-wide transition-all shadow-lg active:scale-95 text-center backdrop-blur-md"
            >
              <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Novo Cliente</span>
            </Link>
            <Link
              href="/emprestimos/novo"
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-gradient-to-r from-[#f59e0b] to-[#d97706] hover:from-[#fbbf24] hover:to-[#f59e0b] text-[#0d1218] px-4 sm:px-5 py-3 rounded-2xl text-xs sm:text-sm font-black tracking-wide transition-all shadow-[0_12px_28px_-6px_rgba(245,158,11,0.45)] active:scale-95 text-center"
            >
              <Plus className="w-4 h-4 stroke-[2.75] shrink-0" />
              <span>Novo Empréstimo</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── ROW 1: CAPITAL EM CAMPO + TOTAL A RECEBER ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Capital em Campo */}
        <Link
          href="/emprestimos"
          className="relative overflow-hidden bg-[#12171d] border border-white/[0.07] hover:border-emerald-500/35 rounded-[1.75rem] p-6 shadow-[0_16px_40px_-15px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 transition-all group cursor-pointer active:scale-[0.99]"
        >
          {/* Barra superior sutil esmeralda */}
          <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Capital em Campo
            </span>
            <div className="w-10 h-10 rounded-2xl bg-[#1c222b] border border-white/[0.06] flex items-center justify-center group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10 transition-colors">
              <Wallet className="w-4.5 h-4.5 text-emerald-400" />
            </div>
          </div>

          <div className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-none break-words">
            {formatBRL(totalEmprestado)}
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] text-xs sm:text-sm text-slate-400 flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs">
                {ativosEmDiaCount} em dia
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full text-xs">
                {totalAtrasadosCount} atrasados
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                ({emprestimosAtivosCount} ativos)
              </span>
            </span>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
        </Link>

        {/* Total a Receber */}
        <Link
          href="/emprestimos"
          className="relative overflow-hidden bg-gradient-to-br from-[#12171d] via-[#12171d] to-[#064e3b]/40 border border-emerald-500/25 hover:border-emerald-400/50 rounded-[1.75rem] p-6 shadow-[0_16px_40px_-15px_rgba(16,185,129,0.18)] hover:-translate-y-0.5 transition-all group cursor-pointer active:scale-[0.99]"
        >
          <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-amber-400/70" />

          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400">
              Total a Receber
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-400" />
            </div>
          </div>

          <div className="text-2xl sm:text-4xl font-black tracking-tight text-emerald-400 leading-none break-words">
            {formatBRL(totalAReceber)}
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] text-xs sm:text-sm text-slate-400 flex items-center justify-between flex-wrap gap-2">
            <span>
              Juros projetados:{" "}
              <span className="text-amber-400 font-extrabold">{formatBRL(lucroEstimado)}</span>
            </span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
        </Link>
      </div>

      {/* ── ROW 2: ALERTAS OPERACIONAIS (HOJE / ONTEM / ANTERIORES) ── */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Vencendo Hoje — Âmbar / Ouro */}
        <Link
          href="/emprestimos?filtro=hoje"
          className="relative overflow-hidden bg-[#12171d] border border-amber-500/25 hover:border-amber-400/50 rounded-2xl p-5 shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-amber-400 truncate">
              Vencendo Hoje
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
              <Clock3 className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-none">
            {vencendoHojeCount}
          </div>
          <div className="mt-2.5 text-xs text-slate-400 flex items-center justify-between">
            <span className="truncate">{vencendoHojeCount === 1 ? "contrato vence hoje" : "contratos vencem hoje"}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-400 opacity-70 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </Link>

        {/* Atrasados Ontem — Laranja Quente */}
        <Link
          href="/cobrancas?filtro=ontem"
          className="relative overflow-hidden bg-[#12171d] border border-orange-500/25 hover:border-orange-400/50 rounded-2xl p-5 shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-orange-400 truncate">
              Atrasados Ontem
            </span>
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
              <Clock3 className="w-4 h-4 text-orange-400" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-none">
            {atrasadosOntemCount}
          </div>
          <div className="mt-2.5 text-xs text-slate-400 flex items-center justify-between">
            <span className="truncate">{atrasadosOntemCount === 1 ? "venceu ontem" : "venceram ontem"}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-orange-400 opacity-70 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </Link>

        {/* Atrasados Anteriores — Vermelho Puro (Sem Rosa) */}
        <Link
          href="/cobrancas?filtro=anteriores"
          className="relative overflow-hidden bg-[#12171d] border border-red-500/25 hover:border-red-400/50 rounded-2xl p-5 shadow-lg hover:-translate-y-0.5 transition-all group cursor-pointer active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-red-400 truncate">
              Atrasados Anteriores
            </span>
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-none">
                {atrasadosAnterioresCount}
              </div>
              <div className="mt-2.5 text-xs text-slate-400 flex items-center gap-1.5">
                <span className="truncate">há 2+ dias</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-red-400 opacity-70 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </div>
            <span className="text-[11px] font-black text-red-300 bg-red-500/15 border border-red-500/25 px-2.5 py-1 rounded-full whitespace-nowrap">
              Total: {totalAtrasadosCount}
            </span>
          </div>
        </Link>
      </div>

      {/* ── ROW 3: RECEBÍVEIS POR PERÍODO (PALETA ESMERALDA / TEAL / OURO) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-[0.16em]">
            Recebíveis por Período
          </h2>
        </div>
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: "Hoje",
              value: receberHoje,
              accent: "border-l-amber-400",
              text: "text-amber-400",
              badge: "bg-amber-500/10 text-amber-300",
            },
            {
              label: "Esta semana (7d)",
              value: receberSemana,
              accent: "border-l-emerald-400",
              text: "text-emerald-400",
              badge: "bg-emerald-500/10 text-emerald-300",
            },
            {
              label: "No mês (30d)",
              value: receberMes,
              accent: "border-l-teal-400",
              text: "text-teal-300",
              badge: "bg-teal-500/10 text-teal-300",
            },
            {
              label: "No ano (365d)",
              value: receberAno,
              accent: "border-l-emerald-500",
              text: "text-white",
              badge: "bg-white/5 text-slate-300",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`bg-[#12171d] border border-white/[0.07] rounded-2xl p-5 shadow-lg border-l-4 ${item.accent} hover:bg-[#171d25] transition-all`}
            >
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                {item.label}
              </span>
              <div className={`text-xl sm:text-2xl font-black mt-2.5 leading-none break-words ${item.text}`}>
                {formatBRL(item.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ROW 4: GRÁFICOS (PROJEÇÃO + DISTRIBUIÇÃO DE CARTEIRA) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Projeção de Recebimentos */}
        <div className="bg-[#12171d] border border-white/[0.07] rounded-[1.75rem] p-6 lg:col-span-2 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-black text-slate-300 uppercase tracking-[0.15em] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              Projeção de Recebimentos
            </h3>
            <span className="text-xs font-bold text-emerald-300 bg-[#1c222b] border border-emerald-500/20 px-3 py-1 rounded-full">
              Próximos 6 meses
            </span>
          </div>
          <ProjecaoBarChart data={mesesProjecao} />
        </div>

        {/* Distribuição de Carteira */}
        <div className="bg-[#12171d] border border-white/[0.07] rounded-[1.75rem] p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-300 uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              Distribuição de Carteira
            </h3>

            <CarteiraPieChart
              receberProprio={receberProprio}
              receberParceiros={receberParceiros}
              totalRecebivel={totalRecebiveisCalculados}
              pctProprio={pctProprio}
              pctParceiros={pctParceiros}
            />

            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between text-sm bg-[#1c222b]/70 px-3.5 py-2.5 rounded-xl border border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_8px_#10b981]" />
                  <span className="text-slate-300 font-semibold text-xs sm:text-sm">Capital Próprio</span>
                  <span className="text-[11px] font-black text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                    {pctProprio.toFixed(0)}%
                  </span>
                </div>
                <span className="font-black text-white text-xs sm:text-sm">{formatBRL(receberProprio)}</span>
              </div>

              <div className="flex items-center justify-between text-sm bg-[#1c222b]/70 px-3.5 py-2.5 rounded-xl border border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0 shadow-[0_0_8px_#f59e0b]" />
                  <span className="text-slate-300 font-semibold text-xs sm:text-sm">Parceiros</span>
                  <span className="text-[11px] font-black text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
                    {pctParceiros.toFixed(0)}%
                  </span>
                </div>
                <span className="font-black text-white text-xs sm:text-sm">{formatBRL(receberParceiros)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.07] pt-3.5 mt-4 flex items-center justify-between">
            <span className="text-slate-400 uppercase text-xs font-black tracking-widest">
              Total Recebível
            </span>
            <span className="font-black text-emerald-400 text-sm sm:text-base">
              {formatBRL(totalRecebiveisCalculados)}
            </span>
          </div>
        </div>
      </div>

      {/* ── ROW 5: GANHOS & FATURAMENTO REAL ── */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs sm:text-sm font-black text-slate-300 uppercase tracking-[0.16em]">
            Ganhos & Faturamento Real
          </h2>
          <span className="text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 px-2.5 py-0.5 rounded-full font-bold">
            Baseado em quitados
          </span>
        </div>

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Ganho Total em Juros — Assinatura Esmeralda Shark */}
          <div className="col-span-1 relative overflow-hidden bg-gradient-to-br from-[#10b981] via-[#059669] to-[#064e3b] rounded-2xl p-5 shadow-[0_14px_34px_-8px_rgba(16,185,129,0.4)] text-white border border-emerald-400/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100">
                Juros Ganhos (Total)
              </span>
              <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center">
                <BadgeDollarSign className="w-4 h-4 text-amber-300" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black leading-none break-words">
              {formatBRL(ganhoTotal)}
            </div>
            <div className="mt-2.5 text-xs text-emerald-100/80 font-medium">
              De {emprestimosQuitadosCount} contratos quitados
            </div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
          </div>

          {/* Faturado Este Mês — Esmeralda */}
          <div className="col-span-1 relative overflow-hidden bg-[#12171d] border border-white/[0.07] rounded-2xl p-5 shadow-lg hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Faturado Este Mês
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black leading-none text-emerald-400 break-words">
              {formatBRL(ganhoMesAtual)}
            </div>
            <div className="mt-2.5 text-xs text-slate-400">Parcelas quitadas no mês</div>
          </div>

          {/* Faturado Este Ano — Ouro / Âmbar */}
          <div className="col-span-1 relative overflow-hidden bg-[#12171d] border border-white/[0.07] rounded-2xl p-5 shadow-lg hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Faturado Este Ano
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black leading-none text-amber-400 break-words">
              {formatBRL(ganhoAnoAtual)}
            </div>
            <div className="mt-2.5 text-xs text-slate-400">Parcelas quitadas em {anoAtual}</div>
          </div>

          {/* Taxa de Quitação — Teal */}
          <div className="col-span-1 relative overflow-hidden bg-[#12171d] border border-white/[0.07] rounded-2xl p-5 shadow-lg hover:border-teal-500/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Taxa de Quitação
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
              </div>
            </div>
            <div className="text-2xl font-black leading-none text-teal-300">
              {taxaSucesso.toFixed(1)}%
            </div>
            <div className="mt-2 w-full bg-[#1c222b] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-700"
                style={{ width: `${taxaSucesso}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {emprestimosQuitadosCount} de {totalEmprestimosGeral} contratos
            </div>
          </div>
        </div>

        {/* Resumo Compacto Inferior */}
        <div className="bg-[#12171d] border border-white/[0.07] rounded-2xl p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-8 items-start sm:items-center">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Target className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Total Faturado (Bruto)
                </div>
                <div className="text-lg sm:text-xl font-black text-white leading-tight">
                  {formatBRL(faturadoTotal)}
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-white/[0.07] hidden sm:block" />
            <div className="h-px w-full bg-white/[0.06] sm:hidden" />

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center shrink-0">
                <BadgeDollarSign className="w-4.5 h-4.5 text-teal-400" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Lucro Potencial (Carteira Ativa)
                </div>
                <div className="text-lg sm:text-xl font-black text-teal-300 leading-tight">
                  {formatBRL(lucroEstimado)}
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-white/[0.07] hidden sm:block" />
            <div className="h-px w-full bg-white/[0.06] sm:hidden" />

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <DollarSign className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Ticket Médio (Quitados)
                </div>
                <div className="text-lg sm:text-xl font-black text-amber-400 leading-tight">
                  {formatBRL(ticketMedioQuitado)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 6: PARCEIROS ── */}
      {parceirosList.length > 0 && (
        <div className="bg-[#12171d] border border-white/[0.07] rounded-[1.75rem] p-6 shadow-xl">
          <h3 className="text-xs sm:text-sm font-black text-slate-300 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            Recebíveis por Parceiros
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-3 sm:gap-4">
            {parceirosList.map((p, idx) => (
              <div
                key={idx}
                className="p-4 bg-[#1c222b] rounded-2xl border border-white/[0.06] flex flex-col justify-between hover:border-amber-500/40 transition-all"
              >
                <span className="text-sm font-black text-slate-100 truncate">{p.nome}</span>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-sm font-black text-amber-400">{formatBRL(p.total)}</span>
                  <span className="text-xs text-slate-400 font-bold">{p.count} parcelas</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
