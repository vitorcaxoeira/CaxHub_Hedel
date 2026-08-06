import { KpiCard } from "../ui/KpiCard";
import { RankingBarra } from "../ui/RankingBarra";
import { Skeleton } from "../ui/Skeleton";

export interface NotasEntradaIndicadoresData {
  total: number;
  valorLiquidoTotal: number;
  ticketMedio: number;
  porSituacao: { sitnfc: string; label: string; tone: string; quantidade: number }[];
  topFornecedores: { codfor: number; nome: string; quantidade: number; valorLiquido: number }[];
}

interface NotasEntradaDashboardProps {
  dados: NotasEntradaIndicadoresData | null;
  loading: boolean;
}

const formatarContagem = (valor: number) => valor.toLocaleString("pt-BR");
const currencyFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (v: number) => `R$ ${currencyFormatter.format(v)}`;

// KPIs da aba "Dash" de Notas de Entrada — mesmo padrão visual do Dash de Pedidos
// (KpiCard + RankingBarra, sem lib de gráfico). Vlrliq é o único campo monetário do
// recorte trazido de E440NFC.
export function NotasEntradaDashboard({ dados, loading }: NotasEntradaDashboardProps) {
  if (loading || !dados) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
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
    chave: s.sitnfc,
    nome: s.label,
    quantidade: s.quantidade,
    valor: s.quantidade,
  }));
  const fornecedorItens = dados.topFornecedores.map((f) => ({
    chave: f.codfor,
    nome: f.nome,
    quantidade: f.quantidade,
    valor: f.valorLiquido,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total de Notas" tone="primary" quantidade={dados.total} total={dados.total} rodape="Base completa, sem filtro" />
        <KpiCard
          label="Valor Líquido Total"
          tone="primary"
          quantidade={dados.total}
          total={dados.total}
          valor={formatMoney(dados.valorLiquidoTotal)}
          rodape="Soma de todas as notas"
        />
        <KpiCard
          label="Ticket Médio"
          tone="neutral"
          quantidade={dados.total}
          total={dados.total}
          valor={formatMoney(dados.ticketMedio)}
          rodape="Valor líquido ÷ nº de notas"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankingBarra titulo="Notas por Situação" itens={situacaoItens} formatarValor={formatarContagem} unidade="notas" />
        <RankingBarra titulo="Top Fornecedores" itens={fornecedorItens} unidade="notas" descricao="Por valor líquido somado" />
      </div>
    </div>
  );
}
