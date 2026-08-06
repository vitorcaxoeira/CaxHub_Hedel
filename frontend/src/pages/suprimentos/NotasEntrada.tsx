import axios from "axios";
import { useEffect, useState } from "react";
import { EmpresaFilialFilter, EmpresaOption, FilialOption } from "../../components/financeiro/EmpresaFilialFilter";
import { MultiSelectDropdown, MultiSelectOption } from "../../components/ui/MultiSelectDropdown";
import { Pagination } from "../../components/ui/Pagination";
import { Skeleton } from "../../components/ui/Skeleton";
import { toneBadge, type Tone } from "../../components/ui/badges";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { NotasEntradaDashboard, NotasEntradaIndicadoresData } from "../../components/suprimentos/NotasEntradaDashboard";

// Tela "Suprimentos > Notas de Entrada" — espelho de E440NFC
// (ver backend/src/routes/notasFiscaisEntrada.ts).
//
// Só Lista + Dash, sem visão "Por Fornecedor" agrupada (o que Mercado > Listar Pedidos
// tem para clientes): não foi pedido, e a tabela já nasce em volume bem maior — o filtro
// e a paginação aqui rodam no banco, não em memória como em Pedido.

type Visao = "lista" | "dash";

interface OpcoesFiltro {
  empresas: EmpresaOption[];
  filiais: FilialOption[];
}

interface NotaRow {
  codemp: number;
  codfil: number;
  codfor: number;
  numnfc: number;
  codsnf: string;
  fornecedor: string;
  tipnfeLabel: string;
  datemi: string;
  datent: string | null;
  vlrliq: number | null;
  sitnfc: string;
  sitnfcLabel: string;
  sitnfcTone: Tone;
  condicaoPagamentoLabel: string | null;
}

const SITNFC_OPCOES: MultiSelectOption<string>[] = [
  { value: "1", label: "Digitada" },
  { value: "2", label: "Fechada" },
  { value: "3", label: "Cancelada" },
  { value: "4", label: "Documento Fiscal Emitido (saída)" },
  { value: "5", label: "Aguardando Fechamento (pós-saída)" },
  { value: "6", label: "Aguardando Integração WMS" },
  { value: "7", label: "Digitada Integração" },
  { value: "8", label: "Agrupada" },
];

const PAGE_SIZE = 30;

const currencyFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMoney = (v: number | null) => (v == null ? "—" : `R$ ${currencyFormatter.format(v)}`);
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const fmtData = (v: string | null) => (v ? dateFormatter.format(new Date(v)) : "—");

const TH_CLASS = "bg-surface-2 px-[7px] py-[8px] text-left font-mono text-[10px] font-medium uppercase tracking-wider text-muted";
const TH_CLASS_RIGHT = "bg-surface-2 px-[7px] py-[8px] text-right font-mono text-[10px] font-medium uppercase tracking-wider text-muted";
const TD_CLASS = "whitespace-nowrap px-[7px] py-[10px]";

const inputClass =
  "rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function LinhaNota({ nota }: { nota: NotaRow }) {
  return (
    <tr className="border-t border-border/60 transition hover:bg-surface-2">
      <td className="px-[7px] py-[10px] text-sm text-foreground">{nota.fornecedor}</td>
      <td className={`${TD_CLASS} font-mono text-sm text-muted`}>
        {nota.numnfc}/{nota.codsnf}
      </td>
      <td className={`${TD_CLASS} font-mono text-sm text-muted`}>{fmtData(nota.datemi)}</td>
      <td className={`${TD_CLASS} font-mono text-sm text-muted`}>{fmtData(nota.datent)}</td>
      <td className={`${TD_CLASS} text-sm text-muted`}>{nota.condicaoPagamentoLabel ?? "—"}</td>
      <td className={`${TD_CLASS} text-right font-mono text-sm font-semibold tabular-nums text-foreground`}>
        {fmtMoney(nota.vlrliq)}
      </td>
      <td className={`${TD_CLASS} text-right`}>
        <span className={`inline-block whitespace-nowrap rounded px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-wide ${toneBadge[nota.sitnfcTone]}`}>
          {nota.sitnfcLabel}
        </span>
      </td>
    </tr>
  );
}

