import { prisma } from "@/lib/db";
import { hojeEmBrasilia } from "@/lib/dateUtils";
import { obterConfiguracoesSistema } from "@/app/configuracoes/actions";
import DashboardClientView from "@/components/DashboardClientView";

export const revalidate = 0;

export default async function DashboardPage() {
  const [hojeUTC, configSistema] = [hojeEmBrasilia(), await obterConfiguracoesSistema()];
  const modoCarencia = configSistema.regra_carencia_30_dias;
  const limiteCarenciaUTC = new Date(hojeUTC);
  limiteCarenciaUTC.setUTCDate(hojeUTC.getUTCDate() - 30);

  const ontemUTC = new Date(hojeUTC);
  ontemUTC.setUTCDate(hojeUTC.getUTCDate() - 1);

  const anoAtualInicio = new Date(Date.UTC(hojeUTC.getUTCFullYear(), 0, 1));
  const mesAtualInicio = new Date(Date.UTC(hojeUTC.getUTCFullYear(), hojeUTC.getUTCMonth(), 1));

  const limiteSemana = new Date(hojeUTC);
  limiteSemana.setUTCDate(hojeUTC.getUTCDate() + 7);
  const limiteMes = new Date(hojeUTC);
  limiteMes.setUTCDate(hojeUTC.getUTCDate() + 30);
  const limiteAno = new Date(hojeUTC);
  limiteAno.setUTCDate(hojeUTC.getUTCDate() + 365);

  // Buscar empréstimos ATIVOS e QUITADOS simultaneamente para maior velocidade (Promise.all)
  const [emprestimosAtivos, emprestimosQuitados] = await Promise.all([
    prisma.emprestimo.findMany({
      where: { status: "ativo" },
      include: { cliente: true, parcelas: true, parceiro: true },
      orderBy: { data_vencimento: "asc" },
    }),
    prisma.emprestimo.findMany({
      where: { status: "quitado" },
      include: { parcelas: true, parceiro: true },
    }),
  ]);

  // ────────────────────────────────────────────────────────
  // MÉTRICAS DE CARTEIRA ATIVA
  // ────────────────────────────────────────────────────────
  let totalEmprestado = 0;
  let totalAReceber = 0;
  let totalAtrasadosCount = 0;
  let atrasadosOntemCount = 0;
  let atrasadosAnterioresCount = 0;
  let vencendoHojeCount = 0;
  let ativosEmDiaCount = 0;
  let receberHoje = 0;
  let receberSemana = 0;
  let receberMes = 0;
  let receberAno = 0;
  let receberParceiros = 0;
  let receberProprio = 0;
  const parceirosMap: Record<string, { nome: string; total: number; count: number }> = {};

  const mesesProjecao = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hojeUTC);
    d.setUTCMonth(hojeUTC.getUTCMonth() + i);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      label: d.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", ""),
      valor: 0,
    };
  });

  emprestimosAtivos.forEach((emp) => {
    const principal = Number(emp.valor_emprestado);
    const juros = Number(emp.taxa_juros);
    const totalDevido = principal * (1 + juros / 100);

    totalEmprestado += principal;
    totalAReceber += totalDevido;

    const vencObj = new Date(emp.data_vencimento);
    const vencimentoUTC = new Date(
      Date.UTC(vencObj.getUTCFullYear(), vencObj.getUTCMonth(), vencObj.getUTCDate())
    );

    let estaAtrasado = false;
    let atrasouOntem = false;
    let venceHoje = false;

    if (emp.parcelas && emp.parcelas.length > 0) {
      const temParcelasAbertas = emp.parcelas.some((p) => p.status === "aberto");
      if (temParcelasAbertas) {
        estaAtrasado = emp.parcelas.some((p) => {
          if (p.status !== "aberto") return false;
          const pvObj = new Date(p.data_vencimento);
          const pvUTC = new Date(
            Date.UTC(pvObj.getUTCFullYear(), pvObj.getUTCMonth(), pvObj.getUTCDate())
          );
          return modoCarencia ? pvUTC < limiteCarenciaUTC : pvUTC < hojeUTC;
        });

        atrasouOntem = emp.parcelas.some((p) => {
          if (p.status !== "aberto") return false;
          const pvObj = new Date(p.data_vencimento);
          const pvUTC = new Date(
            Date.UTC(pvObj.getUTCFullYear(), pvObj.getUTCMonth(), pvObj.getUTCDate())
          );
          return pvUTC.getTime() === ontemUTC.getTime();
        });

        venceHoje = emp.parcelas.some((p) => {
          if (p.status !== "aberto") return false;
          const pvObj = new Date(p.data_vencimento);
          const pvUTC = new Date(
            Date.UTC(pvObj.getUTCFullYear(), pvObj.getUTCMonth(), pvObj.getUTCDate())
          );
          return pvUTC.getTime() === hojeUTC.getTime();
        });
      }
    } else {
      const limiteAtraso = modoCarencia ? limiteCarenciaUTC : hojeUTC;
      if (vencimentoUTC < limiteAtraso) {
        estaAtrasado = true;
        if (vencimentoUTC.getTime() === ontemUTC.getTime()) {
          atrasouOntem = true;
        }
      } else if (vencimentoUTC.getTime() === hojeUTC.getTime()) {
        venceHoje = true;
      }
    }

    if (estaAtrasado) {
      totalAtrasadosCount++;
      if (atrasouOntem) atrasadosOntemCount++;
      else atrasadosAnterioresCount++;
    } else {
      ativosEmDiaCount++;
    }

    if (venceHoje) vencendoHojeCount++;

    const isParceiro = emp.parceiro_id !== null;
    const parceiroNome = emp.parceiro?.nome || "Próprio";

    if (emp.parcelas && emp.parcelas.length > 0) {
      emp.parcelas.forEach((p) => {
        if (p.status === "aberto") {
          const pvObj = new Date(p.data_vencimento);
          const pvUTC = new Date(
            Date.UTC(pvObj.getUTCFullYear(), pvObj.getUTCMonth(), pvObj.getUTCDate())
          );
          const valor = Number(p.valor);

          if (isParceiro) {
            receberParceiros += valor;
            if (!parceirosMap[emp.parceiro_id!]) {
              parceirosMap[emp.parceiro_id!] = { nome: parceiroNome, total: 0, count: 0 };
            }
            parceirosMap[emp.parceiro_id!].total += valor;
            parceirosMap[emp.parceiro_id!].count++;
          } else {
            receberProprio += valor;
          }

          if (pvUTC.getTime() === hojeUTC.getTime()) receberHoje += valor;
          if (pvUTC >= hojeUTC && pvUTC <= limiteSemana) receberSemana += valor;
          if (pvUTC >= hojeUTC && pvUTC <= limiteMes) receberMes += valor;
          if (pvUTC >= hojeUTC && pvUTC <= limiteAno) receberAno += valor;

          mesesProjecao.forEach((m) => {
            if (pvUTC.getUTCFullYear() === m.year && pvUTC.getUTCMonth() === m.month) {
              m.valor += valor;
            }
          });
        }
      });
    } else {
      const valor = totalDevido;
      if (isParceiro) {
        receberParceiros += valor;
        if (!parceirosMap[emp.parceiro_id!]) {
          parceirosMap[emp.parceiro_id!] = { nome: parceiroNome, total: 0, count: 0 };
        }
        parceirosMap[emp.parceiro_id!].total += valor;
        parceirosMap[emp.parceiro_id!].count++;
      } else {
        receberProprio += valor;
      }
      if (vencimentoUTC.getTime() === hojeUTC.getTime()) receberHoje += valor;
      if (vencimentoUTC >= hojeUTC && vencimentoUTC <= limiteSemana) receberSemana += valor;
      if (vencimentoUTC >= hojeUTC && vencimentoUTC <= limiteMes) receberMes += valor;
      if (vencimentoUTC >= hojeUTC && vencimentoUTC <= limiteAno) receberAno += valor;
      mesesProjecao.forEach((m) => {
        if (vencimentoUTC.getUTCFullYear() === m.year && vencimentoUTC.getUTCMonth() === m.month) {
          m.valor += valor;
        }
      });
    }
  });

  // ────────────────────────────────────────────────────────
  // MÉTRICAS DE GANHOS REAIS (QUITADOS)
  // ────────────────────────────────────────────────────────
  let ganhoTotal = 0; // Juros recebidos de TODOS os quitados
  let ganhoMesAtual = 0; // Juros recebidos este mês (pagamentos feitos em parcelas)
  let ganhoAnoAtual = 0; // Juros recebidos este ano
  let faturadoTotal = 0; // Total bruto recebido (principal + juros)
  const emprestimosQuitadosCount = emprestimosQuitados.length;
  let ticketMedioQuitado = 0;

  emprestimosQuitados.forEach((emp) => {
    const principal = Number(emp.valor_emprestado);
    const juros = Number(emp.taxa_juros);

    if (emp.parcelas && emp.parcelas.length > 0) {
      // Calcular com base nas parcelas pagas
      emp.parcelas.forEach((p) => {
        if (p.status.startsWith("pago") && p.valor_pago) {
          const valorPago = Number(p.valor_pago);
          faturadoTotal += valorPago;

          const pvObj = new Date(p.data_vencimento);
          const pvUTC = new Date(
            Date.UTC(pvObj.getUTCFullYear(), pvObj.getUTCMonth(), pvObj.getUTCDate())
          );

          if (pvUTC >= mesAtualInicio && pvUTC <= hojeUTC) {
            ganhoMesAtual += valorPago;
          }
          if (pvUTC >= anoAtualInicio && pvUTC <= hojeUTC) {
            ganhoAnoAtual += valorPago;
          }
        }
      });
      // Ganho de juros = faturado - principal
      const totalPagoEmp = emp.parcelas
        .filter((p) => p.status.startsWith("pago") && p.valor_pago)
        .reduce((acc, p) => acc + Number(p.valor_pago), 0);
      ganhoTotal += Math.max(0, totalPagoEmp - principal);
    } else {
      // Fallback sem parcelas
      const totalDevido = principal * (1 + juros / 100);
      faturadoTotal += totalDevido;
      ganhoTotal += totalDevido - principal;
    }
  });

  if (emprestimosQuitadosCount > 0) {
    ticketMedioQuitado = faturadoTotal / emprestimosQuitadosCount;
  }

  const lucroEstimado = totalAReceber - totalEmprestado;
  const parceirosList = Object.values(parceirosMap).sort((a, b) => b.total - a.total);

  const totalRecebiveisCalculados = receberProprio + receberParceiros;
  const pctProprio =
    totalRecebiveisCalculados > 0 ? (receberProprio / totalRecebiveisCalculados) * 100 : 0;
  const pctParceiros =
    totalRecebiveisCalculados > 0 ? (receberParceiros / totalRecebiveisCalculados) * 100 : 0;

  // Taxa de sucesso (quitados / (quitados + ativos))
  const totalEmprestimosGeral = emprestimosAtivos.length + emprestimosQuitadosCount;
  const taxaSucesso =
    totalEmprestimosGeral > 0 ? (emprestimosQuitadosCount / totalEmprestimosGeral) * 100 : 0;

  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  return (
    <DashboardClientView
      dataFormatada={dataFormatada}
      anoAtual={hojeUTC.getUTCFullYear()}
      totalEmprestado={totalEmprestado}
      totalAReceber={totalAReceber}
      lucroEstimado={lucroEstimado}
      emprestimosAtivosCount={emprestimosAtivos.length}
      ativosEmDiaCount={ativosEmDiaCount}
      totalAtrasadosCount={totalAtrasadosCount}
      atrasadosOntemCount={atrasadosOntemCount}
      atrasadosAnterioresCount={atrasadosAnterioresCount}
      vencendoHojeCount={vencendoHojeCount}
      receberHoje={receberHoje}
      receberSemana={receberSemana}
      receberMes={receberMes}
      receberAno={receberAno}
      receberProprio={receberProprio}
      receberParceiros={receberParceiros}
      totalRecebiveisCalculados={totalRecebiveisCalculados}
      pctProprio={pctProprio}
      pctParceiros={pctParceiros}
      mesesProjecao={mesesProjecao}
      ganhoTotal={ganhoTotal}
      ganhoMesAtual={ganhoMesAtual}
      ganhoAnoAtual={ganhoAnoAtual}
      faturadoTotal={faturadoTotal}
      emprestimosQuitadosCount={emprestimosQuitadosCount}
      totalEmprestimosGeral={totalEmprestimosGeral}
      taxaSucesso={taxaSucesso}
      ticketMedioQuitado={ticketMedioQuitado}
      parceirosList={parceirosList}
    />
  );
}
