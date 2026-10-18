"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TenantBillingCalendar } from "@/components/TenantBillingCalendar";
import {
  SysTooltip,
  SysCheckbox,
  SysSelect,
  SysDateTimePicker,
  SysPasswordInput,
} from "@/components/SysInitUi";
import {
  Database,
  Plus,
  Building2,
  UserCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Server,
  Edit,
  Trash2,
  X,
  RefreshCw,
  DollarSign,
  Users,
  Shield,
  Calendar,
  Phone,
  FileText,
  Upload,
  Check,
  Ban,
  Terminal,
  Play,
  Table2,
  Clock,
  Lock,
  Search,
  CalendarDays,
  Copy,
  Download,
  ChevronRight,
  ChevronDown,
  LogIn,
  Activity,
  HardDrive,
  Archive,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Wallet,
  CreditCard,
  TrendingUp,
  Layers,
  ShieldCheck,
  LogOut,
  Zap,
  SlidersHorizontal,
} from "lucide-react";

const MODULES_CONFIG = [
  { key: "emprestimos", label: "Empréstimos", desc: "Contratos e parcelas" },
  { key: "cheques", label: "Cheques", desc: "Controle e troca de cheques" },
  { key: "cobrancas", label: "Cobranças", desc: "Régua e disparo de cobranças" },
  { key: "parceiros", label: "Parceiros", desc: "Comissões e investidores" },
  { key: "whatsapp", label: "WhatsApp", desc: "Notificações automáticas" },
  { key: "clientes", label: "Clientes", desc: "Cadastro e dossiê completo" },
  { key: "relatorios", label: "Relatórios PDF", desc: "Exportação de extratos" },
] as const;

const DEFAULT_MODULES: Record<string, boolean> = {
  emprestimos: true,
  cheques: true,
  cobrancas: true,
  parceiros: true,
  whatsapp: true,
  clientes: true,
  relatorios: true,
};

function parseModules(raw: any): Record<string, boolean> {
  if (!raw) return { ...DEFAULT_MODULES };
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { ...DEFAULT_MODULES, ...obj };
  } catch {
    return { ...DEFAULT_MODULES };
  }
}