export function NotasEntrada() {
  const [visao, setVisao] = useState<Visao>("lista");
  const [indicadores, setIndicadores] = useState<NotasEntradaIndicadoresData | null>(null);
  const [loadingIndicadores, setLoadingIndicadores] = useState(true);

  const [opcoes, setOpcoes] = useState<OpcoesFiltro | null>(null);
  // Empresa/filial é filtro de ESCOPO — mesmo papel que tem em Financeiro · Contas a
  // Receber: afeta a lista E o Dash. Fornecedor/situação/emissão só refinam a Lista.
  const [empresasFiliais, setEmpresasFiliais] = useState<string[]>([]);
  const [fornecedorInput, setFornecedorInput] = useState("");
  const fornecedorDebounced = useDebouncedValue(fornecedorInput, 350);
  const [situacaoFiltro, setSituacaoFiltro] = useState<string[]>([]);
  const [datemiDe, setDatemiDe] = useState("");
  const [datemiAte, setDatemiAte] = useState("");

  const empFilIds = empresasFiliais.join(",") || undefined;

  const [page, setPage] = useState(1);
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get("/api/notas-fiscais-entrada/opcoes-filtro")
      .then(({ data }) => setOpcoes(data))
      .catch((err) => setErro(err.response?.data?.error ?? "Falha ao carregar as opções de filtro"));
  }, []);

  function carregar() {
    setLoading(true);
    axios
      .get("/api/notas-fiscais-entrada", {
        params: {
          empFil: empFilIds,
          fornecedor: fornecedorDebounced || undefined,
          situacao: situacaoFiltro.length > 0 ? situacaoFiltro.join(",") : undefined,
          datemiDe: datemiDe || undefined,
          datemiAte: datemiAte || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
      })
      .then(({ data }) => {
        setNotas(data.notas);
        setTotal(data.total);
        setErro(null);
      })
      .catch((err) => setErro(err.response?.data?.error ?? "Falha ao carregar notas de entrada"))
      .finally(() => setLoading(false));
  }

  function carregarIndicadores() {
    setLoadingIndicadores(true);
    axios
      .get("/api/notas-fiscais-entrada/indicadores", { params: { empFil: empFilIds } })
      .then(({ data }) => setIndicadores(data))
      .catch((err) => setErro(err.response?.data?.error ?? "Falha ao carregar indicadores"))
      .finally(() => setLoadingIndicadores(false));
  }

  // Indicadores do "Dash" respeitam empresa/filial, mas não os outros filtros da aba
  // Lista (fornecedor/situação/emissão) — mesma divisão de Contas a Receber.
  useEffect(() => {
    carregarIndicadores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empFilIds]);

  useEffect(() => {
    if (visao === "lista") carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao, empFilIds, fornecedorDebounced, situacaoFiltro, datemiDe, datemiAte, page]);

  useEffect(() => {
    setPage(1);
  }, [empFilIds, fornecedorDebounced, situacaoFiltro, datemiDe, datemiAte]);

  const tabClass = (ativa: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      ativa ? "bg-primary text-primary-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <div>
      <p className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-muted">Suprimentos · Notas de Entrada</p>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Notas de Entrada</h1>
          <p className="mt-1 text-sm text-muted">Notas fiscais de compra importadas do Senior (E440NFC).</p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-md border border-border p-1">
          <button onClick={() => setVisao("lista")} className={tabClass(visao === "lista")}>
            Lista
          </button>
          <button onClick={() => setVisao("dash")} className={tabClass(visao === "dash")}>
            Dash
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <EmpresaFilialFilter
          empresas={opcoes?.empresas ?? []}
          filiais={opcoes?.filiais ?? []}
          selecionados={empresasFiliais}
          onChange={setEmpresasFiliais}
        />
        {visao === "lista" && (
          <>
            <input
              value={fornecedorInput}
              onChange={(e) => setFornecedorInput(e.target.value)}
              placeholder="Fornecedor (código ou nome)"
              className={`${inputClass} w-64`}
            />
            <MultiSelectDropdown<string>
              opcoes={SITNFC_OPCOES}
              selecionados={situacaoFiltro}
              onChange={setSituacaoFiltro}
              labelTodos="Todas as situações"
              labelSufixo="situação(ões)"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Emissão:</span>
              <input type="date" value={datemiDe} onChange={(e) => setDatemiDe(e.target.value)} className={inputClass} />
              <span className="text-sm text-muted">até</span>
              <input type="date" value={datemiAte} onChange={(e) => setDatemiAte(e.target.value)} className={inputClass} />
            </div>
          </>
        )}
      </div>

      {erro && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{erro}</p>
      )}

      {visao === "dash" && <NotasEntradaDashboard dados={indicadores} loading={loadingIndicadores} />}

      {visao === "lista" && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH_CLASS}>Fornecedor</th>
                  <th className={TH_CLASS}>NF / Série</th>
                  <th className={TH_CLASS}>Emissão</th>
                  <th className={TH_CLASS}>Entrada</th>
                  <th className={TH_CLASS}>Cond. Pagamento</th>
                  <th className={TH_CLASS_RIGHT}>Valor Líquido</th>
                  <th className={TH_CLASS_RIGHT}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t border-border/60">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-[7px] py-[10px]">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!loading && notas.map((n) => <LinhaNota key={`${n.codemp}-${n.codfil}-${n.codfor}-${n.numnfc}-${n.codsnf}`} nota={n} />)}
                {!loading && notas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted">
                      Nenhuma nota de entrada encontrada com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} loading={loading} onPageChange={setPage} label="notas" />
        </div>
      )}
    </div>
  );
}
