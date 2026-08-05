import { KpiCard } from "../ui/KpiCard";
import { RankingBarra } from "../ui/RankingBarra";
import { Skeleton } from "../ui/Skeleton";

export interface PedidosIndicadoresData {
  total: number;
  naoFechados: number;
  abertos: number;
  valorLiquidoTotal: number;
  ticketMedio: number;
  porSituacao: { sitped: number; label: string; tone: string; quantidade: number }[];
  porEmpresa: { codemp: number; nome: string; quantidade: number; valorLiquido: number }[];
  topClientes: { codcli: number; nome: string; quantidade: number; valorLiquido: number }[];
}

interface PedidosDashboardProps {
  dados: PedidosIndicadoresData | null;
  loading: boolean;
}

const formatarContagem = (valor: number) => valor.toLocaleString("pt-BR");
const currencyFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (v: number) => `R$ ${currencyFormatter.format(v)}`;

// KPIs da aba "Dash". Mesmo padrão visual do CaxHub (KpiCard + RankingBarra, sem lib de
// gráfico), mas com dois recortes diferentes:
//
//   - saem "Com RAT vinculada" e "RAT não sincronizada", além das duas distribuições por
//     forma de faturamento — todos dependem de Proposta/RAT, que não existem neste
//     espelho (ver backend/src/routes/pedidos.ts);
//   - entram ticket médio e a distribuição por empresa do grupo. No CaxHub existe uma
//     empresa só e o segundo seria uma barra sozinha; aqui são 7, e de qual empresa vem o
//     pedido é pergunta de verdade.
//
// `vlrliq` é o único campo monetário do Pedido — usado no valor total, no ticket médio e
// nos dois rankings por valor; o resto continua em contagem.
export function PedidosDashboard({ dados, loading }: PedidosDashboardProps) {
  if (loading || !dados) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-5">
            <Skeleton className="mb-2 h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="mt-2 h-1 w-full" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  const situacaoItens = dados.porSituacao.map((s) => ({
    chave: s.sitped,
    nome: s.label,
    quantidade: s.quantidade,
    valor: s.quantidade,
  }));
  const clientesItens = dados.topClientes.map((c) => ({
    chave: c.codcli,
    nome: c.nome,
    quantidade: c.quantidade,
    valor: c.valorLiquido,
  }));
  const empresaItens = dados.porEmpresa.map((e) => ({
    chave: e.codemp,
    nome: e.nome,
    quantidade: e.quantidade,
    valor: e.valorLiquido,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total de Pedidos" tone="primary" quantidade={dados.total} total={dados.total} rodape="Base completa, sem filtro" />
        <KpiCard
          label="Valor Líquido Total"
          tone="primary"
          quantidade={dados.total}
          total={dados.total}
          valor={formatMoney(dados.valorLiquidoTotal)}
          rodape="Soma de todos os pedidos"
        />
        <KpiCard
          label="Ticket Médio"
          tone="neutral"
          quantidade={dados.total}
          total={dados.total}
          valor={formatMoney(dados.ticketMedio)}
          rodape="Valor líquido ÷ nº de pedidos"
        />
        <KpiCard label="Não Fechados" tone="warning" quantidade={dados.naoFechados} total={dados.total} rodape="Situação 9" />
        <KpiCard label="Abertos" tone="warning" quantidade={dados.abertos} total={dados.total} rodape="Situações 1 e 2" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankingBarra titulo="Pedidos por Situação" itens={situacaoItens} formatarValor={formatarContagem} unidade="pedidos" />
        <RankingBarra titulo="Top Clientes" itens={clientesItens} unidade="pedidos" descricao="Por valor líquido somado" />
      </div>

      <RankingBarra
        titulo="Pedidos por Empresa do Grupo"
        itens={empresaItens}
        unidade="pedidos"
        descricao="Por valor líquido somado"
      />
    </div>
  );
}
