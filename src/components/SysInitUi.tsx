"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  X,
  Search,
} from "lucide-react";

/* ============================================================================
 * 1. CUSTOM SYSTEM TOOLTIP (Replaces ugly native browser `title` tooltips)
 * ============================================================================ */
export function SysTooltip({
  content,
  children,
  side = "top",
  className = "",
  disabled = false,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    actualSide: "top" | "bottom" | "left" | "right";
  }>({ top: 0, left: 0, actualSide: side });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let actualSide = side;
    if (side === "top" && rect.top < 56) actualSide = "bottom";
    if (side === "bottom" && vh - rect.bottom < 56) actualSide = "top";
    if (side === "left" && rect.left < 160) actualSide = "top";
    if (side === "right" && vw - rect.right < 160) actualSide = "top";

    let top = 0;
    let left = 0;

    if (actualSide === "top") {
      top = rect.top - 8;
      left = Math.min(Math.max(rect.left + rect.width / 2, 16), vw - 16);
    } else if (actualSide === "bottom") {
      top = rect.bottom + 8;
      left = Math.min(Math.max(rect.left + rect.width / 2, 16), vw - 16);
    } else if (actualSide === "left") {
      top = rect.top + rect.height / 2;
      left = rect.left - 8;
    } else {
      top = rect.top + rect.height / 2;
      left = rect.right + 8;
    }

    setCoords({ top, left, actualSide });
  };

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (disabled || !content) return;
    if (e.pointerType === "touch") return; // Avoid sticky tooltips on touch screens
    updatePosition();
    setVisible(true);
  };

  const handlePointerLeave = () => {
    setVisible(false);
  };

  if (!content || disabled) {
    return <>{children}</>;
  }

  const transformClass =
    coords.actualSide === "top"
      ? "-translate-x-1/2 -translate-y-full"
      : coords.actualSide === "bottom"
      ? "-translate-x-1/2"
      : coords.actualSide === "left"
      ? "-translate-x-full -translate-y-1/2"
      : "-translate-y-1/2";

  return (
    <>
      <span
        ref={triggerRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={() => {
          updatePosition();
          setVisible(true);
        }}
        onBlur={() => setVisible(false)}
        className={`inline-flex ${className}`}
      >
        {children}
      </span>
      {mounted &&
        visible &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
            className={`fixed z-[9999] pointer-events-none select-none ${transformClass} animate-in fade-in zoom-in-95 duration-150`}
          >
            <div className="max-w-xs rounded-xl bg-[#071712]/95 backdrop-blur-md border border-emerald-500/40 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-50 shadow-[0_10px_25px_rgba(0,0,0,0.75),0_0_15px_rgba(16,185,129,0.18)] leading-snug whitespace-nowrap">
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/* ============================================================================
 * 2. CUSTOM GREEN CHECKBOX (Replaces native `<input type="checkbox">`)
 * ============================================================================ */
export function SysCheckbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const boxSize = size === "sm" ? "w-4 h-4 rounded-md" : "w-5 h-5 rounded-lg";
  const iconSize = size === "sm" ? 11 : 13;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={`group inline-flex items-start gap-2.5 text-left select-none transition focus:outline-none ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      <span
        className={`${boxSize} mt-0.5 shrink-0 flex items-center justify-center border transition-all duration-200 ${
          checked
            ? "bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400 text-zinc-950 shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-100"
            : "bg-zinc-950/90 border-zinc-700/90 text-transparent group-hover:border-emerald-500/60 group-hover:bg-emerald-950/30"
        }`}
      >
        <Check
          size={iconSize}
          strokeWidth={3.5}
          className={`transition-transform duration-150 ${
            checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        />
      </span>
      {(label || description) && (
        <span className="min-w-0 flex-1">
          {label && (
            <span
              className={`block font-semibold transition-colors ${
                size === "sm" ? "text-xs" : "text-xs sm:text-sm"
              } ${
                checked
                  ? "text-emerald-200"
                  : "text-zinc-300 group-hover:text-white"
              }`}
            >
              {label}
            </span>
          )}
          {description && (
            <span className="block text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
              {description}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/* ============================================================================
 * 3. CUSTOM GREEN DROPDOWN SELECT (Replaces native `<select>`)
 * ============================================================================ */
export interface SysSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export function SysSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  searchable = false,
  size = "md",
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SysSelectOption[];
  placeholder?: string;
  searchable?: boolean;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const filtered =
    searchable && search.trim()
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(search.toLowerCase()) ||
            (o.sublabel &&
              o.sublabel.toLowerCase().includes(search.toLowerCase()))
        )
      : options;

  const padClass =
    size === "sm"
      ? "px-3 py-2 text-xs rounded-xl"
      : "px-3.5 py-2.5 text-sm rounded-xl";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
            setSearch("");
          }
        }}
        className={`w-full flex items-center justify-between gap-2 bg-zinc-950/90 border transition-all text-left focus:outline-none ${padClass} ${
          open
            ? "border-emerald-500 ring-2 ring-emerald-500/20 text-white"
            : "border-zinc-800 hover:border-emerald-500/40 text-zinc-100"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="text-emerald-400 shrink-0">
              {selectedOption.icon}
            </span>
          )}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.sublabel && (
            <span className="text-xs text-zinc-500 truncate hidden sm:inline">
              ({selectedOption.sublabel})
            </span>
          )}
        </span>
        <ChevronDown
          size={size === "sm" ? 14 : 16}
          className={`shrink-0 text-emerald-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 rounded-2xl bg-[#071510]/98 backdrop-blur-xl border border-emerald-500/35 shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(16,185,129,0.12)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {(searchable || options.length > 6) && (
            <div className="p-2 border-b border-emerald-500/15 bg-zinc-950/60">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400/70"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar opções..."
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 sys-scrollbar">
            {filtered.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${
                    active
                      ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-bold"
                      : "text-zinc-300 hover:bg-emerald-500/10 hover:text-white border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {opt.icon && (
                      <span
                        className={`shrink-0 ${
                          active ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {opt.icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm truncate">{opt.label}</p>
                      {opt.sublabel && (
                        <p className="text-[11px] text-zinc-400 truncate">
                          {opt.sublabel}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {opt.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-emerald-300 border border-emerald-500/20">
                        {opt.badge}
                      </span>
                    )}
                    {active && (
                      <Check size={15} className="text-emerald-400 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-4">
                Nenhuma opção encontrada.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 4. CUSTOM GREEN CALENDAR DATE & TIME PICKER (Replaces native `<input type="date">`)
 * ============================================================================ */
export function SysDateTimePicker({
  value,
  onChange,
  includeTime = false,
  placeholder = "Selecionar data...",
  className = "",
}: {
  value: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  includeTime?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse YYYY-MM-DD
  const datePart = value ? value.slice(0, 10) : "";
  const timePart =
    value && value.includes("T") ? value.slice(11, 16) : "09:00";

  const initialDate = datePart
    ? new Date(`${datePart}T12:00:00`)
    : new Date();
  const [viewMonth, setViewMonth] = useState<Date>(
    Number.isNaN(initialDate.getTime())
      ? new Date()
      : new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );
  const [hours, setHours] = useState<string>(timePart.slice(0, 2) || "09");
  const [minutes, setMinutes] = useState<string>(timePart.slice(3, 5) || "00");

  useEffect(() => {
    if (datePart) {
      const d = new Date(`${datePart}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }, [datePart]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = Array.from(
    { length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 },
    (_, i) => i - firstWeekday + 1
  );

  const selectDate = (y: number, m: number, d: number, keepOpen = false) => {
    const formatted = `${y}-${String(m + 1).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
    if (includeTime) {
      onChange(`${formatted}T${hours}:${minutes}`);
    } else {
      onChange(formatted);
    }
    if (!keepOpen) setOpen(false);
  };

  const today = new Date();
  const formattedDisplay = (() => {
    if (!datePart) return "";
    const [y, m, d] = datePart.split("-");
    if (!y || !m || !d) return datePart;
    return includeTime ? `${d}/${m}/${y} às ${hours}:${minutes}` : `${d}/${m}/${y}`;
  })();

  const monthTitle = viewMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-zinc-950/90 border rounded-xl text-sm transition-all cursor-pointer select-none ${
          open
            ? "border-emerald-500 ring-2 ring-emerald-500/20 text-white"
            : "border-zinc-800 hover:border-emerald-500/40 text-zinc-100"
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon size={16} className="text-emerald-400 shrink-0" />
          <span
            className={`truncate font-mono ${
              formattedDisplay ? "text-white font-semibold" : "text-zinc-500"
            }`}
          >
            {formattedDisplay || placeholder}
          </span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {datePart && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
              aria-label="Limpar data"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={15}
            className={`text-emerald-400 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {open && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 z-50 w-full min-w-[290px] sm:w-[320px] rounded-2xl bg-[#071510]/98 backdrop-blur-xl border border-emerald-500/35 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_25px_rgba(16,185,129,0.15)] animate-in fade-in zoom-in-95 duration-150">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-500/15">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-emerald-300 hover:border-emerald-500/40 transition"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-bold capitalize text-emerald-100 tracking-wide">
              {monthTitle}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-emerald-300 hover:border-emerald-500/40 transition"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-emerald-400/70 mb-1.5">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, idx) => (
              <span key={idx} className="py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              const valid = day > 0 && day <= daysInMonth;
              if (!valid) {
                return <div key={idx} className="h-8" />;
              }
              const cellIso = `${year}-${String(month + 1).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;
              const isSelected = cellIso === datePart;
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDate(year, month, day)}
                  className={`h-8 rounded-lg text-xs font-semibold transition-all flex items-center justify-center ${
                    isSelected
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-zinc-950 font-black shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                      : isToday
                      ? "border border-emerald-500/60 bg-emerald-500/15 text-emerald-300 font-bold"
                      : "text-zinc-300 hover:bg-emerald-500/15 hover:text-white"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Optional Time Selector */}
          {includeTime && (
            <div className="mt-3 pt-2.5 border-t border-emerald-500/15 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <Clock size={13} /> Horário:
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hours}
                  onChange={(e) => {
                    const h = String(
                      Math.min(23, Math.max(0, Number(e.target.value) || 0))
                    ).padStart(2, "0");
                    setHours(h);
                    if (datePart) onChange(`${datePart}T${h}:${minutes}`);
                  }}
                  className="w-12 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-center text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-emerald-400 font-bold">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) => {
                    const m = String(
                      Math.min(59, Math.max(0, Number(e.target.value) || 0))
                    ).padStart(2, "0");
                    setMinutes(m);
                    if (datePart) onChange(`${datePart}T${hours}:${m}`);
                  }}
                  className="w-12 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-center text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Quick Actions Footer */}
          <div className="mt-3 pt-2.5 border-t border-emerald-500/15 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() =>
                selectDate(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate()
                )
              }
              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                const next30 = new Date();
                next30.setDate(next30.getDate() + 30);
                selectDate(
                  next30.getFullYear(),
                  next30.getMonth(),
                  next30.getDate()
                );
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[11px] font-semibold transition"
            >
              +30 dias
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-red-500/15 text-zinc-400 hover:text-red-300 border border-zinc-800 text-[11px] font-semibold transition"
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 5. PASSWORD / PIN INPUT WITH SHOW/HIDE EYE ICON
 * ============================================================================ */
export function SysPasswordInput({
  value,
  onChange,
  placeholder = "••••••••",
  autoFocus = false,
  required = false,
  className = "",
  inputClassName = "",
  iconSize = 18,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  iconSize?: number;
}) {
  const [show, setShow] = useState(false);
  const id = useId();

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        className={`w-full pr-11 ${inputClassName}`}
      />
      <SysTooltip content={show ? "Ocultar senha" : "Mostrar senha digitada"}>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((prev) => !prev)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff size={iconSize} /> : <Eye size={iconSize} />}
        </button>
      </SysTooltip>
    </div>
  );
}
