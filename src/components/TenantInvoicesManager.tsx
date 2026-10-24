"use client";

import React, { useState } from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Edit,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  X,
  Ban,
} from "lucide-react";
import { SysSelect, SysTooltip, SysDateTimePicker } from "@/components/SysInitUi";

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX", badge: "PIX" },
  { value: "boleto", label: "Boleto Bancário", badge: "BOL" },
  { value: "credit_card", label: "Cartão de Crédito", badge: "CARD" },
  { value: "bank_transfer", label: "Transferência / TED", badge: "TED" },
  { value: "cash", label: "Dinheiro / Espécie", badge: "CASH" },
];

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  credit_card: "Cartão",
  bank_transfer: "Transferência",
  cash: "Dinheiro",
};

interface TenantInvoicesManagerProps {
  pin: string;
  tenant: any;
  invoices: any[];
  paymentHistory: any[];
  loadingHistory: boolean;
  onRefresh: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function TenantInvoicesManager({
  pin,
  tenant,
  invoices,
  paymentHistory,
  loadingHistory,
  onRefresh,
  showToast,
}: TenantInvoicesManagerProps) {
  const [payMethod, setPayMethod] = useState<string>("pix");
  const [payValor, setPayValor] = useState<string>("");
  const [payObs, setPayObs] = useState<string>("");
  const [submittingPay, setSubmittingPay] = useState(false);

  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [newInvForm, setNewInvForm] = useState({
    dueDate: "",
    amount: "",
    description: "",
  });
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const handleConfirmPayment = async (invoiceId?: string) => {
    setSubmittingPay(true);
    try {
      const res = await fetch(
        `/api/tenants/setup/${tenant.id}/registrar-pagamento`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-setup-pin": pin,
          },
          body: JSON.stringify({
            valor: payValor !== "" ? Number(payValor) : undefined,
            paymentMethod: payMethod,
            observacao: payObs || undefined,
            invoiceId,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao registrar pagamento");

      showToast(
        "Pagamento confirmado (+1 mês) e fatura atualizada!",
        "success"
      );
      setPayValor("");
      setPayObs("");
      onRefresh();
    } catch (err: any) {
      showToast(err.message || "Falha ao registrar pagamento", "error");
    } finally {
      setSubmittingPay(false);
    }
  };

  const runInvoiceAction = async (
    key: string,
    payload: Record<string, any>,
    defaultMsg?: string
  ) => {
    setActionBusy(key);
    try {
      const res = await fetch(`/api/tenants/setup/${tenant.id}/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-pin": pin,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na operação da fatura");
      showToast(data.message || defaultMsg || "Fatura atualizada!", "success");
      setEditingInvoice(null);
      setCreatingInvoice(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erro na fatura", "error");
    } finally {
      setActionBusy(null);
    }
  };

  const handleRefund = async (opts: {
    invoiceId?: string;
    paymentLogId?: string;
    label: string;
  }) => {
    const motivo = prompt(
      `Confirmar ESTORNO de ${opts.label}?\nInforme o motivo (opcional) para registrar e reverter o saldo no Leadger:`,
      "Estorno solicitado pelo administrador"
    );
    if (motivo === null) return;

    await runInvoiceAction(
      `refund-${opts.invoiceId || opts.paymentLogId}`,
      {
        action: "refund",
        invoiceId: opts.invoiceId,
        paymentLogId: opts.paymentLogId,
        targetStatus: "pending",
        revertDueDate: true,
        motivo: motivo.trim() || undefined,
      },
      "Pagamento estornado e evento enviado!"
    );
  };

  return (
    <div className="space-y-6">
      {/* ====================================================================
       * 1. CAIXA DE BAIXA DE MENSALIDADE COM MÉTODO DE PAGAMENTO (PIX, BOLETO...)
       * ==================================================================== */}
      <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-emerald-300 text-sm flex items-center space-x-2">
              <Calendar size={16} />
              <span>
                Confirmar Recebimento de Mensalidade (Baixa + Próxima
                Competência)
              </span>
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Último pagamento:{" "}
              <strong className="text-zinc-200">
                {tenant.ultimoPagamento
                  ? new Date(tenant.ultimoPagamento).toLocaleString("pt-BR")
                  : "Nenhum registrado"}
              </strong>
              {tenant.leadgerSynced && (
                <span className="ml-2 text-emerald-400 font-semibold">
                  · Sincroniza invoice.upsert automaticamente com o Leadger
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Método de Pagamento (Leadger)
            </label>
            <SysSelect
              value={payMethod}
              onChange={setPayMethod}
              options={PAYMENT_METHODS}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Valor Recebido R$ (Opcional se igual ao contrato)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder={`Padrão: R$ ${Number(
                tenant.mensalidadeValor || 0
              ).toFixed(2)}`}
              value={payValor}
              onChange={(e) => setPayValor(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Observação da Baixa
            </label>
            <input
              type="text"
              placeholder="Ex: Comprovante PIX recebido"
              value={payObs}
              onChange={(e) => setPayObs(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={submittingPay}
            onClick={() => handleConfirmPayment()}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 active:scale-95"
          >
            {submittingPay ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Check size={15} />
            )}
            <span>Confirmar Pagamento (+1 Mês)</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
       * 2. FATURAS POR COMPETÊNCIA (TENANT INVOICES — CONTRATO V1)
       * ==================================================================== */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center space-x-2">
            <CreditCard size={14} className="text-emerald-400" />
            <span>
              Faturas / Competências Mensais ({invoices.length})
            </span>
          </h4>

          <button
            type="button"
            onClick={() => {
              setNewInvForm({
                dueDate: tenant.mensalidadeVencimento || "",
                amount: String(tenant.mensalidadeValor || ""),
                description: "",
              });
              setCreatingInvoice((prev) => !prev);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Plus size={13} />
            <span>Gerar / Antecipar Competência</span>
          </button>
        </div>

        {creatingInvoice && (
          <div className="rounded-2xl bg-zinc-950/90 border border-emerald-500/30 p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300">
                Nova Fatura / Competência Mensal
              </span>
              <button
                type="button"
                onClick={() => setCreatingInvoice(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Data de Vencimento (YYYY-MM-DD)
                </label>
                <SysDateTimePicker
                  value={newInvForm.dueDate}
                  onChange={(val) =>
                    setNewInvForm((prev) => ({ ...prev, dueDate: val }))
                  }
                  placeholder="Deixe vazio para +1 mês automático"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newInvForm.amount}
                  onChange={(e) =>
                    setNewInvForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  placeholder="Ex: 149.90"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Descrição (Opcional)
                </label>
                <input
                  type="text"
                  value={newInvForm.description}
                  onChange={(e) =>
                    setNewInvForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Padrão: Empresa — Mensalidade MM/AAAA"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={actionBusy === "create-inv"}
                onClick={() =>
                  runInvoiceAction("create-inv", {
                    action: "create",
                    dueDate: newInvForm.dueDate || undefined,
                    amount:
                      newInvForm.amount !== ""
                        ? Number(newInvForm.amount)
                        : undefined,
                    description: newInvForm.description || undefined,
                  })
                }
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Send size={13} /> Criar Fatura
              </button>
            </div>
          </div>
        )}

        {invoices.length === 0 ? (
          <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-2xl p-5 text-center text-xs text-zinc-500">
            Nenhuma fatura gerada ainda. Defina valor/vencimento acima e salve
            ou clique em &ldquo;Gerar Competência&rdquo;.
          </div>
        ) : (
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl overflow-x-auto sys-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/90 text-zinc-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3.5">Competência / ID</th>
                  <th className="py-2.5 px-3.5">Vencimento</th>
                  <th className="py-2.5 px-3.5">Valor</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {invoices.map((inv: any) => {
                  const reais = (Number(inv.amount || 0) / 100).toFixed(2);
                  return (
                    <tr key={inv.id} className="hover:bg-zinc-900/40">
                      <td className="py-2.5 px-3.5">
                        <div className="font-bold text-white font-mono">
                          {inv.referenceMonth}{" "}
                          <span className="text-[10px] text-zinc-500">
                            (v{inv.version})
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 truncate max-w-[180px]">
                          {inv.externalId}
                        </div>
                      </td>

                      <td className="py-2.5 px-3.5 text-zinc-300 font-mono">
                        {inv.dueDate}
                      </td>

                      <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-400">
                        R$ {reais}
                      </td>

                      <td className="py-2.5 px-3.5">
                        {inv.status === "paid" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 size={11} /> Pago (
                            {METHOD_LABELS[inv.paymentMethod] ||
                              inv.paymentMethod ||
                              "PIX"}
                            )
                          </span>
                        ) : inv.status === "cancelled" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Cancelada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Clock size={11} /> Pendente
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {inv.status === "pending" && (
                            <SysTooltip content="Quitar esta competência agora">
                              <button
                                type="button"
                                disabled={submittingPay}
                                onClick={() => handleConfirmPayment(inv.id)}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                <DollarSign size={11} /> Quitar
                              </button>
                            </SysTooltip>
                          )}

                          <SysTooltip content="Alterar valor (desconto/correção) ou vencimento desta fatura">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingInvoice({
                                  ...inv,
                                  amountReais: (
                                    Number(inv.amount || 0) / 100
                                  ).toFixed(2),
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold inline-flex items-center gap-1"
                            >
                              <Edit size={11} /> Editar
                            </button>
                          </SysTooltip>

                          {inv.status === "paid" && (
                            <SysTooltip content="Estornar pagamento (reverte saldo no Leadger)">
                              <button
                                type="button"
                                disabled={actionBusy === `refund-${inv.id}`}
                                onClick={() =>
                                  handleRefund({
                                    invoiceId: inv.id,
                                    label: `competência ${inv.referenceMonth} (R$ ${reais})`,
                                  })
                                }
                                className="px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                <RotateCcw size={11} /> Estornar
                              </button>
                            </SysTooltip>
                          )}

                          {inv.status === "pending" && (
                            <SysTooltip content="Cancelar fatura aberta">
                              <button
                                type="button"
                                disabled={actionBusy === `cancel-${inv.id}`}
                                onClick={() =>
                                  runInvoiceAction(
                                    `cancel-${inv.id}`,
                                    { action: "cancel", invoiceId: inv.id },
                                    "Fatura cancelada!"
                                  )
                                }
                                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-300 border border-zinc-800 text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                <Ban size={11} /> Cancelar
                              </button>
                            </SysTooltip>
                          )}

                          {inv.status === "cancelled" && (
                            <button
                              type="button"
                              disabled={actionBusy === `reopen-${inv.id}`}
                              onClick={() =>
                                runInvoiceAction(
                                  `reopen-${inv.id}`,
                                  { action: "reopen", invoiceId: inv.id },
                                  "Fatura reaberta!"
                                )
                              }
                              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-300 text-[10px] font-bold"
                            >
                              Reabrir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de edição individual de fatura */}
        {editingInvoice && (
          <div className="rounded-2xl bg-zinc-950 border border-emerald-500/40 p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300">
                Editar Fatura {editingInvoice.referenceMonth} (v
                {editingInvoice.version} &rarr; v{editingInvoice.version + 1})
              </span>
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingInvoice.amountReais}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      amountReais: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Vencimento (YYYY-MM-DD)
                </label>
                <SysDateTimePicker
                  value={editingInvoice.dueDate}
                  onChange={(val) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      dueDate: val,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={editingInvoice.description || ""}
                  onChange={(e) =>
                    setEditingInvoice({
                      ...editingInvoice,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionBusy === `upd-${editingInvoice.id}`}
                onClick={() =>
                  runInvoiceAction(`upd-${editingInvoice.id}`, {
                    action: "update",
                    invoiceId: editingInvoice.id,
                    amount: Number(editingInvoice.amountReais),
                    dueDate: editingInvoice.dueDate,
                    description: editingInvoice.description,
                  })
                }
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                Salvar Alteração na Fatura
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
       * 3. HISTÓRICO DE PAGAMENTOS E ESTORNOS
       * ==================================================================== */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-2">
          <FileText size={14} className="text-emerald-400" />
          <span>Histórico de Baixas e Estornos ({paymentHistory.length})</span>
        </h4>

        {loadingHistory ? (
          <div className="py-6 text-center text-zinc-500">
            <Loader2
              className="animate-spin mx-auto mb-1 text-emerald-500"
              size={20}
            />
            <span className="text-xs">Carregando histórico...</span>
          </div>
        ) : paymentHistory.length === 0 ? (
          <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-2xl p-6 text-center text-xs text-zinc-500">
            Nenhum pagamento registrado ainda para este cliente.
          </div>
        ) : (
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl overflow-x-auto max-h-64 overflow-y-auto sys-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/90 text-zinc-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Data / Hora</th>
                  <th className="py-2.5 px-4">Valor / Método</th>
                  <th className="py-2.5 px-4">Vencimento Anterior</th>
                  <th className="py-2.5 px-4">Novo Vencimento</th>
                  <th className="py-2.5 px-4">Observação</th>
                  <th className="py-2.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {paymentHistory.map((log: any) => {
                  const dt = log.dataPagamento || log.createdAt;
                  const vencAnt = log.vencimentoAnterior || log.vencimentoAntes;
                  const vencNov = log.vencimentoNovo || log.vencimentoApos;
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-zinc-900/40 ${
                        log.estornado ? "opacity-60" : ""
                      }`}
                    >
                      <td className="py-2.5 px-4 text-zinc-300">
                        {dt ? new Date(dt).toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold">
                        <span
                          className={
                            log.estornado
                              ? "line-through text-red-400"
                              : "text-emerald-400"
                          }
                        >
                          R$ {Number(log.valor || 0).toFixed(2)}
                        </span>
                        {log.paymentMethod && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            {METHOD_LABELS[log.paymentMethod] ||
                              log.paymentMethod}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-400">
                        {vencAnt
                          ? new Date(vencAnt).toLocaleDateString("pt-BR", {
                              timeZone: "UTC",
                            })
                          : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-emerald-300 font-semibold">
                        {vencNov
                          ? new Date(vencNov).toLocaleDateString("pt-BR", {
                              timeZone: "UTC",
                            })
                          : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-400">
                        {log.observacao || "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {log.estornado ? (
                          <span className="text-[10px] font-bold text-red-400">
                            Estornado
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleRefund({
                                paymentLogId: log.id,
                                invoiceId: log.invoiceId || undefined,
                                label: `pagamento de R$ ${Number(
                                  log.valor || 0
                                ).toFixed(2)}`,
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-[10px] font-bold inline-flex items-center gap-1"
                          >
                            <RotateCcw size={11} /> Estornar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
