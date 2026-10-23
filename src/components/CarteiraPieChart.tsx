"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useSystemUiVersion } from "@/lib/theme";

interface CarteiraPieChartProps {
  receberProprio: number;
  receberParceiros: number;
  totalRecebivel: number;
  pctProprio: number;
  pctParceiros: number;
}

const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const CustomTooltip = ({ active, payload, isDark }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className={`rounded-xl px-4 py-3 shadow-xl border ${
          isDark
            ? "bg-[#1c222b] border-white/10 text-white shadow-black/60"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <p
          className={`text-xs font-black uppercase tracking-widest mb-1 ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {payload[0].name}
        </p>
        <p className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
          {fmtFull(payload[0].value)}
        </p>
        <p className="text-xs text-emerald-400 font-bold mt-0.5">
          {payload[0].payload.pct.toFixed(1)}% do total
        </p>
      </div>
    );
  }
  return null;
};

export function CarteiraPieChart({
  receberProprio,
  receberParceiros,
  totalRecebivel,
  pctProprio,
  pctParceiros,
}: CarteiraPieChartProps) {
  const { isDark } = useSystemUiVersion();

  const data = [
    { name: "Capital Próprio", value: receberProprio, pct: pctProprio, color: "#10b981" },
    { name: "Parceiros", value: receberParceiros, pct: pctParceiros, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-slate-500 text-sm font-bold">
        Sem dados
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <defs>
            <filter id="pieShadowEmerald" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#10b981" floodOpacity="0.35" />
            </filter>
            <filter id="pieShadowAmber" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.35" />
            </filter>
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                filter={entry.color === "#10b981" ? "url(#pieShadowEmerald)" : "url(#pieShadowAmber)"}
                stroke="none"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip isDark={isDark} />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Label central posicionado por cima */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div
            className={`text-[9px] font-black uppercase tracking-widest ${
              isDark ? "text-slate-400" : "text-zinc-400"
            }`}
          >
            Total
          </div>
          <div
            className={`text-sm font-black leading-tight ${
              isDark ? "text-white" : "text-zinc-900"
            }`}
          >
            {new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(totalRecebivel)}
          </div>
        </div>
      </div>
    </div>
  );
}