function ModuleBadges({ raw }: { raw: any }) {
  const mods = parseModules(raw);
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {MODULES_CONFIG.map((m) => {
        const active = mods[m.key] !== false;
        return (
          <SysTooltip
            key={m.key}
            content={`${m.label}: ${active ? "Módulo Ativo" : "Módulo Desativado"}`}
          >
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition ${
                active
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                  : "bg-zinc-900/60 text-zinc-500 border-zinc-800 line-through"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  active ? "bg-emerald-400" : "bg-zinc-600"
                }`}
              />
              {m.label}
            </span>
          </SysTooltip>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function SysInitPage() {
  const [pin, setPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);

  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<
    "list" | "calendar" | "new" | "edit" | "sql" | "backups"
  >("list");

  const [tenantSearch, setTenantSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "suspended" | "overdue" | "dueSoon" | "noDate"
  >("all");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [includeHeartMigration, setIncludeHeartMigration] = useState(true);
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  // Edit / New States
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [editTab, setEditTab] = useState<
    "info" | "modules" | "finance" | "users" | "xray"
  >("info");
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tenantStats, setTenantStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ADMIN",
    pin: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // Form states (New Tenant)
  const [dbName, setDbName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [seedDefaults, setSeedDefaults] = useState(true);

  const [provisioning, setProvisioning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState<any>(null);

  // Migration States
  const [migrating, setMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<any[] | null>(null);
  const [expandedLogDb, setExpandedLogDb] = useState<string | null>(null);

  // Backups States
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupTarget, setBackupTarget] = useState<string>("all");

  // SQL Editor States
  const [sqlPin, setSqlPin] = useState("");
  const [sqlUnlocked, setSqlUnlocked] = useState(false);
  const [sqlPinError, setSqlPinError] = useState(false);
  const [sqlDb, setSqlDb] = useState("heart");
  const [sqlQuery, setSqlQuery] = useState(
    'SELECT id, name, "databaseName", status, "mensalidadeValor", "mensalidadeVencimento" FROM tenants ORDER BY "createdAt" DESC LIMIT 50;'
  );
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlError, setSqlError] = useState("");
  const [sqlTables, setSqlTables] = useState<string[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [sqlHistory, setSqlHistory] = useState<
    { db: string; sql: string; time: string }[]
  >([]);
  const [sqlMobilePanel, setSqlMobilePanel] = useState<"editor" | "sidebar">(
    "editor"
  );

  // Inline Editing in SQL Table
  const [editingCell, setEditingCell] = useState<{
    rowIdx: number;
    colIdx: number;
    colName: string;
    value: string;
    pkCol: string;
    pkVal: any;
  } | null>(null);
  const [savingCell, setSavingCell] = useState(false);

  // Auto-restore PIN from sessionStorage
  useEffect(() => {
    const savedPin = sessionStorage.getItem("shark_sysinit_pin");
    if (savedPin) {
      setPin(savedPin);
      fetch("/api/tenants/setup/list", {
        headers: { "x-setup-pin": savedPin },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Invalid session PIN");
        })
        .then((data) => {
          setTenants(Array.isArray(data) ? data : data.tenants || []);
          setIsAuthenticated(true);
        })
        .catch(() => {
          sessionStorage.removeItem("shark_sysinit_pin");
        });
    }
  }, []);

  const fetchTenants = useCallback(
    async (overridePin?: string) => {
      const activePin = overridePin ?? pin;
      setLoading(true);
      try {
        const res = await fetch("/api/tenants/setup/list", {
          headers: { "x-setup-pin": activePin },
        });
        if (!res.ok) {
          if (res.status === 401) {
            setPinError(true);
            setIsAuthenticated(false);
            sessionStorage.removeItem("shark_sysinit_pin");
          }
          throw new Error("Falha ao buscar clientes");
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.tenants || [];
        setTenants(list);
        setSelectedTenantIds((prev) =>
          prev.filter((id) => list.some((t: any) => t.id === id))
        );
        setIsAuthenticated(true);
        setPinError(false);
        sessionStorage.setItem("shark_sysinit_pin", activePin);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [pin]
  );

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTenants(pin);
  };

  const handleLockSession = () => {
    sessionStorage.removeItem("shark_sysinit_pin");
    setIsAuthenticated(false);
    setPin("");
    setSqlUnlocked(false);
    setSqlPin("");
  };

  const copyValue = async (key: string, value: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      if (label) showToast(`${label} copiado!`, "success");
      setTimeout(
        () => setCopiedKey((curr) => (curr === key ? null : curr)),
        1800
      );
    } catch (err) {
      console.error("Erro ao copiar:", err);
    }
  };

  // Direct 1-Click Login into Tenant Panel (Impersonation)
  const handleImpersonate = async (tenant: any, userId?: string) => {
    setImpersonatingId(tenant.id);
    try {
      const res = await fetch(`/api/tenants/setup/${tenant.id}/impersonate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-pin": pin,
        },
        body: JSON.stringify(userId ? { userId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao acessar painel");
      showToast(
        `Entrando no painel de ${tenant.nomeFantasia || tenant.name}...`,
        "success"
      );
      window.location.href = "/";
    } catch (err: any) {
      showToast(err.message || "Falha ao entrar no painel", "error");
    } finally {
      setImpersonatingId(null);
    }
  };

  const handleDbNameChange = (val: string) => {
    const formatted = val.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    setDbName(formatted);
  };

  const handleTenantNameChange = (val: string) => {
    setTenantName(val);
    if (!dbName || dbName.startsWith("shark_")) {
      const slug = val
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
      setDbName(slug ? `shark_${slug}` : "");
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword !== adminPasswordConfirm) {
      setErrorMsg("As senhas digitadas não coincidem.");
      return;
    }
    setProvisioning(true);
    setErrorMsg("");
    setSuccessData(null);

    try {
      const res = await fetch("/api/tenants/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-pin": pin,
        },
        body: JSON.stringify({
          dbName,
          tenantName,
          adminName,
          adminEmail,
          adminPassword,
          seedDefaults,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro desconhecido ao criar banco");
      }

      setSuccessData({
        ...data,
        plainPassword: adminPassword,
      });
      showToast("Empresa e banco provisionados com sucesso!", "success");
      setDbName("");
      setTenantName("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      setAdminPasswordConfirm("");
      fetchTenants();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setProvisioning(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/tenants/setup/${editingTenant.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-setup-pin": pin,
        },
        body: JSON.stringify({
          name: editingTenant.name,
          status: editingTenant.status,
          nomeFantasia: editingTenant.nomeFantasia,
          razaoSocial: editingTenant.razaoSocial,
          cnpj: editingTenant.cnpj,
          telefone: editingTenant.telefone,
          endereco: editingTenant.endereco,
          cidade: editingTenant.cidade,
          logo: editingTenant.logo,
          observacoes: editingTenant.observacoes,
          mensalidadeValor: editingTenant.mensalidadeValor,
          mensalidadeVencimento: editingTenant.mensalidadeVencimento,
          modules:
            typeof editingTenant.modules === "object"
              ? JSON.stringify(editingTenant.modules)
              : editingTenant.modules,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar");

      showToast("Configurações da empresa salvas!", "success");
      setEditingTenant(null);
      setView("list");
      fetchTenants();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  const fetchTenantUsers = async (tenantId: string) => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`/api/tenants/setup/${tenantId}/users`, {
        headers: { "x-setup-pin": pin },
      });
      if (res.ok) {
        const data = await res.json();
        setTenantUsers(Array.isArray(data) ? data : data.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPaymentHistory = async (tenantId: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/tenants/setup/${tenantId}/payment-history`,
        {
          headers: { "x-setup-pin": pin },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setPaymentHistory(Array.isArray(data) ? data : data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchTenantStats = async (tenantId: string) => {
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/tenants/setup/${tenantId}/stats`, {
        headers: { "x-setup-pin": pin },
      });
      if (res.ok) {
        const data = await res.json();
        setTenantStats(data.stats || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleOpenEdit = (
    tenant: any,
    initialTab: "info" | "modules" | "finance" | "users" | "xray" = "info"
  ) => {
    setEditingTenant({
      ...tenant,
      modules: parseModules(tenant.modules),
      mensalidadeVencimento: tenant.mensalidadeVencimento
        ? new Date(tenant.mensalidadeVencimento).toISOString().split("T")[0]
        : "",
    });
    setEditTab(initialTab);
    setErrorMsg("");
    setTenantStats(null);
    setView("edit");
    fetchTenantUsers(tenant.id);
    fetchPaymentHistory(tenant.id);
    fetchTenantStats(tenant.id);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditingTenant((prev: any) => ({
        ...prev,
        logo: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRegistrarPagamento = async (tenantId: string) => {
    try {
      const res = await fetch(
        `/api/tenants/setup/${tenantId}/registrar-pagamento`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-setup-pin": pin,
          },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Erro ao registrar pagamento");

      const updated = data.tenant || data;
      if (editingTenant && editingTenant.id === tenantId) {
        setEditingTenant((prev: any) => ({
          ...prev,
          status: updated.status,
          ultimoPagamento: updated.ultimoPagamento,
          mensalidadeVencimento: updated.mensalidadeVencimento
            ? new Date(updated.mensalidadeVencimento)
                .toISOString()
                .split("T")[0]
            : "",
        }));
      }
      showToast(
        "Pagamento confirmado! Vencimento avançado em +1 mês.",
        "success"
      );
      fetchTenants();
      fetchPaymentHistory(tenantId);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleResetUserPassword = async (
    userId: string,
    payload: {
      password?: string;
      pin?: string;
      active?: boolean;
      role?: string;
    }
  ) => {
    if (!editingTenant) return;
    try {
      const res = await fetch(
        `/api/tenants/setup/${editingTenant.id}/users/${userId}/password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-setup-pin": pin,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar usuário");
      fetchTenantUsers(editingTenant.id);
      fetchTenants();
      showToast("Credenciais do usuário atualizadas!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!editingTenant) return;
    if (!confirm(`Remover o usuário "${email}" desta empresa?`)) return;
    try {
      const res = await fetch(
        `/api/tenants/setup/${editingTenant.id}/users/${userId}/password`,
        {
          method: "DELETE",
          headers: { "x-setup-pin": pin },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao remover usuário");
      fetchTenantUsers(editingTenant.id);
      fetchTenants();
      showToast("Usuário removido com sucesso.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setCreatingUser(true);
    try {
      const res = await fetch(`/api/tenants/setup/${editingTenant.id}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-pin": pin,
        },
        body: JSON.stringify(newUserForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar usuário");
      setNewUserForm({
        name: "",
        email: "",
        password: "",
        role: "ADMIN",
        pin: "",
      });
      fetchTenantUsers(editingTenant.id);
      fetchTenants();
      showToast("Novo usuário adicionado à empresa!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Tem certeza que deseja APAGAR a empresa "${name}"? Os acessos serão revogados imediatamente.`
      )
    )
      return;

    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/setup/${id}`, {
        method: "DELETE",
        headers: { "x-setup-pin": pin },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao deletar");
      }
      showToast(`Empresa "${name}" removida.`, "success");
      fetchTenants();
    } catch (err: any) {
      showToast(err.message, "error");
      setLoading(false);
    }
  };

  const handleMigrateAll = async (tenantIds?: string[]) => {
    const selectedCount = tenantIds?.length || 0;
    const targetDescription = selectedCount
      ? `${selectedCount} banco(s) selecionado(s)`
      : `TODOS os ${tenants.length} bancos de dados de clientes`;
    if (
      !confirm(
        `Deseja aplicar atualizações de estrutura (Prisma DB Push) em ${targetDescription}${
          includeHeartMigration ? " + banco central Heart" : ""
        }?`
      )
    )
      return;

    setMigrating(true);
    setMigrationResults(null);
    setExpandedLogDb(null);

    try {
      const res = await fetch("/api/tenants/setup/migrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-pin": pin,
        },
        body: JSON.stringify({
          tenantIds: selectedCount ? tenantIds : undefined,
          includeHeart: includeHeartMigration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na migração");

      setMigrationResults(data.results);
      showToast("Processo de atualização de bancos concluído!", "success");
    } catch (err: any) {
      showToast("Falha ao rodar migração: " + err.message, "error");
    } finally {
      setMigrating(false);
    }
  };

  const toggleTenantSelection = (tenantId: string, selected: boolean) => {
    setSelectedTenantIds((prev) =>
      selected
        ? Array.from(new Set([...prev, tenantId]))
        : prev.filter((id) => id !== tenantId)
    );
  };

  const handleBulkStatusChange = async (status: "active" | "suspended") => {
    if (!selectedTenantIds.length) return;
    const actionLabel = status === "active" ? "ATIVAR" : "SUSPENDER";
    if (
      !confirm(
        `Deseja ${actionLabel} ${selectedTenantIds.length} cliente(s) selecionado(s)?`
      )
    )
      return;

    setBulkStatusLoading(true);
    try {
      await Promise.all(
        selectedTenantIds.map(async (tenantId) => {
          const tenant = tenants.find((item) => item.id === tenantId);
          if (!tenant) return;
          const res = await fetch(`/api/tenants/setup/${tenantId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-setup-pin": pin,
            },
            body: JSON.stringify({
              name: tenant.name,
              status,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Erro ao atualizar ${tenant.name}`);
          }
        })
      );
      showToast(
        `${selectedTenantIds.length} empresa(s) atualizada(s)!`,
        "success"
      );
      await fetchTenants();
    } catch (err: any) {
      showToast(err.message || "Erro na atualização em lote", "error");
    } finally {
      setBulkStatusLoading(false);
    }
  };

  // Backups Functions
  const fetchBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/tenants/setup/backups", {
        headers: { "x-setup-pin": pin },
      });
      if (res.ok) {
        const data = await res.json();
        setBackupsList(data.backups || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBackups(false);
    }
  }, [pin]);

  const handleCreateBackup = async (downloadImmediately = false) => {
    setCreatingBackup(true);
    try {
      const res = await fetch("/api/tenants/setup/backups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-pin": pin,
        },
        body: JSON.stringify({
          database: backupTarget,
          download: downloadImmediately,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar backup");

      if (downloadImmediately && data.payload) {
        const blob = new Blob([JSON.stringify(data.payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `shark_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      showToast(
        `Backup ${data.filename} gerado (${formatBytes(data.sizeBytes)})!`,
        "success"
      );
      fetchBackups();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadSavedBackup = (filename: string) => {
    fetch(
      `/api/tenants/setup/backups?download=${encodeURIComponent(filename)}`,
      {
        headers: { "x-setup-pin": pin },
      }
    )
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => showToast("Erro ao baixar arquivo de backup", "error"));
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Excluir o arquivo de backup "${filename}"?`)) return;
    try {
      const res = await fetch(
        `/api/tenants/setup/backups?file=${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          headers: { "x-setup-pin": pin },
        }
      );
      if (res.ok) {
        showToast("Backup excluído.", "success");
        fetchBackups();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // SQL Editor Functions
  useEffect(() => {
    try {
      const saved = localStorage.getItem("shark_sysinit_sql_history");
      if (saved) setSqlHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const saveSqlToHistory = (db: string, sql: string) => {
    try {
      const entry = {
        db,
        sql: sql.trim(),
        time: new Date().toLocaleTimeString("pt-BR"),
      };
      const filtered = sqlHistory.filter(
        (h) => !(h.db === db && h.sql === entry.sql)
      );
      const updated = [entry, ...filtered].slice(0, 20);
      setSqlHistory(updated);
      localStorage.setItem(
        "shark_sysinit_sql_history",
        JSON.stringify(updated)
      );
    } catch {}
  };

  const fetchSqlTables = useCallback(
    async (targetDb: string, overrideSqlPin?: string) => {
      const activeSqlPin = overrideSqlPin ?? sqlPin;
      if (!activeSqlPin) return;
      setLoadingTables(true);
      try {
        const res = await fetch("/api/tenants/setup/sql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-setup-pin": pin,
            "x-sql-pin": activeSqlPin,
          },
          body: JSON.stringify({ database: targetDb, sql: "SHOW TABLES" }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 403) {
            setSqlPinError(true);
            setSqlUnlocked(false);
          }
          return;
        }
        setSqlUnlocked(true);
        setSqlPinError(false);
        const list = (data.rows || [])
          .map((r: any[]) => r[0])
          .filter(Boolean);
        setSqlTables(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingTables(false);
      }
    },
    [pin, sqlPin]
  );

  const handleUnlockSql = async (e: React.FormEvent) => {
    e.preventDefault();
    setSqlPinError(false);
    await fetchSqlTables(sqlDb, sqlPin);
  };

  const executeSql = async (customSql?: string, customDb?: string) => {
    const queryToRun = (customSql ?? sqlQuery).trim();
    const targetDb = customDb ?? sqlDb;
    if (!queryToRun) return;

    setSqlRunning(true);
    setSqlError("");
    setEditingCell(null);
    try {
      const res = await fetch("/api/tenants/setup/sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-pin": pin,
          "x-sql-pin": sqlPin,
        },
        body: JSON.stringify({ database: targetDb, sql: queryToRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setSqlPinError(true);
          setSqlUnlocked(false);
        }
        throw new Error(data.error || "Erro ao executar SQL");
      }
      setSqlResult(data);
      saveSqlToHistory(targetDb, queryToRun);
    } catch (err: any) {
      setSqlError(err.message);
      setSqlResult(null);
    } finally {
      setSqlRunning(false);
    }
  };

  const getActiveTableName = (sql: string): string | null => {
    const m = sql.match(/FROM\s+["`]?([a-zA-Z0-9_]+)["`]?/i);
    return m ? m[1] : null;
  };

  const handleSaveInlineCell = async () => {
    if (!editingCell) return;
    const tableName = getActiveTableName(sqlQuery);
    if (!tableName) {
      showToast(
        "Não foi possível detectar a tabela principal na query atual.",
        "error"
      );
      return;
    }

    setSavingCell(true);
    try {
      const escapedVal =
        editingCell.value === "NULL"
          ? "NULL"
          : `'${editingCell.value.replace(/'/g, "''")}'`;
      const escapedPk =
        typeof editingCell.pkVal === "number"
          ? editingCell.pkVal
          : `'${String(editingCell.pkVal).replace(/'/g, "''")}'`;

      const updateSql = `UPDATE "${tableName}" SET "${editingCell.colName}" = ${escapedVal} WHERE "${editingCell.pkCol}" = ${escapedPk};`;

      const res = await fetch("/api/tenants/setup/sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-pin": pin,
          "x-sql-pin": sqlPin,
        },
        body: JSON.stringify({ database: sqlDb, sql: updateSql }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar célula");

      setEditingCell(null);
      showToast("Célula atualizada direto no PostgreSQL!", "success");
      await executeSql(sqlQuery, sqlDb);
    } catch (err: any) {
      showToast("Erro ao salvar célula: " + err.message, "error");
    } finally {
      setSavingCell(false);
    }
  };

  const handleDeleteRowFromTable = async (pkCol: string, pkVal: any) => {
    const tableName = getActiveTableName(sqlQuery);
    if (!tableName) {
      showToast("Não foi possível identificar a tabela na query.", "error");
      return;
    }
    if (
      !confirm(
        `Confirma EXCLUIR permanentemente o registro (${pkCol} = ${pkVal}) da tabela "${tableName}" no banco "${sqlDb}"?`
      )
    )
      return;

    const escapedPk =
      typeof pkVal === "number"
        ? pkVal
        : `'${String(pkVal).replace(/'/g, "''")}'`;
    const delSql = `DELETE FROM "${tableName}" WHERE "${pkCol}" = ${escapedPk};`;
    await executeSql(delSql, sqlDb);
    await executeSql(sqlQuery, sqlDb);
  };

  /* ============================================================================
   * LOCK SCREEN (PIN MESTRE)
   * ============================================================================ */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#060d0b] flex flex-col items-center justify-center p-4 selection:bg-emerald-500/30 selection:text-emerald-200">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12)_0,transparent_100%)] pointer-events-none" />

        <div className="w-full max-w-md bg-zinc-900/85 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(16,185,129,0.08)] relative z-10">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <KeyRound size={30} />
          </div>

          <h1 className="text-2xl font-bold text-center text-white mb-2">
            Acesso Restrito
          </h1>
          <p className="text-zinc-400 text-center text-sm mb-8">
            Área de provisionamento e controle de infraestrutura Multi-Tenant do
            Shark. Insira o PIN Mestre.
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <SysPasswordInput
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••••••••"
                autoFocus
                iconSize={20}
                inputClassName={`bg-zinc-950 border ${
                  pinError
                    ? "border-rose-500/50 focus:border-rose-500"
                    : "border-zinc-800 focus:border-emerald-500"
                } rounded-2xl pl-4 py-4 text-center text-white tracking-[0.3em] text-lg focus:outline-none transition-all shadow-inner`}
              />
              {pinError && (
                <p className="text-rose-400 text-xs text-center mt-2 animate-shake">
                  PIN incorreto. Acesso negado.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !pin}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center space-x-2 shadow-[0_0_25px_rgba(16,185,129,0.3)] active:scale-[0.99]"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <span>Desbloquear Painel</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ============================================================================
   * COMPUTED METRICS & FILTERING
   * ============================================================================ */
  const nowDate = new Date();
  const todayMidnight = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  );
  const dueSoonLimit = new Date(todayMidnight);
  dueSoonLimit.setDate(dueSoonLimit.getDate() + 7);

  const getTenantDueDay = (tenant: any) => {
    if (!tenant.mensalidadeVencimento) return null;
    const due = new Date(tenant.mensalidadeVencimento);
    if (Number.isNaN(due.getTime())) return null;
    return new Date(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  };

  const isTenantOverdue = (tenant: any) => {
    const dueDay = getTenantDueDay(tenant);
    return Boolean(
      tenant.status === "active" && dueDay && dueDay < todayMidnight
    );
  };

  const isTenantDueSoon = (tenant: any) => {
    const dueDay = getTenantDueDay(tenant);
    return Boolean(
      tenant.status === "active" &&
        dueDay &&
        dueDay >= todayMidnight &&
        dueDay <= dueSoonLimit
    );
  };

  const filteredTenants = tenants.filter((tenant) => {
    const q = tenantSearch.trim().toLowerCase();
    const adminEmails = (tenant.users || [])
      .map((u: any) => u.email)
      .join(" ");
    const matchesQuery =
      !q ||
      [
        tenant.nomeFantasia,
        tenant.name,
        tenant.razaoSocial,
        tenant.cnpj,
        tenant.databaseName,
        tenant.cidade,
        tenant.telefone,
        adminEmails,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));

    if (!matchesQuery) return false;
    if (statusFilter === "active") return tenant.status === "active";
    if (statusFilter === "suspended") return tenant.status !== "active";
    if (statusFilter === "overdue") return isTenantOverdue(tenant);
    if (statusFilter === "dueSoon") return isTenantDueSoon(tenant);
    if (statusFilter === "noDate") return !getTenantDueDay(tenant);
    return true;
  });

  const activeTenantsCount = tenants.filter(
    (t) => t.status === "active"
  ).length;
  const overdueTenantsCount = tenants.filter(isTenantOverdue).length;
  const dueSoonTenantsCount = tenants.filter(isTenantDueSoon).length;
  const totalExpectedMonthly = tenants
    .filter((t) => t.status === "active")
    .reduce((acc, t) => acc + Number(t.mensalidadeValor || 0), 0);

  const visibleTenantIds = filteredTenants.map((tenant) => tenant.id);
  const allVisibleSelected =
    visibleTenantIds.length > 0 &&
    visibleTenantIds.every((id) => selectedTenantIds.includes(id));

  // Options for Custom Selects
  const sqlDatabaseOptions = [
    {
      value: "heart",
      label: "heart (Banco Central)",
      sublabel: "Tenants, Users, Pagamentos",
      badge: "HEART",
    },
    ...tenants.map((t) => ({
      value: t.databaseName,
      label: t.nomeFantasia || t.name,
      sublabel: t.databaseName,
      badge: t.status === "active" ? "ATIVO" : "SUSPENSO",
    })),
  ];

  const backupScopeOptions = [
    {
      value: "all",
      label: "Todos os Bancos",
      sublabel: `__heart__ + ${tenants.length} clientes`,
      badge: "COMPLETO",
    },
    {
      value: "heart",
      label: "Apenas __heart__",
      sublabel: "Catálogo Central de Tenants e Usuários",
      badge: "HEART",
    },
    ...tenants.map((t) => ({
      value: t.databaseName,
      label: t.nomeFantasia || t.name,
      sublabel: t.databaseName,
      badge: "TENANT",
    })),
  ];

  return (
    <div className="min-h-screen bg-[#060d0b] text-white relative overflow-x-hidden pb-28 md:pb-12 sys-scrollbar">
      {/* Background Ambience in Shark Emerald Tones */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/12 blur-[130px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-5 right-4 left-4 sm:left-auto z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl animate-fadeIn bg-zinc-900/95 border-emerald-500/35">
          {toast.type === "success" ? (
            <CheckCircle2 className="text-emerald-400 shrink-0" size={18} />
          ) : (
            <AlertCircle className="text-rose-400 shrink-0" size={18} />
          )}
          <span className="text-xs sm:text-sm font-semibold text-zinc-100">
            {toast.message}
          </span>
        </div>
      )}

      {/* ====================================================================
       * STICKY APP HEADER (MOBILE & DESKTOP)
       * ==================================================================== */}
      <header className="sticky top-0 z-30 bg-[#060d0b]/85 backdrop-blur-xl border-b border-emerald-500/15">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.3)] shrink-0 border border-emerald-400/30">
              <Database size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl md:text-2xl font-black tracking-tight truncate">
                  Shark{" "}
                  <span className="text-emerald-400">Multi-Tenant</span>
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck size={11} /> Sys-Init
                </span>
              </div>
              <p className="text-zinc-400 text-[11px] sm:text-xs truncate">
                Provisionamento isolado de bancos PostgreSQL e gestão de
                clientes
              </p>
            </div>
          </div>

          {/* Desktop Navigation Pills + Quick Utility Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 bg-zinc-900/90 border border-emerald-500/20 p-1 rounded-2xl">
              <button
                onClick={() => setView("list")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  view === "list"
                    ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)]"
                    : "text-zinc-300 hover:text-white hover:bg-zinc-800/70"
                }`}
              >
                <Building2 size={14} />
                <span>Empresas</span>
              </button>
              <button
                onClick={() => setView("calendar")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  view === "calendar"
                    ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)]"
                    : "text-zinc-300 hover:text-white hover:bg-zinc-800/70"
                }`}
              >
                <CalendarDays size={14} />
                <span>Calendário</span>
                {overdueTenantsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black">
                    {overdueTenantsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setView("new");
                  setSuccessData(null);
                  setErrorMsg("");
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  view === "new"
                    ? "bg-emerald-500 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                    : "text-emerald-300 hover:bg-emerald-500/15"
                }`}
              >
                <Plus size={14} />
                <span>Nova Empresa</span>
              </button>
              <button
                onClick={() => {
                  setView("sql");
                  if (sqlUnlocked) fetchSqlTables(sqlDb);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  view === "sql"
                    ? "bg-amber-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.35)]"
                    : "text-amber-300 hover:bg-amber-500/15"
                }`}
              >
                <Terminal size={14} />
                <span>SQL Editor</span>
              </button>
              <button
                onClick={() => {
                  setView("backups");
                  fetchBackups();
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  view === "backups"
                    ? "bg-teal-500 text-zinc-950 shadow-[0_0_15px_rgba(20,184,166,0.35)]"
                    : "text-teal-300 hover:bg-teal-500/15"
                }`}
              >
                <Archive size={14} />
                <span>Backups</span>
              </button>
            </div>

            <SysTooltip content="Recarregar dados do servidor">
              <button
                onClick={() => fetchTenants()}
                disabled={loading}
                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-emerald-300 hover:border-emerald-500/40 transition active:scale-95"
                aria-label="Recarregar"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin text-emerald-400" : ""}
                />
              </button>
            </SysTooltip>

            <SysTooltip content="Bloquear painel e exigir PIN novamente">
              <button
                onClick={handleLockSession}
                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition active:scale-95"
                aria-label="Bloquear Painel"
              >
                <LogOut size={16} />
              </button>
            </SysTooltip>
          </div>
        </div>
      </header>

      {/* ====================================================================
       * MAIN CONTAINER
       * ==================================================================== */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 relative z-10 space-y-5">
        {/* KPI SUMMARY STRIP (2x2 on mobile, 4 cols on desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          <div className="rounded-2xl bg-zinc-900/75 border border-emerald-500/20 px-3.5 py-3 flex items-center justify-between gap-2 shadow-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                Empresas Ativas
              </p>
              <p className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5">
                {activeTenantsCount}
                <span className="text-xs font-medium text-zinc-500 ml-1">
                  / {tenants.length}
                </span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 size={18} />
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-900/75 border border-rose-500/20 px-3.5 py-3 flex items-center justify-between gap-2 shadow-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                Em Atraso
              </p>
              <p className="text-lg sm:text-xl font-black text-rose-400 mt-0.5">
                {overdueTenantsCount}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <AlertCircle size={18} />
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-900/75 border border-amber-500/20 px-3.5 py-3 flex items-center justify-between gap-2 shadow-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                Vencem em 7 dias
              </p>
              <p className="text-lg sm:text-xl font-black text-amber-300 mt-0.5">
                {dueSoonTenantsCount}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
              <Clock size={18} />
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-900/75 border border-teal-500/25 px-3.5 py-3 flex items-center justify-between gap-2 shadow-sm">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                Receita Mensal (MRR)
              </p>
              <p className="text-base sm:text-xl font-black text-teal-300 font-mono truncate mt-0.5">
                {totalExpectedMonthly.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-300 shrink-0">
              <TrendingUp size={18} />
            </div>
          </div>
        </div>

        {/* ==================================================================
         * TOOLBAR DE FILTROS & AÇÕES EM LOTE (LIST & CALENDAR)
         * ================================================================== */}
        {(view === "list" || view === "calendar") && (
          <div className="rounded-2xl border border-emerald-500/20 bg-zinc-900/65 p-3.5 sm:p-4 space-y-3 shadow-lg">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400/70"
                />
                <input
                  type="text"
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                  placeholder="Buscar por nome fantasia, CNPJ, banco, cidade, WhatsApp ou e-mail..."
                  className="w-full bg-zinc-950/90 border border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                {tenantSearch && (
                  <button
                    type="button"
                    onClick={() => setTenantSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Horizontally Scrollable Filter Chips on Mobile */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  { id: "all", label: `Todos (${tenants.length})` },
                  { id: "active", label: `Ativas (${activeTenantsCount})` },
                  {
                    id: "suspended",
                    label: `Suspensas (${tenants.length - activeTenantsCount})`,
                  },
                  { id: "overdue", label: `Em Atraso (${overdueTenantsCount})` },
                  { id: "dueSoon", label: `Próx. 7d (${dueSoonTenantsCount})` },
                  {
                    id: "noDate",
                    label: `Sem Data (${
                      tenants.filter((t) => !getTenantDueDay(t)).length
                    })`,
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatusFilter(item.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 active:scale-95 ${
                      statusFilter === item.id
                        ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/45 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                        : "bg-zinc-950/80 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Actions Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-zinc-800/80 text-xs">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <SysCheckbox
                  size="sm"
                  checked={allVisibleSelected}
                  onChange={() => {
                    if (allVisibleSelected) {
                      setSelectedTenantIds((prev) =>
                        prev.filter((id) => !visibleTenantIds.includes(id))
                      );
                    } else {
                      setSelectedTenantIds((prev) =>
                        Array.from(new Set([...prev, ...visibleTenantIds]))
                      );
                    }
                  }}
                  label={`Selecionar visíveis (${filteredTenants.length})`}
                />

                <SysCheckbox
                  size="sm"
                  checked={includeHeartMigration}
                  onChange={setIncludeHeartMigration}
                  label="Incluir banco Heart nas migrações"
                />

                {selectedTenantIds.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                    <span>{selectedTenantIds.length} selecionado(s)</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTenantIds([])}
                      className="text-emerald-200 hover:text-white ml-1"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <SysTooltip content="Executar prisma db push nos bancos selecionados ou em todos">
                  <button
                    type="button"
                    onClick={() =>
                      handleMigrateAll(
                        selectedTenantIds.length
                          ? selectedTenantIds
                          : undefined
                      )
                    }
                    disabled={
                      migrating ||
                      (tenants.length === 0 && !includeHeartMigration)
                    }
                    className="px-3 py-1.5 rounded-xl font-bold bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 disabled:opacity-40 transition flex items-center gap-1.5 active:scale-95"
                  >
                    <RefreshCw
                      size={13}
                      className={migrating ? "animate-spin" : ""}
                    />
                    <span>
                      {migrating
                        ? "Migrando..."
                        : selectedTenantIds.length
                        ? `Migrar (${selectedTenantIds.length})`
                        : "Atualizar Bancos"}
                    </span>
                  </button>
                </SysTooltip>

                {selectedTenantIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      disabled={bulkStatusLoading}
                      onClick={() => handleBulkStatusChange("active")}
                      className="px-3 py-1.5 rounded-xl font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 disabled:opacity-40 transition flex items-center gap-1 active:scale-95"
                    >
                      <Check size={13} /> Ativar Lote
                    </button>
                    <button
                      type="button"
                      disabled={bulkStatusLoading}
                      onClick={() => handleBulkStatusChange("suspended")}
                      className="px-3 py-1.5 rounded-xl font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 disabled:opacity-40 transition flex items-center gap-1 active:scale-95"
                    >
                      <Ban size={13} /> Suspender Lote
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
         * VIEW: CALENDAR (7-COLUMN DESKTOP + NATIVE MOBILE AGENDA)
         * ================================================================== */}
        {view === "calendar" && (
          <TenantBillingCalendar
            tenants={filteredTenants}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selectedIds={selectedTenantIds}
            onToggleTenant={toggleTenantSelection}
            onEdit={(tenant) => handleOpenEdit(tenant, "finance")}
            onRegisterPayment={handleRegistrarPagamento}
            onImpersonate={(tenant) => handleImpersonate(tenant)}
          />
        )}

        {/* ==================================================================
         * VIEW: LIST OF TENANTS (RESPONSIVE CARDS)
         * ================================================================== */}
        {view === "list" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <Loader2
                  className="animate-spin mb-4 text-emerald-500"
                  size={32}
                />
                <p className="text-sm">
                  Carregando infraestrutura de clientes...
                </p>
              </div>
            ) : tenants.length === 0 ? (
              <div className="bg-zinc-900/50 border border-emerald-500/20 rounded-3xl p-8 sm:p-12 text-center">
                <Building2
                  size={48}
                  className="mx-auto text-emerald-500/50 mb-4"
                />
                <h3 className="text-lg font-bold text-zinc-200 mb-2">
                  Nenhuma empresa provisionada ainda
                </h3>
                <p className="text-zinc-400 max-w-md mx-auto mb-6 text-sm">
                  O banco central (Heart) está ativo, mas ainda não há bancos de
                  clientes criados. Provisione o primeiro ambiente abaixo.
                </p>
                <button
                  onClick={() => setView("new")}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 rounded-xl font-bold transition inline-flex items-center space-x-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <Plus size={18} />
                  <span>Provisionar Primeiro Cliente</span>
                </button>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-10 text-center">
                <Search size={36} className="mx-auto text-zinc-600 mb-3" />
                <h3 className="text-base font-bold text-zinc-300 mb-1">
                  Nenhum cliente corresponde aos filtros atuais
                </h3>
                <p className="text-xs text-zinc-500 mb-4">
                  Limpe a busca ou altere o filtro de status para visualizar as
                  empresas.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTenantSearch("");
                    setStatusFilter("all");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {filteredTenants.map((t) => {
                  const venc = t.mensalidadeVencimento
                    ? new Date(t.mensalidadeVencimento)
                    : null;
                  const vencDay = venc
                    ? new Date(
                        venc.getUTCFullYear(),
                        venc.getUTCMonth(),
                        venc.getUTCDate()
                      )
                    : null;
                  const vencido =
                    vencDay && vencDay < todayMidnight && t.status === "active";
                  const venceEmBreve = isTenantDueSoon(t);
                  const isSelected = selectedTenantIds.includes(t.id);
                  const primaryUser = (t.users || [])[0];
                  const cleanPhone = t.telefone
                    ? String(t.telefone).replace(/\D/g, "")
                    : "";

                  return (
                    <div
                      key={t.id}
                      className={`bg-zinc-900/75 border ${
                        isSelected
                          ? "border-emerald-500/80 ring-1 ring-emerald-500/35"
                          : vencido
                          ? "border-rose-500/40"
                          : "border-zinc-800/90"
                      } rounded-2xl p-4 sm:p-5 hover:border-emerald-500/45 transition-all group relative overflow-hidden flex flex-col justify-between shadow-lg`}
                    >
                      <div
                        className={`absolute top-0 left-0 w-1.5 h-full ${
                          t.status === "active"
                            ? vencido
                              ? "bg-rose-500"
                              : "bg-emerald-500"
                            : "bg-zinc-600"
                        }`}
                      />

                      <div>
                        {/* Card Top Row */}
                        <div className="flex justify-between items-start gap-2 mb-3 pl-1">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <SysCheckbox
                              size="sm"
                              checked={isSelected}
                              onChange={(val) =>
                                toggleTenantSelection(t.id, val)
                              }
                            />
                            {t.logo ? (
                              <img
                                src={t.logo}
                                alt=""
                                className="w-10 h-10 rounded-xl object-cover border border-emerald-500/30 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-black text-sm shrink-0">
                                {(t.nomeFantasia || t.name || "S")
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="font-bold text-base text-white group-hover:text-emerald-300 transition truncate">
                                {t.nomeFantasia || t.name}
                              </h3>
                              {t.razaoSocial && (
                                <p className="text-[11px] text-zinc-400 truncate">
                                  {t.razaoSocial}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              t.status === "active"
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                            }`}
                          >
                            {t.status === "active" ? "Ativa" : "Suspensa"}
                          </span>
                        </div>

                        {/* Contact & Quick Copy Row */}
                        <div className="space-y-1.5 text-xs text-zinc-400 mb-3 pl-1">
                          {t.cnpj && (
                            <p className="font-mono text-zinc-300 text-[11px]">
                              CNPJ/CPF: {t.cnpj}
                            </p>
                          )}
                          {(t.telefone || t.cidade) && (
                            <div className="flex items-center justify-between gap-2">
                              <p className="flex items-center space-x-1.5 truncate">
                                <Phone
                                  size={12}
                                  className="text-emerald-400 shrink-0"
                                />
                                <span className="truncate">
                                  {[t.telefone, t.cidade]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </p>
                              {cleanPhone && (
                                <SysTooltip content="Conversar no WhatsApp">
                                  <a
                                    href={`https://wa.me/55${cleanPhone}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] font-bold shrink-0"
                                  >
                                    <MessageCircle size={11} /> WhatsApp
                                  </a>
                                </SysTooltip>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-zinc-800/80">
                            <div className="flex items-center space-x-2 min-w-0">
                              <Server
                                size={13}
                                className="text-emerald-400 shrink-0"
                              />
                              <span className="font-mono text-zinc-300 truncate">
                                {t.databaseName}
                              </span>
                            </div>
                            <SysTooltip content="Copiar nome do banco PostgreSQL">
                              <button
                                type="button"
                                onClick={() =>
                                  copyValue(
                                    `db-${t.id}`,
                                    t.databaseName,
                                    "Nome do banco"
                                  )
                                }
                                className="text-zinc-500 hover:text-emerald-300 shrink-0 p-0.5"
                              >
                                {copiedKey === `db-${t.id}` ? (
                                  <Check
                                    size={13}
                                    className="text-emerald-400"
                                  />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            </SysTooltip>
                          </div>

                          {primaryUser && (
                            <div className="flex items-center justify-between gap-2 bg-zinc-950/60 px-3 py-1.5 rounded-xl border border-zinc-800/60">
                              <div className="flex items-center space-x-2 min-w-0">
                                <Users
                                  size={13}
                                  className="text-teal-400 shrink-0"
                                />
                                <span className="truncate text-zinc-300">
                                  {primaryUser.email}
                                </span>
                                {(t._count?.users || 0) > 1 && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 shrink-0">
                                    +{t._count.users - 1}
                                  </span>
                                )}
                              </div>
                              <SysTooltip content="Copiar e-mail do administrador">
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyValue(
                                      `email-${t.id}`,
                                      primaryUser.email,
                                      "E-mail"
                                    )
                                  }
                                  className="text-zinc-500 hover:text-emerald-300 shrink-0 p-0.5"
                                >
                                  {copiedKey === `email-${t.id}` ? (
                                    <Check
                                      size={13}
                                      className="text-emerald-400"
                                    />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                              </SysTooltip>
                            </div>
                          )}
                        </div>

                        {/* Financial Box */}
                        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 mb-2 flex items-center justify-between text-xs ml-1">
                          <div>
                            <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                              Mensalidade
                            </span>
                            <span className="font-bold text-emerald-400 font-mono text-sm">
                              {t.mensalidadeValor != null
                                ? `R$ ${Number(t.mensalidadeValor).toFixed(2)}`
                                : "Não definida"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-zinc-500 block text-[10px] uppercase font-bold">
                              Vencimento
                            </span>
                            <span
                              className={`font-semibold ${
                                vencido
                                  ? "text-rose-400 font-bold"
                                  : venceEmBreve
                                  ? "text-amber-300 font-bold"
                                  : "text-zinc-300"
                              }`}
                            >
                              {venc
                                ? venc.toLocaleDateString("pt-BR", {
                                    timeZone: "UTC",
                                  })
                                : "—"}{" "}
                              {vencido && "(Vencido)"}
                              {!vencido && venceEmBreve && "(Em breve)"}
                            </span>
                          </div>
                        </div>

                        <div className="pl-1">
                          <ModuleBadges raw={t.modules} />
                        </div>
                      </div>

                      {/* Responsive Native Action Footer */}
                      <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-2 pl-1">
                        {/* Primary Thumb Row */}
                        <div className="grid grid-cols-2 gap-2">
                          <SysTooltip content="Logar imediatamente no painel desta empresa sem digitar senha">
                            <button
                              type="button"
                              onClick={() => handleImpersonate(t)}
                              disabled={impersonatingId === t.id}
                              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.25)] transition active:scale-95"
                            >
                              {impersonatingId === t.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <LogIn size={14} />
                              )}
                              <span>Acessar Painel</span>
                            </button>
                          </SysTooltip>

                          <SysTooltip content="Confirmar pagamento e avançar vencimento em +1 mês">
                            <button
                              type="button"
                              onClick={() => handleRegistrarPagamento(t.id)}
                              className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                            >
                              <DollarSign size={14} />
                              <span>Quitar (+1 Mês)</span>
                            </button>
                          </SysTooltip>
                        </div>

                        {/* Secondary Icon Grid */}
                        <div className="grid grid-cols-4 gap-1.5">
                          <SysTooltip content="Raio-X do Banco PostgreSQL (Clientes, Empréstimos, Volume)">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(t, "xray")}
                              className="w-full py-2 rounded-xl bg-zinc-950/80 hover:bg-teal-500/15 text-zinc-300 hover:text-teal-300 border border-zinc-800/90 hover:border-teal-500/30 flex items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95"
                            >
                              <Activity size={13} />
                              <span className="hidden min-[380px]:inline">
                                Raio-X
                              </span>
                            </button>
                          </SysTooltip>

                          <SysTooltip content="Gerenciar usuários, senhas e PINs">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(t, "users")}
                              className="w-full py-2 rounded-xl bg-zinc-950/80 hover:bg-emerald-500/15 text-zinc-300 hover:text-emerald-300 border border-zinc-800/90 hover:border-emerald-500/30 flex items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95"
                            >
                              <Users size={13} />
                              <span className="hidden min-[380px]:inline">
                                Senhas
                              </span>
                            </button>
                          </SysTooltip>

                          <SysTooltip content="Editar cadastro, módulos e financeiro">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(t, "info")}
                              className="w-full py-2 rounded-xl bg-zinc-950/80 hover:bg-emerald-500/15 text-zinc-300 hover:text-emerald-300 border border-zinc-800/90 hover:border-emerald-500/30 flex items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95"
                            >
                              <Edit size={13} />
                              <span className="hidden min-[380px]:inline">
                                Editar
                              </span>
                            </button>
                          </SysTooltip>

                          <SysTooltip content="Remover empresa e revogar acessos">
                            <button
                              type="button"
                              onClick={() => handleDelete(t.id, t.name)}
                              className="w-full py-2 rounded-xl bg-zinc-950/80 hover:bg-rose-500/15 text-zinc-400 hover:text-rose-400 border border-zinc-800/90 hover:border-rose-500/30 flex items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-95"
                            >
                              <Trash2 size={13} />
                              <span className="hidden min-[380px]:inline">
                                Excluir
                              </span>
                            </button>
                          </SysTooltip>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
         * VIEW: NEW TENANT (PROVISIONAMENTO)
         * ================================================================== */}
        {view === "new" && (
          <div className="max-w-2xl mx-auto">
            {successData ? (
              <div className="bg-emerald-950/30 border border-emerald-500/35 rounded-3xl p-6 sm:p-8 text-center animate-fadeIn shadow-2xl">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 size={34} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Ambiente Provisionado com Sucesso!
                </h2>
                <p className="text-emerald-200/80 mb-6 text-sm">
                  O banco de dados exclusivo foi criado no PostgreSQL, todas as
                  tabelas do Shark foram migradas e o administrador já pode
                  entrar.
                </p>

                <div className="bg-zinc-950/90 rounded-2xl p-5 text-left font-mono text-xs sm:text-sm space-y-2.5 mb-6 border border-emerald-500/25">
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Empresa:</span>
                    <span className="text-white font-bold">
                      {successData.tenant?.name}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Database PostgreSQL:</span>
                    <span className="text-emerald-400">
                      {successData.tenant?.databaseName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Login Admin:</span>
                    <span className="text-teal-300">
                      {successData.adminUser?.email}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Senha Inicial:</span>
                    <span className="text-amber-300">
                      {successData.plainPassword}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      const msg = `*Acesso Liberado — Shark Soluções Financeiras*\n\n*Empresa:* ${successData.tenant?.name}\n*URL:* ${window.location.origin}/login\n*E-mail:* ${successData.adminUser?.email}\n*Senha:* ${successData.plainPassword}`;
                      copyValue(
                        "whatsapp-creds",
                        msg,
                        "Credenciais para WhatsApp"
                      );
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm shadow-lg"
                  >
                    <Copy size={16} />
                    <span>Copiar Credenciais para WhatsApp</span>
                  </button>

                  {successData.tenant?.id && (
                    <button
                      type="button"
                      onClick={() => handleImpersonate(successData.tenant)}
                      className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm shadow-lg"
                    >
                      <LogIn size={16} />
                      <span>Entrar no Painel Agora</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSuccessData(null);
                      setView("list");
                    }}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-5 py-3 rounded-xl font-bold transition text-sm"
                  >
                    Voltar para Lista
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/75 border border-emerald-500/20 rounded-3xl p-5 sm:p-8 backdrop-blur-xl shadow-2xl">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold flex items-center space-x-2">
                      <Sparkles className="text-emerald-400" size={20} />
                      <span>Provisionar Nova Empresa</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Cria automaticamente o banco PostgreSQL isolado, aplica o
                      schema e registra o usuário administrador.
                    </p>
                  </div>
                </div>

                {errorMsg && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 mb-6 flex items-start space-x-3 text-rose-400 text-sm">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">
                        Falha no Provisionamento
                      </span>
                      {errorMsg}
                    </div>
                  </div>
                )}

                <form onSubmit={handleProvision} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
                      <Database size={14} />
                      <span>1. Instância do Banco de Dados</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">
                          Nome da Empresa (Fantasia)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Matriz Capital"
                          value={tenantName}
                          onChange={(e) =>
                            handleTenantNameChange(e.target.value)
                          }
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">
                          Database PostgreSQL (Slug Único)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: shark_matriz_capital"
                          value={dbName}
                          onChange={(e) => handleDbNameChange(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-emerald-300 font-mono focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-zinc-950/70 border border-zinc-800/80 p-3.5">
                      <SysCheckbox
                        checked={seedDefaults}
                        onChange={setSeedDefaults}
                        label="Popular configurações padrão do Shark"
                        description="Cria automaticamente taxas padrão de juros, multa e templates de cobrança WhatsApp no novo banco."
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-zinc-800/80">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center space-x-2">
                      <UserCheck size={14} />
                      <span>2. Administrador Principal</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">
                          Nome do Responsável
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: João Silva"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">
                          E-mail de Login
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="Ex: admin@empresa.com.br"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">
                          Senha Inicial
                        </label>
                        <SysPasswordInput
                          required
                          placeholder="Digite a senha inicial"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          inputClassName="bg-zinc-950 border border-zinc-800 rounded-xl pl-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">
                          Confirmar Senha
                        </label>
                        <SysPasswordInput
                          required
                          placeholder="Repita a senha"
                          value={adminPasswordConfirm}
                          onChange={(e) =>
                            setAdminPasswordConfirm(e.target.value)
                          }
                          inputClassName="bg-zinc-950 border border-zinc-800 rounded-xl pl-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={provisioning}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-[0.99]"
                    >
                      {provisioning ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          <span>
                            Criando Banco e Aplicando Tabelas (Aguarde ~10s)...
                          </span>
                        </>
                      ) : (
                        <>
                          <Database size={18} />
                          <span>Provisionar Empresa e Banco de Dados</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
         * VIEW: EDIT TENANT (5 ABAS COMPLETAS + MOBILE NATIVO)
         * ================================================================== */}
        {view === "edit" && editingTenant && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-zinc-900/75 border border-emerald-500/20 rounded-3xl p-4 sm:p-8 backdrop-blur-xl relative shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-zinc-800">
                <div className="flex items-center space-x-3 min-w-0">
                  {editingTenant.logo ? (
                    <img
                      src={editingTenant.logo}
                      alt="Logo"
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover border border-emerald-500/30 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Building2 size={22} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-xl font-bold text-white truncate">
                      {editingTenant.nomeFantasia || editingTenant.name}
                    </h2>
                    <p className="text-xs text-emerald-400/80 font-mono truncate">
                      {editingTenant.databaseName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleImpersonate(editingTenant)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  >
                    <LogIn size={14} />
                    <span>Acessar Painel</span>
                  </button>
                  <SysTooltip content="Fechar edição e voltar para a lista">
                    <button
                      onClick={() => {
                        setEditingTenant(null);
                        setView("list");
                      }}
                      className="text-zinc-400 hover:text-white p-2 bg-zinc-800/60 rounded-xl transition"
                    >
                      <X size={18} />
                    </button>
                  </SysTooltip>
                </div>
              </div>

              {/* Swipeable Mobile-Friendly Tabs */}
              <div className="flex gap-1.5 mb-6 bg-zinc-950/90 p-1.5 rounded-2xl border border-zinc-800/80 overflow-x-auto no-scrollbar">
                {[
                  { id: "info", label: "Identidade", icon: Building2 },
                  { id: "modules", label: "Módulos", icon: Shield },
                  { id: "finance", label: "Financeiro", icon: DollarSign },
                  { id: "users", label: "Usuários", icon: Users },
                  { id: "xray", label: "Raio-X do Banco", icon: Activity },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditTab(t.id as any)}
                      className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                        editTab === t.id
                          ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)]"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Icon size={14} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-6 text-rose-400 text-sm">
                  {errorMsg}
                </div>
              )}

              {/* ABA 1: IDENTIDADE & CONTATO */}
              {editTab === "info" && (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/80">
                    {editingTenant.logo ? (
                      <img
                        src={editingTenant.logo}
                        alt="Preview"
                        className="w-16 h-16 rounded-2xl object-cover border border-emerald-500/30 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                        <Upload size={22} />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="text-xs text-zinc-400 block mb-1.5 font-semibold">
                        Logo da Empresa (PNG/JPG)
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold px-3.5 py-2 rounded-xl border border-emerald-500/30 transition inline-flex items-center space-x-1.5">
                          <Upload size={13} />
                          <span>Enviar Imagem</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </label>
                        {editingTenant.logo && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingTenant({ ...editingTenant, logo: "" })
                            }
                            className="text-xs text-rose-400 hover:underline px-2 py-1"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="w-full sm:w-56">
                      <label className="block text-xs text-zinc-400 mb-1 font-semibold">
                        Status da Conta
                      </label>
                      <SysSelect
                        value={editingTenant.status}
                        onChange={(val) =>
                          setEditingTenant({
                            ...editingTenant,
                            status: val,
                          })
                        }
                        options={[
                          {
                            value: "active",
                            label: "Ativa (Liberada)",
                            badge: "ON",
                          },
                          {
                            value: "suspended",
                            label: "Suspensa (Bloqueada)",
                            badge: "OFF",
                          },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Nome de Exibição (Interno)
                      </label>
                      <input
                        type="text"
                        required
                        value={editingTenant.name || ""}
                        onChange={(e) =>
                          setEditingTenant({
                            ...editingTenant,
                            name: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Nome Fantasia
                      </label>
                      <input
                        type="text"
                        value={editingTenant.nomeFantasia || ""}
                        onChange={(e) =>
                          setEditingTenant({
                            ...editingTenant,
                            nomeFantasia: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Razão Social
                      </label>
                      <input
                        type="text"
                        value={editingTenant.razaoSocial || ""}
                        onChange={(e) =>
                          setEditingTenant({
                            ...editingTenant,
                            razaoSocial: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        CNPJ / CPF
                      </label>
                      <input
                        type="text"
                        placeholder="00.000.000/0001-00"
                        value={editingTenant.cnpj || ""}
                        onChange={(e) =>
                          setEditingTenant({
                            ...editingTenant,
                            cnpj: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="text"
                        placeholder="(11) 99999-9999"
                        value={editingTenant.telefone || ""}
                        onChange={(e) =>
                          setEditingTenant({
                            ...editingTenant,
                            telefone: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Cidade / UF
                      </label>
                      <input
                        type="text"
                        placeholder="São Paulo - SP"
                        value={editingTenant.cidade || ""}
                        onChange={(e) =>
                          setEditingTenant({
                            ...editingTenant,
                            cidade: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Endereço Completo
                    </label>
                    <input
                      type="text"
                      value={editingTenant.endereco || ""}
                      onChange={(e) =>
                        setEditingTenant({
                          ...editingTenant,
                          endereco: e.target.value,
                        })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Observações Internas (Visível apenas no /sys-init)
                    </label>
                    <textarea
                      rows={3}
                      value={editingTenant.observacoes || ""}
                      onChange={(e) =>
                        setEditingTenant({
                          ...editingTenant,
                          observacoes: e.target.value,
                        })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none sys-scrollbar"
                    />
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={provisioning}
                      className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-8 py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                    >
                      {provisioning ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <span>Salvar Dados da Empresa</span>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* ABA 2: MÓDULOS DO SHARK */}
              {editTab === "modules" && (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <p className="text-xs text-zinc-400 mb-2">
                    Ative ou desative os módulos contratados por este cliente:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {MODULES_CONFIG.map((m) => {
                      const active = editingTenant.modules?.[m.key] !== false;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() =>
                            setEditingTenant({
                              ...editingTenant,
                              modules: {
                                ...editingTenant.modules,
                                [m.key]: !active,
                              },
                            })
                          }
                          className={`flex items-center justify-between p-4 rounded-2xl border text-left transition active:scale-[0.99] ${
                            active
                              ? "bg-emerald-500/10 border-emerald-500/35 text-white"
                              : "bg-zinc-950/60 border-zinc-800 text-zinc-500"
                          }`}
                        >
                          <div>
                            <div className="font-bold text-sm">{m.label}</div>
                            <div className="text-xs text-zinc-400">
                              {m.desc}
                            </div>
                          </div>
                          <div
                            className={`w-11 h-6 rounded-full p-1 transition flex items-center shrink-0 ${
                              active
                                ? "bg-emerald-500 justify-end shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                                : "bg-zinc-700 justify-start"
                            }`}
                          >
                            <div className="w-4 h-4 rounded-full bg-white" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={provisioning}
                      className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-8 py-3 rounded-xl transition shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                    >
                      Salvar Módulos
                    </button>
                  </div>
                </form>
              )}

              {/* ABA 3: FINANCEIRO & HISTÓRICO */}
              {editTab === "finance" && (
                <form onSubmit={handleUpdate} className="space-y-6">
                  {/* Resumo Financeiro do Cliente */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-bold">
                        Valor Mensal
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono">
                        R${" "}
                        {Number(editingTenant.mensalidadeValor || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-bold">
                        Próx. Vencimento
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-white">
                        {editingTenant.mensalidadeVencimento
                          ? new Date(
                              editingTenant.mensalidadeVencimento
                            ).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                          : "—"}
                      </span>
                    </div>
                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-bold">
                        Pagamentos
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-teal-400">
                        {paymentHistory.length} registro(s)
                      </span>
                    </div>
                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3.5">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-bold">
                        Total Recebido
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-emerald-300 font-mono">
                        R${" "}
                        {paymentHistory
                          .reduce((acc, p) => acc + Number(p.valor || 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5 font-semibold">
                        Valor da Mensalidade (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 199.90"
                        value={editingTenant.mensalidadeValor ?? ""}
                        onChange={(e) =>
                          setEditingTenant({
                            ...editingTenant,
                            mensalidadeValor: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5 font-semibold">
                        Próximo Vencimento (Calendário do Sistema)
                      </label>
                      <SysDateTimePicker
                        value={editingTenant.mensalidadeVencimento || ""}
                        onChange={(val) =>
                          setEditingTenant({
                            ...editingTenant,
                            mensalidadeVencimento: val,
                          })
                        }
                        placeholder="Selecionar data de vencimento..."
                      />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          {
                            label: "Hoje",
                            fn: () => new Date().toISOString().split("T")[0],
                          },
                          {
                            label: "+30 dias",
                            fn: () => {
                              const d = new Date();
                              d.setDate(d.getDate() + 30);
                              return d.toISOString().split("T")[0];
                            },
                          },
                          {
                            label: "Dia 5",
                            fn: () => {
                              const d = new Date();
                              d.setMonth(d.getMonth() + 1, 5);
                              return d.toISOString().split("T")[0];
                            },
                          },
                          {
                            label: "Dia 10",
                            fn: () => {
                              const d = new Date();
                              d.setMonth(d.getMonth() + 1, 10);
                              return d.toISOString().split("T")[0];
                            },
                          },
                          {
                            label: "Dia 15",
                            fn: () => {
                              const d = new Date();
                              d.setMonth(d.getMonth() + 1, 15);
                              return d.toISOString().split("T")[0];
                            },
                          },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              setEditingTenant({
                                ...editingTenant,
                                mensalidadeVencimento: preset.fn(),
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 text-[10px] font-semibold text-zinc-400 hover:text-emerald-300 transition"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-emerald-300 text-sm flex items-center space-x-2">
                        <Calendar size={16} />
                        <span>Confirmar Recebimento de Mensalidade</span>
                      </h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Último pagamento:{" "}
                        <strong className="text-zinc-200">
                          {editingTenant.ultimoPagamento
                            ? new Date(
                                editingTenant.ultimoPagamento
                              ).toLocaleString("pt-BR")
                            : "Nenhum registrado"}
                        </strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleRegistrarPagamento(editingTenant.id)
                      }
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shrink-0 active:scale-95"
                    >
                      <Check size={15} />
                      <span>Registrar Pagamento (+1 Mês)</span>
                    </button>
                  </div>

                  {/* Histórico de Pagamentos (Mobile Cards + Desktop Table) */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-2">
                      <FileText size={14} className="text-emerald-400" />
                      <span>
                        Histórico de Pagamentos ({paymentHistory.length})
                      </span>
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
                      <>
                        {/* Mobile Cards (< sm) */}
                        <div className="sm:hidden space-y-2 max-h-60 overflow-y-auto sys-scrollbar">
                          {paymentHistory.map((log: any) => (
                            <div
                              key={log.id}
                              className="rounded-xl bg-zinc-950/70 border border-zinc-800/80 p-3 space-y-1 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-300 font-semibold">
                                  {new Date(log.dataPagamento).toLocaleString(
                                    "pt-BR"
                                  )}
                                </span>
                                <span className="font-mono font-bold text-emerald-400">
                                  R$ {Number(log.valor || 0).toFixed(2)}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400">
                                Próx. Vencimento:{" "}
                                {log.vencimentoNovo
                                  ? new Date(
                                      log.vencimentoNovo
                                    ).toLocaleDateString("pt-BR", {
                                      timeZone: "UTC",
                                    })
                                  : "—"}
                              </p>
                              {log.observacao && (
                                <p className="text-[11px] text-zinc-500">
                                  {log.observacao}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Desktop Table (sm+) */}
                        <div className="hidden sm:block bg-zinc-950/60 border border-zinc-800/80 rounded-2xl overflow-hidden max-h-60 overflow-y-auto sys-scrollbar">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-900/90 text-zinc-400 uppercase text-[10px]">
                              <tr>
                                <th className="py-2.5 px-4">Data / Hora</th>
                                <th className="py-2.5 px-4">Valor</th>
                                <th className="py-2.5 px-4">
                                  Vencimento Anterior
                                </th>
                                <th className="py-2.5 px-4">Novo Vencimento</th>
                                <th className="py-2.5 px-4">Observação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                              {paymentHistory.map((log: any) => (
                                <tr
                                  key={log.id}
                                  className="hover:bg-zinc-900/40"
                                >
                                  <td className="py-2.5 px-4 text-zinc-300">
                                    {new Date(log.dataPagamento).toLocaleString(
                                      "pt-BR"
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono font-bold text-emerald-400">
                                    R$ {Number(log.valor || 0).toFixed(2)}
                                  </td>
                                  <td className="py-2.5 px-4 text-zinc-400">
                                    {log.vencimentoAnterior
                                      ? new Date(
                                          log.vencimentoAnterior
                                        ).toLocaleDateString("pt-BR", {
                                          timeZone: "UTC",
                                        })
                                      : "—"}
                                  </td>
                                  <td className="py-2.5 px-4 text-emerald-300 font-semibold">
                                    {log.vencimentoNovo
                                      ? new Date(
                                          log.vencimentoNovo
                                        ).toLocaleDateString("pt-BR", {
                                          timeZone: "UTC",
                                        })
                                      : "—"}
                                  </td>
                                  <td className="py-2.5 px-4 text-zinc-400">
                                    {log.observacao || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={provisioning}
                      className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-8 py-3 rounded-xl transition shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                    >
                      Salvar Configuração Financeira
                    </button>
                  </div>
                </form>
              )}

              {/* ABA 4: USUÁRIOS E SENHAS (MOBILE CARDS + DESKTOP TABLE) */}
              {editTab === "users" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                      Usuários Vinculados ({tenantUsers.length})
                    </h4>
                    {loadingUsers ? (
                      <div className="py-8 text-center text-zinc-500">
                        <Loader2
                          className="animate-spin mx-auto mb-2 text-emerald-500"
                          size={24}
                        />
                        Carregando usuários...
                      </div>
                    ) : (
                      <>
                        {/* Mobile User Cards (< md) */}
                        <div className="md:hidden space-y-3">
                          {tenantUsers.map((u) => (
                            <div
                              key={u.id}
                              className="rounded-2xl bg-zinc-950/80 border border-zinc-800/90 p-3.5 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-bold text-sm text-white truncate">
                                    {u.name}
                                  </p>
                                  <p className="text-xs font-mono text-emerald-300 truncate">
                                    {u.email}
                                  </p>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                    u.active
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                  }`}
                                >
                                  {u.active ? "Ativo" : "Bloqueado"}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-center gap-1.5">
                                  <SysPasswordInput
                                    value=""
                                    onChange={() => {}}
                                    placeholder="Digite nova senha..."
                                    iconSize={15}
                                    className="flex-1"
                                    inputClassName="bg-zinc-900 border border-zinc-800 rounded-xl pl-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const wrapper = (
                                        e.currentTarget as HTMLElement
                                      ).previousElementSibling;
                                      const input = wrapper?.querySelector(
                                        "input"
                                      ) as HTMLInputElement | null;
                                      if (!input || !input.value) return;
                                      handleResetUserPassword(u.id, {
                                        password: input.value,
                                      });
                                      input.value = "";
                                    }}
                                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shrink-0"
                                  >
                                    Trocar Senha
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleImpersonate(editingTenant, u.id)
                                  }
                                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5"
                                >
                                  <LogIn size={13} /> Entrar como {u.name}
                                </button>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleResetUserPassword(u.id, {
                                        active: !u.active,
                                      })
                                    }
                                    className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"
                                  >
                                    {u.active ? (
                                      <Ban size={14} />
                                    ) : (
                                      <Check size={14} />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteUser(u.id, u.email)
                                    }
                                    className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-rose-400"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop Table (md+) */}
                        <div className="hidden md:block bg-zinc-950/60 border border-zinc-800/80 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px]">
                              <tr>
                                <th className="py-3 px-4">Nome</th>
                                <th className="py-3 px-4">E-mail (Login)</th>
                                <th className="py-3 px-4">Cargo</th>
                                <th className="py-3 px-4">PIN</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4 text-right">
                                  Ações / Trocar Senha
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                              {tenantUsers.map((u) => (
                                <tr
                                  key={u.id}
                                  className="hover:bg-zinc-900/40"
                                >
                                  <td className="py-3 px-4 font-semibold text-white">
                                    {u.name}
                                  </td>
                                  <td className="py-3 px-4 font-mono text-emerald-300">
                                    {u.email}
                                  </td>
                                  <td className="py-3 px-4 text-zinc-300">
                                    {u.role}
                                  </td>
                                  <td className="py-3 px-4 font-mono text-amber-300">
                                    {u.pin || "—"}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        u.active
                                          ? "bg-emerald-500/15 text-emerald-400"
                                          : "bg-rose-500/15 text-rose-400"
                                      }`}
                                    >
                                      {u.active ? "Ativo" : "Bloqueado"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="inline-flex items-center gap-1.5">
                                      <input
                                        type="text"
                                        placeholder="Nova senha..."
                                        id={`pwd-${u.id}`}
                                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white w-28 focus:border-emerald-500 focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const el = document.getElementById(
                                            `pwd-${u.id}`
                                          ) as HTMLInputElement;
                                          if (!el?.value) return;
                                          handleResetUserPassword(u.id, {
                                            password: el.value,
                                          });
                                          el.value = "";
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                      >
                                        Salvar
                                      </button>
                                      <SysTooltip content="Entrar no sistema como este usuário">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleImpersonate(
                                              editingTenant,
                                              u.id
                                            )
                                          }
                                          className="bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1"
                                        >
                                          <LogIn size={12} /> Entrar
                                        </button>
                                      </SysTooltip>
                                      <SysTooltip
                                        content={
                                          u.active
                                            ? "Bloquear acesso do usuário"
                                            : "Reativar acesso do usuário"
                                        }
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleResetUserPassword(u.id, {
                                              active: !u.active,
                                            })
                                          }
                                          className="text-zinc-400 hover:text-white p-1.5 rounded-lg bg-zinc-900 border border-zinc-800"
                                        >
                                          {u.active ? (
                                            <Ban size={13} />
                                          ) : (
                                            <Check size={13} />
                                          )}
                                        </button>
                                      </SysTooltip>
                                      <SysTooltip content="Excluir usuário">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteUser(u.id, u.email)
                                          }
                                          className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </SysTooltip>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>

                  <form
                    onSubmit={handleCreateUser}
                    className="bg-zinc-950/50 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 space-y-4"
                  >
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
                      <Plus size={14} />
                      <span>Adicionar Novo Usuário a esta Empresa</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Nome completo"
                        value={newUserForm.name}
                        onChange={(e) =>
                          setNewUserForm({
                            ...newUserForm,
                            name: e.target.value,
                          })
                        }
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="email"
                        required
                        placeholder="E-mail de login"
                        value={newUserForm.email}
                        onChange={(e) =>
                          setNewUserForm({
                            ...newUserForm,
                            email: e.target.value,
                          })
                        }
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                      <SysPasswordInput
                        required
                        placeholder="Senha inicial"
                        value={newUserForm.password}
                        onChange={(e) =>
                          setNewUserForm({
                            ...newUserForm,
                            password: e.target.value,
                          })
                        }
                        iconSize={15}
                        inputClassName="bg-zinc-900 border border-zinc-800 rounded-xl pl-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <SysSelect
                        size="sm"
                        value={newUserForm.role}
                        onChange={(val) =>
                          setNewUserForm({
                            ...newUserForm,
                            role: val,
                          })
                        }
                        options={[
                          {
                            value: "ADMIN",
                            label: "Cargo: Administrador",
                            badge: "ADMIN",
                          },
                          {
                            value: "OPERATOR",
                            label: "Cargo: Operador",
                            badge: "OPERADOR",
                          },
                        ]}
                      />
                      <SysPasswordInput
                        placeholder="PIN Rápido (opcional)"
                        value={newUserForm.pin}
                        onChange={(e) =>
                          setNewUserForm({
                            ...newUserForm,
                            pin: e.target.value,
                          })
                        }
                        iconSize={15}
                        inputClassName="bg-zinc-900 border border-zinc-800 rounded-xl pl-3.5 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={creatingUser}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs py-2.5 transition flex items-center justify-center space-x-1.5"
                      >
                        {creatingUser ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>Criar Usuário</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ABA 5: RAIO-X DO BANCO (LIVE POSTGRES METRICS) */}
              {editTab === "xray" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Activity size={16} className="text-emerald-400" />
                        <span>
                          Diagnóstico em Tempo Real ({editingTenant.databaseName}
                          )
                        </span>
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Métricas extraídas diretamente da instância PostgreSQL
                        exclusiva deste cliente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchTenantStats(editingTenant.id)}
                      disabled={loadingStats}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition"
                    >
                      <RefreshCw
                        size={13}
                        className={loadingStats ? "animate-spin" : ""}
                      />
                      <span>Atualizar</span>
                    </button>
                  </div>

                  {loadingStats ? (
                    <div className="py-12 text-center text-zinc-500">
                      <Loader2
                        className="animate-spin mx-auto mb-2 text-emerald-500"
                        size={28}
                      />
                      <p className="text-xs">
                        Inspecionando tabelas do cliente no PostgreSQL...
                      </p>
                    </div>
                  ) : !tenantStats ? (
                    <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-6 text-center text-xs text-zinc-500">
                      Não foi possível carregar as estatísticas deste banco.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1 font-bold">
                            <Users size={12} className="text-emerald-400" />{" "}
                            Clientes
                          </span>
                          <span className="text-xl sm:text-2xl font-extrabold text-white mt-1 block">
                            {tenantStats.clientesCount}
                          </span>
                          <span className="text-[11px] text-rose-400">
                            {tenantStats.blacklistCount} na Blacklist
                          </span>
                        </div>

                        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1 font-bold">
                            <Wallet size={12} className="text-emerald-400" />{" "}
                            Empréstimos
                          </span>
                          <span className="text-xl sm:text-2xl font-extrabold text-emerald-400 mt-1 block">
                            {tenantStats.emprestimosAtivosCount} ativos
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {tenantStats.emprestimosQuitadosCount} quitados
                          </span>
                        </div>

                        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1 font-bold">
                            <Clock size={12} className="text-rose-400" />{" "}
                            Parcelas
                          </span>
                          <span className="text-xl sm:text-2xl font-extrabold text-rose-400 mt-1 block">
                            {tenantStats.parcelasAtrasadasCount} atrasadas
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {tenantStats.parcelasAbertasCount} em aberto
                          </span>
                        </div>

                        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1 font-bold">
                            <HardDrive size={12} className="text-teal-400" />{" "}
                            Tamanho DB
                          </span>
                          <span className="text-xl sm:text-2xl font-extrabold text-teal-300 mt-1 block font-mono">
                            {formatBytes(tenantStats.dbSizeBytes)}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {tenantStats.chequesCount} cheques ·{" "}
                            {tenantStats.parceirosCount} parceiros
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-emerald-950/20 border border-emerald-500/25 rounded-2xl p-4 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-zinc-400 block">
                              Volume Emprestado (Contratos Ativos)
                            </span>
                            <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
                              {Number(
                                tenantStats.volumeEmprestadoAtivo || 0
                              ).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          </div>
                          <TrendingUp className="text-emerald-400" size={26} />
                        </div>

                        <div className="bg-teal-950/20 border border-teal-500/25 rounded-2xl p-4 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-zinc-400 block">
                              Total Recebido em Parcelas Pagas
                            </span>
                            <span className="text-lg sm:text-xl font-black text-teal-300 font-mono">
                              {Number(
                                tenantStats.totalRecebidoParcelas || 0
                              ).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          </div>
                          <CreditCard className="text-teal-400" size={26} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSqlDb(editingTenant.databaseName);
                            setView("sql");
                            if (sqlUnlocked)
                              fetchSqlTables(editingTenant.databaseName);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Terminal size={14} /> Abrir este Banco no SQL Editor
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================
         * VIEW: BACKUPS & SNAPSHOTS
         * ================================================================== */}
        {view === "backups" && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-zinc-900/75 border border-emerald-500/20 rounded-3xl p-5 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Archive size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">
                      Central de Backups & Snapshots JSON
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Exporte instantaneamente dados completos do banco central
                      Heart ou de qualquer cliente Shark.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchBackups}
                  disabled={loadingBackups}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition"
                >
                  <RefreshCw
                    size={14}
                    className={loadingBackups ? "animate-spin" : ""}
                  />
                  <span>Atualizar Lista</span>
                </button>
              </div>

              {/* Gerador de Novo Backup */}
              <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
                    Escopo do Backup
                  </label>
                  <SysSelect
                    value={backupTarget}
                    onChange={setBackupTarget}
                    options={backupScopeOptions}
                    searchable
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    disabled={creatingBackup}
                    onClick={() => handleCreateBackup(false)}
                    className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {creatingBackup ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <HardDrive size={15} />
                    )}
                    <span>Salvar no Servidor</span>
                  </button>
                  <button
                    type="button"
                    disabled={creatingBackup}
                    onClick={() => handleCreateBackup(true)}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
                  >
                    {creatingBackup ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Download size={15} />
                    )}
                    <span>Gerar e Baixar (.JSON)</span>
                  </button>
                </div>
              </div>

              {/* Lista de Backups Salvos */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Snapshots Armazenados no Servidor ({backupsList.length})
                </h3>

                {loadingBackups ? (
                  <div className="py-10 text-center text-zinc-500">
                    <Loader2
                      className="animate-spin mx-auto mb-2 text-emerald-500"
                      size={24}
                    />
                    <span className="text-xs">Listando arquivos...</span>
                  </div>
                ) : backupsList.length === 0 ? (
                  <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-2xl p-8 text-center text-xs text-zinc-500">
                    Nenhum snapshot salvo ainda. Clique em &ldquo;Gerar e Baixar
                    (.JSON)&rdquo; acima para criar o primeiro backup.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {backupsList.map((b) => (
                      <div
                        key={b.filename}
                        className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 hover:border-emerald-500/30 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Archive
                            size={18}
                            className="text-emerald-400 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-mono font-bold text-zinc-100 truncate">
                              {b.filename}
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              {new Date(b.createdAt).toLocaleString("pt-BR")} ·{" "}
                              <strong className="text-emerald-300">
                                {formatBytes(b.sizeBytes)}
                              </strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            type="button"
                            onClick={() =>
                              handleDownloadSavedBackup(b.filename)
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition"
                          >
                            <Download size={13} /> Baixar
                          </button>
                          <SysTooltip content="Excluir backup do servidor">
                            <button
                              type="button"
                              onClick={() => handleDeleteBackup(b.filename)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </SysTooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
         * VIEW: SQL EDITOR (DBEAVER STYLE + MOBILE SWITCHER)
         * ================================================================== */}
        {view === "sql" && (
          <div className="max-w-7xl mx-auto">
            {!sqlUnlocked ? (
              <div className="max-w-md mx-auto bg-zinc-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-center">
                <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-emerald-400">
                  <Lock size={28} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  SQL Console Protegido
                </h2>
                <p className="text-zinc-400 text-xs mb-6">
                  Execução direta de queries PostgreSQL em qualquer banco do
                  ecossistema. Digite a senha exclusiva do SQL Editor (
                  <code className="text-emerald-400">SQL_PIN</code>).
                </p>
                <form onSubmit={handleUnlockSql} className="space-y-4">
                  <SysPasswordInput
                    value={sqlPin}
                    onChange={(e) => setSqlPin(e.target.value)}
                    placeholder="Senha do SQL Editor"
                    autoFocus
                    iconSize={18}
                    inputClassName={`bg-zinc-950 border ${
                      sqlPinError ? "border-rose-500" : "border-zinc-800"
                    } rounded-xl pl-4 py-3 text-center text-white tracking-widest focus:outline-none focus:border-emerald-500`}
                  />
                  {sqlPinError && (
                    <p className="text-rose-400 text-xs">
                      Senha SQL incorreta.
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!sqlPin || loadingTables}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                  >
                    {loadingTables ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Terminal size={16} />
                        <span>Desbloquear Console SQL</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Mobile Segmented Switcher for SQL Editor (< lg) */}
                <div className="lg:hidden grid grid-cols-2 gap-1.5 bg-zinc-900/90 p-1.5 rounded-2xl border border-emerald-500/20">
                  <button
                    type="button"
                    onClick={() => setSqlMobilePanel("editor")}
                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      sqlMobilePanel === "editor"
                        ? "bg-emerald-600 text-white"
                        : "text-zinc-400"
                    }`}
                  >
                    <Terminal size={14} />
                    <span>Editor & Resultados</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSqlMobilePanel("sidebar")}
                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      sqlMobilePanel === "sidebar"
                        ? "bg-emerald-600 text-white"
                        : "text-zinc-400"
                    }`}
                  >
                    <Table2 size={14} />
                    <span>Bancos & Tabelas ({sqlTables.length})</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Sidebar: Seleção de Banco + Tabelas + Atalhos */}
                  <div
                    className={`lg:col-span-3 bg-zinc-900/75 border border-emerald-500/20 rounded-2xl p-4 flex flex-col h-auto lg:h-[680px] ${
                      sqlMobilePanel === "sidebar"
                        ? "flex"
                        : "hidden lg:flex"
                    }`}
                  >
                    <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1.5">
                      Banco de Dados Alvo
                    </label>
                    <div className="mb-4">
                      <SysSelect
                        size="sm"
                        value={sqlDb}
                        onChange={(db) => {
                          setSqlDb(db);
                          setSqlResult(null);
                          fetchSqlTables(db);
                        }}
                        options={sqlDatabaseOptions}
                        searchable
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      <span>Tabelas ({sqlTables.length})</span>
                      <SysTooltip content="Atualizar lista de tabelas">
                        <button
                          type="button"
                          onClick={() => fetchSqlTables(sqlDb)}
                          className="text-zinc-400 hover:text-emerald-300"
                        >
                          <RefreshCw
                            size={12}
                            className={loadingTables ? "animate-spin" : ""}
                          />
                        </button>
                      </SysTooltip>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-60 lg:max-h-none sys-scrollbar">
                      {sqlTables.map((tb) => (
                        <div
                          key={tb}
                          className="group flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/25 transition"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const q = `SELECT * FROM "${tb}" LIMIT 100;`;
                              setSqlQuery(q);
                              setSqlMobilePanel("editor");
                              executeSql(q, sqlDb);
                            }}
                            className="flex items-center space-x-2 text-xs text-zinc-300 group-hover:text-emerald-300 truncate flex-1 text-left"
                          >
                            <Table2
                              size={13}
                              className="text-zinc-500 group-hover:text-emerald-400 shrink-0"
                            />
                            <span className="font-mono truncate">{tb}</span>
                          </button>
                          <SysTooltip content="Ver estrutura de colunas (DESCRIBE)">
                            <button
                              type="button"
                              onClick={() => {
                                const q = `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tb}' ORDER BY ordinal_position;`;
                                setSqlQuery(q);
                                setSqlMobilePanel("editor");
                                executeSql(q, sqlDb);
                              }}
                              className="text-[10px] text-zinc-500 hover:text-teal-300 px-1.5 py-0.5 rounded bg-zinc-950/60 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition font-mono"
                            >
                              cols
                            </button>
                          </SysTooltip>
                        </div>
                      ))}
                    </div>

                    {/* Atalhos Rápidos Contextuais */}
                    <div className="pt-3 mt-3 border-t border-zinc-800 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                        Atalhos Rápidos ({sqlDb === "heart" ? "Heart" : "Shark"}
                        )
                      </span>
                      {(sqlDb === "heart"
                        ? [
                            {
                              label: "Listar Tenants",
                              q: 'SELECT id, name, "nomeFantasia", "databaseName", status, "mensalidadeValor", "mensalidadeVencimento" FROM tenants ORDER BY "createdAt" DESC;',
                            },
                            {
                              label: "Listar Usuários Central",
                              q: 'SELECT id, name, email, role, pin, active, "tenantId" FROM users ORDER BY "createdAt" DESC;',
                            },
                            {
                              label: "Logs de Pagamentos",
                              q: 'SELECT * FROM payment_logs ORDER BY "dataPagamento" DESC LIMIT 100;',
                            },
                          ]
                        : [
                            {
                              label: "Parcelas Atrasadas",
                              q: 'SELECT id, "emprestimoId", "numeroParcela", "valorParcela", "dataVencimento", status FROM "Parcela" WHERE status = \'ATRASADO\' ORDER BY "dataVencimento" ASC LIMIT 100;',
                            },
                            {
                              label: "Resumo por Status",
                              q: 'SELECT status, COUNT(*) AS qtd, SUM("valorParcela") AS total FROM "Parcela" GROUP BY status;',
                            },
                            {
                              label: "Empréstimos Ativos",
                              q: 'SELECT id, "clienteId", "valorEmprestado", "taxaJuros", "valorTotal", status, "createdAt" FROM "Emprestimo" WHERE status = \'ATIVO\' ORDER BY "createdAt" DESC LIMIT 100;',
                            },
                            {
                              label: "Clientes Cadastrados",
                              q: 'SELECT id, nome, cpf, telefone, cidade, blacklist FROM "Cliente" ORDER BY "createdAt" DESC LIMIT 100;',
                            },
                          ]
                      ).map((sc) => (
                        <button
                          key={sc.label}
                          type="button"
                          onClick={() => {
                            setSqlQuery(sc.q);
                            setSqlMobilePanel("editor");
                            executeSql(sc.q, sqlDb);
                          }}
                          className="w-full text-left text-[11px] text-zinc-400 hover:text-emerald-300 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/10 truncate transition flex items-center gap-1.5"
                        >
                          <ArrowRight size={11} className="text-emerald-400" />
                          <span className="truncate">{sc.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Área Principal: Editor + Resultados */}
                  <div
                    className={`lg:col-span-9 flex flex-col space-y-4 ${
                      sqlMobilePanel === "editor"
                        ? "flex"
                        : "hidden lg:flex"
                    }`}
                  >
                    <div className="bg-zinc-900/75 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 text-xs text-zinc-400">
                          <Terminal size={15} className="text-emerald-400" />
                          <span>Query SQL em</span>
                          <span className="font-mono font-bold text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/25">
                            {sqlDb}
                          </span>
                          <span className="text-[10px] text-zinc-500 hidden sm:inline">
                            (Ctrl+Enter para executar)
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 ml-auto">
                          <SysTooltip content="Copiar query SQL atual">
                            <button
                              type="button"
                              onClick={() =>
                                copyValue("sql-query", sqlQuery, "Query SQL")
                              }
                              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                            >
                              {copiedKey === "sql-query" ? (
                                <Check
                                  size={14}
                                  className="text-emerald-400"
                                />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </SysTooltip>
                          <button
                            type="button"
                            onClick={() => executeSql()}
                            disabled={sqlRunning || !sqlQuery.trim()}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold px-4 sm:px-5 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95"
                          >
                            {sqlRunning ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Play size={14} />
                            )}
                            <span>Executar</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden focus-within:border-emerald-500/60 transition">
                        <div className="select-none bg-zinc-900/70 text-zinc-600 text-right font-mono text-xs py-3 px-2.5 border-r border-zinc-800/80 leading-[1.5rem]">
                          {sqlQuery.split("\n").map((_, idx) => (
                            <div key={idx}>{idx + 1}</div>
                          ))}
                        </div>
                        <textarea
                          rows={5}
                          value={sqlQuery}
                          onChange={(e) => setSqlQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                              e.preventDefault();
                              executeSql();
                            }
                            if (e.key === "Tab") {
                              e.preventDefault();
                              const start = e.currentTarget.selectionStart;
                              const end = e.currentTarget.selectionEnd;
                              const next =
                                sqlQuery.substring(0, start) +
                                "  " +
                                sqlQuery.substring(end);
                              setSqlQuery(next);
                            }
                          }}
                          spellCheck={false}
                          className="w-full bg-transparent px-3.5 py-3 font-mono text-xs sm:text-sm text-emerald-300 leading-[1.5rem] focus:outline-none resize-y sys-scrollbar"
                          placeholder="Digite seu comando SQL (SELECT, UPDATE, INSERT, ALTER TABLE...)"
                        />
                      </div>

                      {sqlHistory.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
                          <span className="text-[10px] font-bold uppercase text-zinc-500 shrink-0 mr-1">
                            Recentes:
                          </span>
                          {sqlHistory.slice(0, 6).map((h, i) => (
                            <SysTooltip key={i} content={`[${h.db}] ${h.sql}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSqlDb(h.db);
                                  setSqlQuery(h.sql);
                                }}
                                className="text-[10px] font-mono bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-lg truncate max-w-[200px] shrink-0 transition"
                              >
                                <span className="text-emerald-400 mr-1">
                                  {h.db}:
                                </span>
                                {h.sql}
                              </button>
                            </SysTooltip>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Resultados da Query */}
                    <div className="bg-zinc-900/75 border border-emerald-500/20 rounded-2xl p-4 flex-1 flex flex-col min-h-[380px] overflow-hidden">
                      {sqlError && (
                        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-400 text-xs font-mono whitespace-pre-wrap">
                          {sqlError}
                        </div>
                      )}

                      {!sqlError && !sqlResult && (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs py-12 text-center">
                          <Terminal
                            size={32}
                            className="mb-2 text-emerald-500/40"
                          />
                          <p>
                            Selecione uma tabela ou execute uma query para
                            inspecionar ou editar os dados ao vivo.
                          </p>
                        </div>
                      )}

                      {sqlResult && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-zinc-800 text-xs text-zinc-400">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              <span className="text-emerald-400 font-bold flex items-center space-x-1">
                                <CheckCircle2 size={14} />
                                <span>
                                  {sqlResult.type === "query"
                                    ? `${sqlResult.rowCount} registro(s)`
                                    : `${sqlResult.affectedRows} linha(s) afetada(s)`}
                                </span>
                              </span>
                              <span className="text-[11px] text-zinc-500 hidden md:inline">
                                Duplo clique (ou ícone de lápis) na célula para
                                editar direto no banco
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 ml-auto">
                              {sqlResult.type === "query" &&
                                sqlResult.rows?.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const objs = sqlResult.rows.map(
                                        (r: any[]) =>
                                          Object.fromEntries(
                                            sqlResult.columns.map(
                                              (c: string, idx: number) => [
                                                c,
                                                r[idx],
                                              ]
                                            )
                                          )
                                      );
                                      const blob = new Blob(
                                        [JSON.stringify(objs, null, 2)],
                                        { type: "application/json" }
                                      );
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `${sqlDb}_export_${Date.now()}.json`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    }}
                                    className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-lg flex items-center space-x-1 transition"
                                  >
                                    <Download size={12} />
                                    <span>JSON</span>
                                  </button>
                                )}
                              <span className="flex items-center space-x-1 text-zinc-500 font-mono">
                                <Clock size={12} />
                                <span>{sqlResult.durationMs} ms</span>
                              </span>
                            </div>
                          </div>

                          {sqlResult.type === "query" &&
                          sqlResult.columns?.length > 0 ? (
                            <div className="flex-1 overflow-auto border border-zinc-800/80 rounded-xl max-h-[420px] sys-scrollbar">
                              <table className="w-full text-left text-xs font-mono border-collapse">
                                <thead className="bg-zinc-950 sticky top-0 z-10 text-zinc-400 border-b border-zinc-800">
                                  <tr>
                                    {sqlResult.columns.map((col: string) => (
                                      <th
                                        key={col}
                                        className="py-2.5 px-3 whitespace-nowrap font-bold"
                                      >
                                        {col}
                                      </th>
                                    ))}
                                    <th className="py-2.5 px-3 text-right sticky right-0 bg-zinc-950">
                                      Ações
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/60">
                                  {sqlResult.rows.map(
                                    (row: any[], rIdx: number) => {
                                      const pkCol = sqlResult.columns[0];
                                      const pkVal = row[0];
                                      const statusColIdx =
                                        sqlResult.columns.findIndex(
                                          (c: string) =>
                                            c.toLowerCase() === "status"
                                        );
                                      const rowStatus =
                                        statusColIdx >= 0
                                          ? String(row[statusColIdx])
                                          : "";

                                      return (
                                        <tr
                                          key={rIdx}
                                          className="hover:bg-zinc-800/40 group"
                                        >
                                          {row.map((val: any, cIdx: number) => {
                                            const colName =
                                              sqlResult.columns[cIdx];
                                            const isEditing =
                                              editingCell?.rowIdx === rIdx &&
                                              editingCell?.colIdx === cIdx;

                                            const startCellEdit = () => {
                                              if (cIdx === 0) return;
                                              setEditingCell({
                                                rowIdx: rIdx,
                                                colIdx: cIdx,
                                                colName,
                                                value:
                                                  val === null
                                                    ? "NULL"
                                                    : typeof val === "object"
                                                    ? JSON.stringify(val)
                                                    : String(val),
                                                pkCol,
                                                pkVal,
                                              });
                                            };

                                            return (
                                              <td
                                                key={cIdx}
                                                onDoubleClick={startCellEdit}
                                                className="py-2 px-3 whitespace-nowrap max-w-[280px] truncate text-zinc-300 cursor-pointer hover:bg-emerald-500/10"
                                              >
                                                {isEditing ? (
                                                  <div className="flex items-center space-x-1">
                                                    <input
                                                      type="text"
                                                      autoFocus
                                                      value={editingCell.value}
                                                      onChange={(e) =>
                                                        setEditingCell({
                                                          ...editingCell,
                                                          value: e.target.value,
                                                        })
                                                      }
                                                      onKeyDown={(e) => {
                                                        if (e.key === "Enter")
                                                          handleSaveInlineCell();
                                                        if (e.key === "Escape")
                                                          setEditingCell(null);
                                                      }}
                                                      className="bg-zinc-950 border border-emerald-500 rounded px-2 py-0.5 text-xs text-white w-36 focus:outline-none"
                                                    />
                                                    <button
                                                      type="button"
                                                      disabled={savingCell}
                                                      onClick={
                                                        handleSaveInlineCell
                                                      }
                                                      className="text-emerald-400 hover:text-emerald-300 px-1"
                                                    >
                                                      <Check size={13} />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setEditingCell(null)
                                                      }
                                                      className="text-zinc-500 hover:text-zinc-300 px-1"
                                                    >
                                                      <X size={13} />
                                                    </button>
                                                  </div>
                                                ) : val === null ? (
                                                  <span className="text-zinc-600 italic">
                                                    NULL
                                                  </span>
                                                ) : typeof val === "object" ? (
                                                  JSON.stringify(val)
                                                ) : (
                                                  String(val)
                                                )}
                                              </td>
                                            );
                                          })}
                                          <td className="py-1.5 px-3 whitespace-nowrap text-right sticky right-0 bg-zinc-900/95">
                                            <div className="inline-flex items-center gap-1">
                                              {rowStatus === "ATRASADO" && (
                                                <SysTooltip content="Quitar esta parcela imediatamente">
                                                  <button
                                                    type="button"
                                                    onClick={async () => {
                                                      const tableName =
                                                        getActiveTableName(
                                                          sqlQuery
                                                        ) || "Parcela";
                                                      const q = `UPDATE "${tableName}" SET status = 'PAGO', "dataPagamento" = NOW() WHERE "${pkCol}" = '${pkVal}';`;
                                                      await executeSql(
                                                        q,
                                                        sqlDb
                                                      );
                                                      await executeSql(
                                                        sqlQuery,
                                                        sqlDb
                                                      );
                                                    }}
                                                    className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-sans font-bold"
                                                  >
                                                    Quitar
                                                  </button>
                                                </SysTooltip>
                                              )}
                                              <SysTooltip content="Gerar comando UPDATE no editor">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const tableName =
                                                      getActiveTableName(
                                                        sqlQuery
                                                      ) || "tabela";
                                                    const sets =
                                                      sqlResult.columns
                                                        .slice(1)
                                                        .map(
                                                          (
                                                            c: string,
                                                            idx: number
                                                          ) => {
                                                            const v =
                                                              row[idx + 1];
                                                            const formatted =
                                                              v === null
                                                                ? "NULL"
                                                                : `'${String(
                                                                    v
                                                                  ).replace(
                                                                    /'/g,
                                                                    "''"
                                                                  )}'`;
                                                            return `"${c}" = ${formatted}`;
                                                          }
                                                        )
                                                        .join(", ");
                                                    const pkFormatted =
                                                      typeof pkVal === "number"
                                                        ? pkVal
                                                        : `'${String(
                                                            pkVal
                                                          ).replace(
                                                            /'/g,
                                                            "''"
                                                          )}'`;
                                                    setSqlQuery(
                                                      `UPDATE "${tableName}" SET ${sets} WHERE "${pkCol}" = ${pkFormatted};`
                                                    );
                                                  }}
                                                  className="p-1 text-zinc-400 hover:text-emerald-300"
                                                >
                                                  <Edit size={12} />
                                                </button>
                                              </SysTooltip>
                                              <SysTooltip content="Excluir este registro do banco">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleDeleteRowFromTable(
                                                      pkCol,
                                                      pkVal
                                                    )
                                                  }
                                                  className="p-1 text-zinc-500 hover:text-rose-400"
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              </SysTooltip>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    }
                                  )}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="p-6 text-center text-zinc-400 text-xs font-mono">
                              Comando executado com sucesso. Nenhuma linha para
                              exibir.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====================================================================
       * MOBILE BOTTOM NAVIGATION BAR (NATIVE APP FEEL ON SMARTPHONES)
       * ==================================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#060d0b]/95 backdrop-blur-xl border-t border-emerald-500/20 flex justify-around items-center min-h-[4.25rem] px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.75)]">
        {[
          {
            id: "list",
            label: "Empresas",
            icon: Building2,
            badge: tenants.length || undefined,
          },
          {
            id: "calendar",
            label: "Calendário",
            icon: CalendarDays,
            badge: overdueTenantsCount || undefined,
            badgeRose: true,
          },
          {
            id: "new",
            label: "Nova",
            icon: Plus,
            highlight: true,
          },
          {
            id: "sql",
            label: "SQL",
            icon: Terminal,
          },
          {
            id: "backups",
            label: "Backups",
            icon: Archive,
          },
        ].map((item) => {
          const Icon = item.icon;
          const active =
            view === item.id || (view === "edit" && item.id === "list");

          if (item.highlight) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setView("new");
                  setSuccessData(null);
                  setErrorMsg("");
                }}
                className="flex flex-col items-center justify-center flex-1 -mt-4 active:scale-90 transition-transform"
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.45)] border ${
                    view === "new"
                      ? "bg-emerald-400 text-zinc-950 border-white"
                      : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-300/40"
                  }`}
                >
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold text-emerald-300 mt-1">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setView(item.id as any);
                if (item.id === "sql" && sqlUnlocked) fetchSqlTables(sqlDb);
                if (item.id === "backups") fetchBackups();
              }}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 space-y-0.5 transition-all active:scale-90 relative ${
                active
                  ? "text-emerald-400"
                  : "text-zinc-400 hover:text-emerald-300"
              }`}
            >
              {active && (
                <span className="absolute top-0 w-7 h-0.5 bg-emerald-400 rounded-full" />
              )}
              <div
                className={`relative p-1 rounded-xl transition-all ${
                  active ? "bg-emerald-500/15" : ""
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 2} />
                {item.badge !== undefined && (
                  <span
                    className={`absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] rounded-full text-[9px] font-black flex items-center justify-center ${
                      item.badgeRose
                        ? "bg-rose-500 text-white"
                        : "bg-emerald-500 text-zinc-950"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] truncate max-w-full px-0.5 ${
                  active ? "font-black" : "font-semibold"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ====================================================================
       * MODAL DE RESULTADOS DE MIGRAÇÃO (COM CONSOLE OUTPUT)
       * ==================================================================== */}
      {migrationResults && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                  <RefreshCw size={18} className="text-emerald-400" />
                  <span>Relatório de Atualização de Bancos</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Clique em qualquer banco para inspecionar o log de saída do{" "}
                  <code>prisma db push</code>.
                </p>
              </div>
              <button
                onClick={() => setMigrationResults(null)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-xl bg-zinc-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 sys-scrollbar">
              {migrationResults.map((r, i) => {
                const isExpanded = expandedLogDb === r.db;
                const hasOutput = Boolean(r.stdout || r.stderr || r.error);
                return (
                  <div
                    key={i}
                    className="rounded-xl bg-zinc-950 border border-zinc-800/80 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedLogDb(isExpanded ? null : r.db)
                      }
                      className="w-full p-3 flex items-center justify-between text-left hover:bg-zinc-900/50 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {hasOutput ? (
                          isExpanded ? (
                            <ChevronDown size={14} className="text-zinc-400" />
                          ) : (
                            <ChevronRight size={14} className="text-zinc-400" />
                          )
                        ) : null}
                        <span className="font-mono text-xs sm:text-sm text-zinc-200 font-bold truncate">
                          {r.db}
                        </span>
                        {r.name && (
                          <span className="text-xs text-zinc-500 truncate">
                            ({r.name})
                          </span>
                        )}
                      </div>
                      {r.status === "SUCCESS" ? (
                        <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center space-x-1 shrink-0">
                          <CheckCircle2 size={12} />
                          <span>Atualizado</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold shrink-0">
                          Erro
                        </span>
                      )}
                    </button>

                    {isExpanded && hasOutput && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-zinc-800/80 bg-black/50">
                        <pre className="text-[11px] font-mono text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto sys-scrollbar">
                          {[r.stdout, r.stderr, r.error]
                            .filter(Boolean)
                            .join("\n")}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setMigrationResults(null)}
              className="mt-5 w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl transition"
            >
              Fechar Relatório
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
