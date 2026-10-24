"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  FileJson,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { SysTooltip } from "@/components/SysInitUi";

interface LeadgerIntegrationPanelProps {
  pin: string;
  onEditTenant: (tenantId: string, tab?: "info" | "finance") => void;
  onRefreshTenants: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function LeadgerIntegrationPanel({
  pin,
  onEditTenant,
  onRefreshTenants,
  showToast,
}: LeadgerIntegrationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"reconciliation" | "outbox">(
    "reconciliation"
  );
  const [outboxFilter, setOutboxFilter] = useState<string>("all");
  const [data, setData] = useState<{
    config: any;
    stats: any;
    outbox: any[];
    reconciliation: any[];
  } | null>(null);
  const [inspectItem, setInspectItem] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLeadgerData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tenants/setup/leadger?status=${encodeURIComponent(outboxFilter)}`,
        {
          headers: { "x-setup-pin": pin },
        }
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Erro ao carregar painel Leadger:", err);
    } finally {
      setLoading(false);
    }
  }, [pin, outboxFilter]);

  useEffect(() => {
    fetchLeadgerData();
  }, [fetchLeadgerData]);

  const handleCopy = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      showToast(`${label} copiado!`, "success");
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      showToast("Não foi possível copiar.", "error");
    }
  };

  const runLeadgerAction = async (
    key: string,
    payload: Record<string, any>,
    successDefaultMsg?: string
  ) => {
    setActionLoading(key);
    try {
      const res = await fetch("/api/tenants/setup/leadger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-pin": pin,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao executar operação Leadger");
      }

      const deliveredStatus =
        json.result?.status ||
        json.deliveryResult?.results?.[0]?.status ||
        null;
      const errCode =
        json.result?.errorCode ||
        json.deliveryResult?.results?.[0]?.errorCode ||
        null;

      if (deliveredStatus === "blocked" || deliveredStatus === "failed") {
        showToast(
          `Evento gravado na Outbox, porém bloqueado (${errCode || deliveredStatus}). Verifique a fila.`,
          "error"
        );
      } else {
        showToast(
          json.message || successDefaultMsg || "Operação concluída!",
          "success"
        );
      }

      await fetchLeadgerData();
      onRefreshTenants();
    } catch (err: any) {
      showToast(err.message || "Falha na operação", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportReconciliationCsv = () => {
    if (!data?.reconciliation?.length) return;
    const headers = [
      "Nome",
      "RazaoSocial",
      "CPF_CNPJ",
      "Email",
      "Telefone",
      "ClientExternalId",
      "BaseExternalId",
      "MensalidadeBRL",
      "DiaVencimento",
      "ProximoVencimento",
      "QtdFaturas",
      "Status",
    ];
    const rows = data.reconciliation.map((r: any) => [
      `"${String(r.name || "").replace(/"/g, '""')}"`,
      `"${String(r.razaoSocial || "").replace(/"/g, '""')}"`,
      `"${String(r.document || "")}"`,
      `"${String(r.email || "")}"`,
      `"${String(r.phone || "")}"`,
      `"${r.clientExternalId}"`,
      `"${r.baseExternalId}"`,
      r.monthlyAmountReais.toFixed(2),
      r.billingDay || "",
      r.dueDate || "",
      r.invoicesCount,
      r.status,
    ]);
    const csv = [headers.join(";"), ...rows.map((r: any[]) => r.join(";"))].join(
      "\n"
    );
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conciliacao-leadger-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Planilha CSV de conciliação exportada!", "success");
  };

  const handleCopyReconciliationJson = () => {
    if (!data?.reconciliation) return;
    const text = JSON.stringify(data.reconciliation, null, 2);
    handleCopy("reconcil-json", text, "Lista de conciliação (JSON)");
  };

  const cfg = data?.config;
  const stats = data?.stats;

  const statusBadge = (status: string, httpStatus?: number | null) => {
    switch (status) {
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 size={11} /> Entregue ({httpStatus || 200})
          </span>
        );
      case "pending":
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <Clock size={11} /> Na Fila
          </span>
        );
      case "retry_scheduled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <RefreshCw size={11} /> Agendado ({httpStatus || "Retry"})
          </span>
        );
      case "blocked":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-300 border border-red-500/35">
            <AlertTriangle size={11} /> Bloqueado ({httpStatus || 409})
          </span>
        );
      case "superseded":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            Substituído
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <AlertCircle size={11} /> Falha ({httpStatus || "Rede"})
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ====================================================================
       * 1. BANNER DE CONFIGURAÇÃO E STATUS DO EMISSOR (CONTRATO V1)
       * ==================================================================== */}
      <div className="rounded-3xl border border-emerald-500/25 bg-zinc-900/75 p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/90 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black tracking-wide flex items-center gap-1.5">
                <Zap size={14} /> TELTECH LEADGER · WEBHOOK V1
              </span>
              {cfg?.configured ? (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                  <ShieldCheck size={13} /> Segredo HMAC Configurado
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[11px] font-bold flex items-center gap-1">
                  <AlertTriangle size={13} /> Defina LEADGER_WEBHOOK_SECRET no .env
                </span>
              )}
              {cfg?.photoEnabled ? (
                <span className="px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[11px] font-bold">
                  Fotos HTTPS Ativas ({cfg.photoHost})
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 text-[11px] font-medium">
                  Envio de Fotos Desativado (Financeiro Prioritário)
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 pt-1 font-mono break-all">
              Destino:{" "}
              <strong className="text-zinc-200">
                {cfg?.url ||
                  "https://leadger.teltech.com.br/api/webhooks/inbound/sistema-amigo"}
              </strong>{" "}
              · source:{" "}
              <strong className="text-emerald-400">
                {cfg?.source || "sistema-amigo"}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportReconciliationCsv}
              className="px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <Download size={14} className="text-emerald-400" />
              <span>Exportar CSV Conciliação</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReconciliationJson}
              className="px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              {copiedId === "reconcil-json" ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Copy size={14} className="text-teal-400" />
              )}
              <span>Copiar JSON Conciliação</span>
            </button>

            <button
              type="button"
              disabled={actionLoading === "process_outbox"}
              onClick={() =>
                runLeadgerAction(
                  "process_outbox",
                  { action: "process_outbox", limit: 30 },
                  "Fila Outbox processada!"
                )
              }
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition disabled:opacity-50 active:scale-95"
            >
              <Play
                size={14}
                className={
                  actionLoading === "process_outbox" ? "animate-spin" : ""
                }
              />
              <span>Processar Fila Agora</span>
            </button>
          </div>
        </div>

        {/* KPIs da Integração */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
              Bases Sincronizadas
            </span>
            <span className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5 block">
              {stats?.syncedTenants ?? 0}{" "}
              <span className="text-xs font-normal text-zinc-500">
                / {stats?.totalTenants ?? 0}
              </span>
            </span>
          </div>

          <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
              Entregues (HTTP 200)
            </span>
            <span className="text-lg sm:text-xl font-black text-teal-300 mt-0.5 block">
              {stats?.delivered ?? 0}
            </span>
          </div>

          <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800/80 p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
              Aguardando / Retry
            </span>
            <span className="text-lg sm:text-xl font-black text-amber-300 mt-0.5 block">
              {(stats?.pending ?? 0) + (stats?.retryScheduled ?? 0)}
            </span>
          </div>

          <div className="rounded-2xl bg-zinc-950/70 border border-red-500/25 p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
              Bloqueios / Conflitos (409/422)
            </span>
            <span className="text-lg sm:text-xl font-black text-red-400 mt-0.5 block">
              {(stats?.blocked ?? 0) + (stats?.failed ?? 0)}
            </span>
          </div>
        </div>

        {/* Sub-navegação */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setSubTab("reconciliation")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                subTab === "reconciliation"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              1. Clientes, IDs Externos & Conciliação (
              {data?.reconciliation?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setSubTab("outbox")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                subTab === "outbox"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span>2. Fila Outbox & Retries ({data?.outbox?.length ?? 0})</span>
              {(stats?.blocked ?? 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black">
                  {stats.blocked}
                </span>
              )}
            </button>
          </div>

          {subTab === "reconciliation" && (
            <button
              type="button"
              disabled={actionLoading === "sync_batch"}
              onClick={() => {
                if (
                  !confirm(
                    "Confirmar envio em lote paginado (base.upsert) para todos os clientes que possuem mensalidade > R$ 0,00 e data de vencimento?\n\nCertifique-se de já ter conciliado clientes manuais no Leadger (Seção 5 e 10)."
                  )
                )
                  return;
                runLeadgerAction(
                  "sync_batch",
                  { action: "sync_batch", limit: 20, deliverNow: true },
                  "Carga em lote paginada executada!"
                );
              }}
              className="px-3.5 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Sparkles size={14} />
              <span>Sincronizar Lote Paginado (Até 20)</span>
            </button>
          )}
        </div>
      </div>

      {/* ====================================================================
       * ABA 1: TABELA DE CONCILIAÇÃO E ENVIO INDIVIDUAL POR TENANT
       * ==================================================================== */}
      {subTab === "reconciliation" && (
        <div className="rounded-3xl border border-emerald-500/20 bg-zinc-900/70 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">
                Mapeamento de Identidade Permanente (Cliente + Base + Faturas)
              </h3>
              <p className="text-xs text-zinc-400">
                Use os IDs externos abaixo para vincular cadastros já existentes
                no Leadger (Configurações &gt; Integrações &gt; Vincular cliente
                já cadastrado) ou sincronize um cliente individualmente.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto sys-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/90 text-zinc-400 uppercase text-[10px] border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Cliente / Contato</th>
                  <th className="py-3 px-4">IDs Externos (Permanentes)</th>
                  <th className="py-3 px-4">Mensalidade & Versões</th>
                  <th className="py-3 px-4">Status Leadger</th>
                  <th className="py-3 px-4 text-right">Ações de Envio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {(data?.reconciliation || []).map((item: any) => (
                  <tr
                    key={item.id}
                    className="hover:bg-zinc-950/40 transition"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-xs sm:text-sm">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        CNPJ/CPF: {item.document || "Não informado"}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        E-mail: {item.email || "Não informado"}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">client:</span>
                        <code className="text-emerald-300 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                          {item.clientExternalId}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              `cli-${item.id}`,
                              item.clientExternalId,
                              "client.externalId"
                            )
                          }
                          className="text-zinc-500 hover:text-emerald-300"
                          title="Copiar clientExternalId"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">base:</span>
                        <code className="text-teal-300 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                          {item.baseExternalId}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              `base-${item.id}`,
                              item.baseExternalId,
                              "base.externalId"
                            )
                          }
                          className="text-zinc-500 hover:text-teal-300"
                          title="Copiar baseExternalId"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-emerald-400">
                        R$ {Number(item.monthlyAmountReais || 0).toFixed(2)}
                        <span className="text-zinc-500 font-normal text-[11px] ml-1">
                          ({item.monthlyAmountCents} centavos)
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Venc.: {item.dueDate || "Sem data"}{" "}
                        {item.billingDay ? `(Dia ${item.billingDay})` : ""} ·{" "}
                        {item.invoicesCount} fatura(s)
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                        cli v{item.clientVersion} · base v{item.baseVersion} ·
                        photo v{item.photoVersion}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {item.leadgerSynced ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 size={11} /> Sincronizado
                          </span>
                          {item.leadgerLastSyncedAt && (
                            <div className="text-[10px] text-zinc-500">
                              {new Date(
                                item.leadgerLastSyncedAt
                              ).toLocaleString("pt-BR")}
                            </div>
                          )}
                        </div>
                      ) : item.readyForBaseUpsert ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Pronto para Sincronizar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                          Definir Mensalidade/Data
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {!item.readyForBaseUpsert ? (
                          <button
                            type="button"
                            onClick={() => onEditTenant(item.id, "finance")}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <Edit size={12} /> Configurar Mensalidade
                          </button>
                        ) : (
                          <SysTooltip content="Enviar base.upsert (Cliente + Base + Faturas) para o Leadger">
                            <button
                              type="button"
                              disabled={actionLoading === `sync-${item.id}`}
                              onClick={() =>
                                runLeadgerAction(
                                  `sync-${item.id}`,
                                  {
                                    action: "sync_tenant",
                                    tenantId: item.id,
                                    deliverNow: true,
                                  },
                                  `Base de ${item.name} enviada!`
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow transition disabled:opacity-50"
                            >
                              <Send size={12} />
                              <span>
                                {item.leadgerSynced
                                  ? "Atualizar Base"
                                  : "Sincronizar Base"}
                              </span>
                            </button>
                          </SysTooltip>
                        )}

                        {item.leadgerSynced && (
                          <SysTooltip content="Enviar apenas cadastro do cliente (client.upsert) sem alterar mensalidade">
                            <button
                              type="button"
                              disabled={actionLoading === `cli-${item.id}`}
                              onClick={() =>
                                runLeadgerAction(
                                  `cli-${item.id}`,
                                  {
                                    action: "sync_client",
                                    tenantId: item.id,
                                    includePhoto: false,
                                    deliverNow: true,
                                  },
                                  `Cadastro de ${item.name} atualizado!`
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <span>client.upsert</span>
                            </button>
                          </SysTooltip>
                        )}

                        {item.hasLogo && (
                          <SysTooltip content="Enviar client.upsert separado com photo.sourceUrl (Seção 11)">
                            <button
                              type="button"
                              disabled={actionLoading === `photo-${item.id}`}
                              onClick={() =>
                                runLeadgerAction(
                                  `photo-${item.id}`,
                                  {
                                    action: "sync_photo",
                                    tenantId: item.id,
                                    includePhoto: true,
                                    bumpPhotoVersion: true,
                                    deliverNow: true,
                                  },
                                  `Evento de foto enfileirado para ${item.name}!`
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <Upload size={12} />
                              <span>Foto</span>
                            </button>
                          </SysTooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
       * ABA 2: MONITOR DA FILA OUTBOX E REENVIO DE PENDÊNCIAS
       * ==================================================================== */}
      {subTab === "outbox" && (
        <div className="rounded-3xl border border-emerald-500/20 bg-zinc-900/70 overflow-hidden shadow-xl space-y-3">
          <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: "Todos" },
                { id: "blocked", label: "Bloqueados (409/422)" },
                { id: "retry_scheduled", label: "Agendados (Backoff)" },
                { id: "pending", label: "Pendentes" },
                { id: "delivered", label: "Entregues (200)" },
                { id: "failed", label: "Falhas" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setOutboxFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    outboxFilter === f.id
                      ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchLeadgerData}
              className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Atualizar Fila</span>
            </button>
          </div>

          {!data?.outbox?.length ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              Nenhum evento encontrado na fila Outbox para este filtro.
            </div>
          ) : (
            <div className="overflow-x-auto sys-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/90 text-zinc-400 uppercase text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Evento / Data</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Status / Resposta</th>
                    <th className="py-3 px-4">Diagnóstico / Código</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {data.outbox.map((ev: any) => (
                    <tr
                      key={ev.id}
                      className="hover:bg-zinc-950/40 transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-emerald-300">
                          {ev.eventType}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-400">
                          {ev.eventId}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Criado:{" "}
                          {new Date(ev.createdAt).toLocaleString("pt-BR")} ·
                          Tentativas: {ev.attempts}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">
                          {ev.tenant?.nomeFantasia ||
                            ev.tenant?.name ||
                            ev.tenant?.databaseName ||
                            "—"}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                          {ev.clientVersion ? `cli v${ev.clientVersion} ` : ""}
                          {ev.baseVersion ? `base v${ev.baseVersion} ` : ""}
                          {ev.invoiceVersion ? `fat v${ev.invoiceVersion} ` : ""}
                          {ev.photoVersion ? `photo v${ev.photoVersion}` : ""}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>{statusBadge(ev.status, ev.lastHttpStatus)}</div>
                        {ev.outcome && (
                          <div className="text-[10px] font-mono text-teal-300 mt-1">
                            outcome: {ev.outcome}
                            {ev.duplicate ? " (duplicate)" : ""}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        {ev.lastErrorCode ? (
                          <div className="space-y-0.5">
                            <span className="font-mono text-[11px] font-bold text-red-300 block">
                              {ev.lastErrorCode}
                            </span>
                            <span className="text-[11px] text-zinc-400 block break-words">
                              {ev.lastErrorMessage}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectItem(ev)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <Eye size={12} /> JSON
                          </button>

                          {ev.status !== "delivered" &&
                            ev.status !== "superseded" && (
                              <>
                                <SysTooltip content="Reenviar mantendo exatamente o mesmo eventId e corpo JSON, gerando nova assinatura HMAC (Seção 3 e 9)">
                                  <button
                                    type="button"
                                    disabled={
                                      actionLoading === `retry-${ev.id}`
                                    }
                                    onClick={() =>
                                      runLeadgerAction(
                                        `retry-${ev.id}`,
                                        {
                                          action: "retry_event",
                                          outboxId: ev.id,
                                        },
                                        `Tentativa de reenvio executada (${ev.eventId})!`
                                      )
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1"
                                  >
                                    <RefreshCw size={12} /> Reenviar
                                  </button>
                                </SysTooltip>

                                {(ev.status === "blocked" ||
                                  ev.lastHttpStatus === 422) && (
                                  <SysTooltip content="Usar após corrigir dados inválidos (422) ou renovar link de foto: gera novo evento com versão maior">
                                    <button
                                      type="button"
                                      disabled={
                                        actionLoading === `rebuild-${ev.id}`
                                      }
                                      onClick={() =>
                                        runLeadgerAction(
                                          `rebuild-${ev.id}`,
                                          {
                                            action: "rebuild_blocked_event",
                                            outboxId: ev.id,
                                          },
                                          "Novo snapshot gerado e enviado!"
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold inline-flex items-center gap-1"
                                    >
                                      <span>Novo Snapshot</span>
                                    </button>
                                  </SysTooltip>
                                )}
                              </>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
       * MODAL DE INSPEÇÃO DE PAYLOAD E RESPOSTA JSON
       * ==================================================================== */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileJson size={18} className="text-emerald-400" />
                  <span>
                    Inspeção do Evento: {inspectItem.eventType} (
                    {inspectItem.eventId})
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  occurredAt: {inspectItem.occurredAt} · Tentativas:{" "}
                  {inspectItem.attempts}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 sys-scrollbar">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Corpo JSON Original (Assinado com HMAC-SHA256)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        "modal-payload",
                        inspectItem.payloadJson,
                        "Payload JSON"
                      )
                    }
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <Copy size={12} /> Copiar Payload
                  </button>
                </div>
                <pre className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 text-[11px] font-mono text-emerald-200 overflow-x-auto">
                  {(() => {
                    try {
                      return JSON.stringify(
                        JSON.parse(inspectItem.payloadJson),
                        null,
                        2
                      );
                    } catch {
                      return inspectItem.payloadJson;
                    }
                  })()}
                </pre>
              </div>

              {inspectItem.lastResponseJson && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400 block mb-1.5">
                    Última Resposta do Receptor Leadger (HTTP{" "}
                    {inspectItem.lastHttpStatus || "—"})
                  </span>
                  <pre className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                    {(() => {
                      try {
                        return JSON.stringify(
                          JSON.parse(inspectItem.lastResponseJson),
                          null,
                          2
                        );
                      } catch {
                        return inspectItem.lastResponseJson;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
