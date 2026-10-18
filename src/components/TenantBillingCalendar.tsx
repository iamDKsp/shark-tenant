"use client";

import React, { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Edit,
  AlertTriangle,
  LogIn,
  ArrowRight,
  CheckCircle2,
  ListFilter,
} from "lucide-react";
import { SysTooltip, SysCheckbox } from "@/components/SysInitUi";

type Tenant = any;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateKey(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatCurrency(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dueTone(tenant: Tenant, now: Date) {
  const due = tenant.mensalidadeVencimento
    ? new Date(tenant.mensalidadeVencimento)
    : null;
  if (!due || tenant.status !== "active") {
    return "border-zinc-700/80 bg-zinc-900/90 text-zinc-300";
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate()
  );
  if (dueDay < today) {
    return "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-500/70";
  }
  if (dueDay.getTime() === today.getTime()) {
    return "border-amber-500/50 bg-amber-500/15 text-amber-100 hover:border-amber-400";
  }
  return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100 hover:border-emerald-500/65";
}

function dotColorForDay(items: Tenant[], now: Date): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let hasOverdue = false;
  let hasToday = false;
  let hasActive = false;

  for (const t of items) {
    if (t.status !== "active" || !t.mensalidadeVencimento) continue;
    const due = new Date(t.mensalidadeVencimento);
    const dueDay = new Date(
      due.getUTCFullYear(),
      due.getUTCMonth(),
      due.getUTCDate()
    );
    if (dueDay < today) hasOverdue = true;
    else if (dueDay.getTime() === today.getTime()) hasToday = true;
    else hasActive = true;
  }

  if (hasOverdue) return "bg-rose-400";
  if (hasToday) return "bg-amber-400";
  if (hasActive) return "bg-emerald-400";
  return "bg-zinc-500";
}

export function TenantBillingCalendar({
  tenants,
  month,
  onMonthChange,
  selectedIds,
  onToggleTenant,
  onEdit,
  onRegisterPayment,
  onImpersonate,
}: {
  tenants: Tenant[];
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedIds: string[];
  onToggleTenant: (tenantId: string, selected: boolean) => void;
  onEdit: (tenant: Tenant) => void;
  onRegisterPayment: (tenantId: string) => void;
  onImpersonate?: (tenant: Tenant) => void;
}) {
  const current = startOfMonth(month);
  const today = new Date();
  const [selectedMobileDay, setSelectedMobileDay] = useState<number | null>(
    today.getMonth() === current.getMonth() &&
      today.getFullYear() === current.getFullYear()
      ? today.getDate()
      : null
  );

  const firstWeekday = current.getDay();
  const daysInMonth = new Date(
    current.getFullYear(),
    current.getMonth() + 1,
    0
  ).getDate();
  const cells = Array.from(
    { length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 },
    (_, index) => index - firstWeekday + 1
  );

  const byDay = new Map<string, Tenant[]>();
  const withoutDate: Tenant[] = [];
  const overdue: Tenant[] = [];
  const allInMonth: { day: number; tenant: Tenant }[] = [];
  let monthExpectedTotal = 0;
  let monthTenantsCount = 0;

  for (const tenant of tenants) {
    const key = dateKey(tenant.mensalidadeVencimento);
    if (!key) {
      withoutDate.push(tenant);
      continue;
    }
    const due = new Date(tenant.mensalidadeVencimento);
    const dueDay = new Date(
      due.getUTCFullYear(),
      due.getUTCMonth(),
      due.getUTCDate()
    );
    const todayDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    if (tenant.status === "active" && dueDay < todayDay) {
      overdue.push(tenant);
    }
    if (
      due.getUTCFullYear() === current.getFullYear() &&
      due.getUTCMonth() === current.getMonth()
    ) {
      monthTenantsCount++;
      allInMonth.push({ day: due.getUTCDate(), tenant });
      if (tenant.status === "active") {
        monthExpectedTotal += Number(tenant.mensalidadeValor || 0);
      }
    }
    const items = byDay.get(key) || [];
    items.push(tenant);
    byDay.set(key, items);
  }

  allInMonth.sort((a, b) => a.day - b.day);

  const monthLabel = current.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const isToday = (day: number) =>
    day === today.getDate() &&
    current.getMonth() === today.getMonth() &&
    current.getFullYear() === today.getFullYear();

  const changeMonth = (delta: number) => {
    setSelectedMobileDay(null);
    onMonthChange(
      new Date(current.getFullYear(), current.getMonth() + delta, 1)
    );
  };

  const selectedMobileKey =
    selectedMobileDay !== null
      ? `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(selectedMobileDay).padStart(2, "0")}`
      : "";
  const mobileDayItems =
    selectedMobileDay !== null
      ? (byDay.get(selectedMobileKey) || []).map((t) => ({
          day: selectedMobileDay,
          tenant: t,
        }))
      : allInMonth;

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-zinc-900/65 shadow-xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/90 p-3.5 sm:p-4 bg-zinc-950/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2.5 text-emerald-400 shrink-0">
              <CalendarDays size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold capitalize text-zinc-100 text-sm sm:text-lg truncate">
                {monthLabel}
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                {monthTenantsCount} vencimento(s) · Previsão:{" "}
                <strong className="text-emerald-400">
                  {formatCurrency(monthExpectedTotal)}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <SysTooltip content="Mês anterior">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 hover:border-emerald-500/40 hover:bg-emerald-950/30 hover:text-emerald-300 transition active:scale-95"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={18} />
              </button>
            </SysTooltip>
            <SysTooltip content="Voltar para o mês atual">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  onMonthChange(startOfMonth(now));
                  setSelectedMobileDay(now.getDate());
                }}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition active:scale-95"
              >
                Hoje
              </button>
            </SysTooltip>
            <SysTooltip content="Próximo mês">
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 hover:border-emerald-500/40 hover:bg-emerald-950/30 hover:text-emerald-300 transition active:scale-95"
                aria-label="Próximo mês"
              >
                <ChevronRight size={18} />
              </button>
            </SysTooltip>
          </div>
        </header>

        {/* ================================================================
         * MOBILE COMPACT INTERACTIVE CALENDAR + AGENDA (< md)
         * ================================================================ */}
        <div className="md:hidden p-3 space-y-3">
          <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-400/70 pb-1">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              const active = day > 0 && day <= daysInMonth;
              if (!active) {
                return (
                  <div
                    key={index}
                    className="h-11 rounded-xl bg-zinc-950/30 border border-zinc-900/50"
                  />
                );
              }
              const key = `${current.getFullYear()}-${String(
                current.getMonth() + 1
              ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const items = byDay.get(key) || [];
              const todayCell = isToday(day);
              const isSelected = selectedMobileDay === day;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    setSelectedMobileDay((prev) => (prev === day ? null : day))
                  }
                  className={`h-12 rounded-xl border flex flex-col items-center justify-center relative transition-all active:scale-95 ${
                    isSelected
                      ? "bg-gradient-to-br from-emerald-500/30 to-teal-600/30 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                      : todayCell
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : items.length > 0
                      ? "border-zinc-700/80 bg-zinc-900/90 text-zinc-100"
                      : "border-zinc-800/60 bg-zinc-950/40 text-zinc-400"
                  }`}
                >
                  <span className="text-xs font-bold leading-none">{day}</span>
                  {items.length > 0 && (
                    <div className="mt-1 flex items-center gap-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${dotColorForDay(
                          items,
                          today
                        )}`}
                      />
                      <span className="text-[9px] font-mono text-zinc-300 leading-none">
                        {items.length}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile Agenda List for Selected Day or Full Month */}
          <div className="rounded-2xl border border-emerald-500/20 bg-zinc-950/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <ListFilter size={14} />
                {selectedMobileDay !== null
                  ? `Vencimentos do dia ${String(selectedMobileDay).padStart(
                      2,
                      "0"
                    )} (${mobileDayItems.length})`
                  : `Todos os vencimentos do mês (${allInMonth.length})`}
              </span>
              {selectedMobileDay !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedMobileDay(null)}
                  className="text-[11px] font-semibold text-emerald-400 hover:underline"
                >
                  Ver mês inteiro
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto sys-scrollbar pr-0.5">
              {mobileDayItems.map(({ day, tenant }) => (
                <div
                  key={tenant.id}
                  className={`rounded-xl border p-3 transition ${dueTone(
                    tenant,
                    today
                  )}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <SysCheckbox
                        size="sm"
                        checked={selectedIds.includes(tenant.id)}
                        onChange={(val) => onToggleTenant(tenant.id, val)}
                      />
                      <button
                        type="button"
                        onClick={() => onEdit(tenant)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-xs font-bold truncate">
                          {tenant.nomeFantasia ||
                            tenant.name ||
                            tenant.databaseName}
                        </p>
                        <p className="text-[11px] font-mono opacity-85 mt-0.5">
                          Dia {String(day).padStart(2, "0")} ·{" "}
                          {formatCurrency(tenant.mensalidadeValor)}
                        </p>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onImpersonate && (
                        <button
                          type="button"
                          onClick={() => onImpersonate(tenant)}
                          className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 active:scale-95"
                          aria-label="Acessar Painel"
                        >
                          <LogIn size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRegisterPayment(tenant.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-1 active:scale-95"
                      >
                        <DollarSign size={13} /> Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {mobileDayItems.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-4">
                  Nenhum vencimento programado para este período.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================
         * DESKTOP FULL 7-COLUMN CALENDAR (md and up)
         * ================================================================ */}
        <div className="hidden md:block overflow-x-auto sys-scrollbar">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/60 text-center text-xs font-bold uppercase tracking-wider text-emerald-400/70">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <span className="py-3" key={day}>
                  {day}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {cells.map((day, index) => {
                const active = day > 0 && day <= daysInMonth;
                const key = active
                  ? `${current.getFullYear()}-${String(
                      current.getMonth() + 1
                    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  : "";
                const items = byDay.get(key) || [];
                const todayCell = active && isToday(day);

                return (
                  <div
                    key={index}
                    className={`min-h-[125px] border-b border-r border-zinc-800/70 p-2 transition ${
                      active ? "bg-zinc-900/20" : "bg-zinc-950/50"
                    } ${
                      todayCell
                        ? "ring-1 ring-inset ring-emerald-500/80 bg-emerald-500/5"
                        : ""
                    }`}
                  >
                    {active && (
                      <div className="flex items-center justify-between mb-1.5 px-1">
                        <span
                          className={`text-xs font-bold ${
                            todayCell
                              ? "bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                              : "text-zinc-400"
                          }`}
                        >
                          {day}
                        </span>
                        {items.length > 0 && (
                          <span className="text-[10px] font-mono text-emerald-400/80">
                            {items.length}x
                          </span>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5 sys-scrollbar">
                      {items.map((tenant) => (
                        <div
                          key={tenant.id}
                          className={`group rounded-xl border p-2 transition shadow-sm ${dueTone(
                            tenant,
                            today
                          )}`}
                        >
                          <div className="flex items-start gap-1.5">
                            <SysTooltip content="Selecionar para ações em lote">
                              <div className="mt-0.5 shrink-0">
                                <SysCheckbox
                                  size="sm"
                                  checked={selectedIds.includes(tenant.id)}
                                  onChange={(val) =>
                                    onToggleTenant(tenant.id, val)
                                  }
                                />
                              </div>
                            </SysTooltip>

                            <SysTooltip content="Abrir cadastro e financeiro do cliente">
                              <button
                                type="button"
                                onClick={() => onEdit(tenant)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <p className="truncate text-xs font-bold leading-snug">
                                  {tenant.nomeFantasia ||
                                    tenant.name ||
                                    tenant.databaseName}
                                </p>
                                <p className="mt-0.5 text-[11px] font-mono tabular-nums opacity-85">
                                  {formatCurrency(tenant.mensalidadeValor)}
                                </p>
                              </button>
                            </SysTooltip>

                            <div className="flex items-center gap-0.5 shrink-0">
                              {onImpersonate && (
                                <SysTooltip content="Entrar direto no painel deste cliente">
                                  <button
                                    type="button"
                                    onClick={() => onImpersonate(tenant)}
                                    className="rounded p-1 text-emerald-300 hover:bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition"
                                  >
                                    <LogIn size={12} />
                                  </button>
                                </SysTooltip>
                              )}
                              <SysTooltip content="Registrar pagamento (+1 mês)">
                                <button
                                  type="button"
                                  onClick={() => onRegisterPayment(tenant.id)}
                                  className="rounded p-1 text-emerald-300 hover:bg-emerald-500/25 transition"
                                >
                                  <DollarSign size={13} />
                                </button>
                              </SysTooltip>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-5 px-3.5 sm:px-4 py-3 text-[11px] sm:text-xs text-zinc-400 bg-zinc-950/50 border-t border-zinc-800/80">
          <span className="flex items-center gap-1.5 text-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-400" /> Em atraso
          </span>
          <span className="flex items-center gap-1.5 text-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Vence hoje
          </span>
          <span className="flex items-center gap-1.5 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Em dia /
            Próximo vencimento
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-zinc-600" /> Suspenso /
            Inativo
          </span>
        </div>
      </section>

      <aside className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-rose-500/25 bg-rose-950/15 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-rose-300">
              <AlertTriangle size={17} />
              <h3 className="font-bold text-sm">
                Mensalidades em atraso ({overdue.length})
              </h3>
            </div>
            {overdue.length > 0 && (
              <span className="text-xs font-mono text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                {formatCurrency(
                  overdue.reduce(
                    (acc, t) => acc + Number(t.mensalidadeValor || 0),
                    0
                  )
                )}
              </span>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 sys-scrollbar">
            {overdue.map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950/60 border border-rose-500/20 p-3 hover:border-rose-500/40 transition"
              >
                <button
                  type="button"
                  onClick={() => onEdit(tenant)}
                  className="min-w-0 text-left flex-1"
                >
                  <p className="truncate text-xs font-bold text-zinc-100">
                    {tenant.nomeFantasia || tenant.name || tenant.databaseName}
                  </p>
                  <p className="text-[11px] text-rose-300 mt-0.5">
                    Venceu em{" "}
                    {new Date(tenant.mensalidadeVencimento).toLocaleDateString(
                      "pt-BR",
                      { timeZone: "UTC" }
                    )}{" "}
                    · {formatCurrency(tenant.mensalidadeValor)}
                  </p>
                </button>
                <SysTooltip content="Confirmar pagamento e avançar +1 mês">
                  <button
                    type="button"
                    onClick={() => onRegisterPayment(tenant.id)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-bold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 flex items-center gap-1 transition active:scale-95"
                  >
                    <DollarSign size={14} /> Quitar
                  </button>
                </SysTooltip>
              </div>
            ))}
            {!overdue.length && (
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-400/80 py-4 text-center">
                <CheckCircle2 size={15} />
                <span>Nenhuma mensalidade em atraso. Tudo em dia!</span>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-500/20 bg-zinc-900/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-zinc-300">
            <Edit size={16} className="text-emerald-400" />
            <h3 className="font-bold text-sm">
              Sem data de vencimento ({withoutDate.length})
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2 sys-scrollbar">
            {withoutDate.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                onClick={() => onEdit(tenant)}
                className="flex items-center justify-between w-full rounded-xl bg-zinc-950/60 border border-zinc-800/80 p-3 text-left hover:bg-emerald-950/20 hover:border-emerald-500/30 transition"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-zinc-200">
                    {tenant.nomeFantasia || tenant.name || tenant.databaseName}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Toque para definir valor e data de cobrança
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-400 shrink-0 ml-2 inline-flex items-center gap-1">
                  Configurar <ArrowRight size={13} />
                </span>
              </button>
            ))}
            {!withoutDate.length && (
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 py-4 text-center">
                <CheckCircle2 size={15} className="text-emerald-500/70" />
                <span>
                  Todos os clientes possuem data de vencimento configurada.
                </span>
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
