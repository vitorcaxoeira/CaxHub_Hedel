import axios from "axios";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MultiSelectDropdown, MultiSelectOption } from "../../components/ui/MultiSelectDropdown";
import { Pagination } from "../../components/ui/Pagination";
import { Skeleton } from "../../components/ui/Skeleton";
import { toneBadge, type Tone } from "../../components/ui/badges";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useToast } from "../../components/ui/Toast";
import { PedidosDashboard, PedidosIndicadoresData } from "../../components/mercado/PedidosDashboard";

// Tela "Mercado > Listar Pedidos".
//
// Portada do CaxHub e reescrita para o recorte deste projeto. Lá a tela é organizada em
// torno do vínculo Pedido -> RAT -> Proposta: das seis colunas filtráveis (RAT,
// Consultor, Proposta, Modalidade, Situação, Faturamento), cinco vêm dessa indireção. Aqui
// nenhuma delas existe — o model Pedido nasceu sem `usu_numrat` e as tabelas USU_ estão
// fora do espelho —, então a estrutura de filtro por coluna perdia o sentido e a tela foi
// remontada em cima do que o pedido tem de fato.
//
// O que se manteve fiel: as três visões, os filtros da barra, o índice enxuto da aba Por
// Cliente, a sincronização sob demanda (por cliente e por filtro, esta com polling) e o
// tratamento de pedido removido no Senior.

type Visao = "lista" | "cliente" | "dash";

interface PedidoRow {
  codemp: number;
  codfil: number;
  numped: number;
  cliente: string;
  datemi: string;
  datprv: string | null;
  obsped: string | null;
  obsmot: string | null;
  vlrliq: number | null;
  pedcli: string | null;
  sitped: number;
  sitpedLabel: string;
  sitpedTone: Tone;
  formaPagamentoLabel: string | null;
  condicaoPagamentoLabel: string | null;
}

interface ClienteGrupo {
  codcli: number;
  nome: string;
  quantidade: number;
  valorLiquido: number;
}

interface PedidoIndice {
  chave: string;
  codcli: number;
  vlrliq: number | null;
  sitped: number;
  sitpedLabel: string;
}

const SITPED_OPCOES: MultiSelectOption<number>[] = [
  { value: 1, label: "Aberto Total" },
  { value: 2, label: "Aberto Parcial" },
  { value: 3, label: "Suspenso" },
  { value: 4, label: "Liquidado" },
  { value: 5, label: "Cancelado" },
  { value: 6, label: "Aguardando Integração WMS" },
  { value: 7, label: "Em Transmissão" },
  { value: 8, label: "Preparação Análise ou NF" },
  { value: 9, label: "Não Fechado" },
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

function LinhaPedido({ pedido, onAbrir }: { pedido: PedidoRow; onAbrir: () => void }) {
  return (
    <tr className="cursor-pointer border-t border-border/60 transition hover:bg-surface-2" onClick={onAbrir}>
      <td className={`${TD_CLASS} font-mono text-sm text-muted`}>
        {pedido.codemp}/{pedido.codfil}
      </td>
      <td className={`${TD_CLASS} font-mono text-sm font-semibold text-foreground`}>{pedido.numped}</td>
      <td className="px-[7px] py-[10px] text-sm text-foreground">{pedido.cliente}</td>
      <td className={`${TD_CLASS} font-mono text-sm text-muted`}>{fmtData(pedido.datemi)}</td>
      <td className={`${TD_CLASS} font-mono text-sm text-muted`}>{fmtData(pedido.datprv)}</td>
      <td className={`${TD_CLASS} text-sm text-muted`}>{pedido.pedcli ?? "—"}</td>
      <td className={`${TD_CLASS} text-sm text-muted`}>{pedido.condicaoPagamentoLabel ?? "—"}</td>
      <td className={`${TD_CLASS} text-right font-mono text-sm font-semibold tabular-nums text-foreground`}>
        {fmtMoney(pedido.vlrliq)}
      </td>
      <td className={`${TD_CLASS} text-right`}>
        <span className={`inline-block whitespace-nowrap rounded px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-wide ${toneBadge[pedido.sitpedTone]}`}>
          {pedido.sitpedLabel}
        </span>
      </td>
    </tr>
  );
}

export function ListarPedidos() {
  const toast = useToast();
  const navigate = useNavigate();
  const [visao, setVisao] = useState<Visao>("lista");
  const [indicadores, setIndicadores] = useState<PedidosIndicadoresData | null>(null);
  const [loadingIndicadores, setLoadingIndicadores] = useState(true);

  const [clienteInput, setClienteInput] = useState("");
  const clienteDebounced = useDebouncedValue(clienteInput, 350);
  const [numpedInput, setNumpedInput] = useState("");
  const numpedDebounced = useDebouncedValue(numpedInput, 350);
  // Pré-marcado com "Aberto Total" (1), "Aberto Parcial" (2) e "Não Fechado" (9) — mesma
  // escolha do CaxHub: é a carteira que interessa no dia a dia.
  const [sitpedFiltro, setSitpedFiltro] = useState<number[]>([1, 2, 9]);
  // Emissão: "yyyy-mm-dd" ou "" (formato nativo do <input type="date">). Sem debounce
  // porque o input só emite a data completa — não há estado intermediário meio digitado.
  const [datemiDe, setDatemiDe] = useState("");
  const [datemiAte, setDatemiAte] = useState("");

  const [page, setPage] = useState(1);
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [pageCliente, setPageCliente] = useState(1);
  // Índice de TODOS os pedidos do filtro atual (ver GET /pedidos/por-cliente/indice) — os
  // grupos da aba são derivados dele, o que permite recalcular Qtd./Valor de cada
  // accordion sem uma segunda chamada agregada.
  const [indice, setIndice] = useState<PedidoIndice[]>([]);
  const [nomesClientes, setNomesClientes] = useState<Record<number, string>>({});
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [clientesExpandidos, setClientesExpandidos] = useState<Set<number>>(new Set());
  const [itensPorCliente, setItensPorCliente] = useState<Record<number, PedidoRow[] | "carregando" | "erro">>({});
  // Clientes com "Sinc. ERP" rodando agora — Set (e não um único codcli) porque dá pra
  // disparar a sincronização de vários clientes da lista sem esperar o anterior acabar.
  const [sincronizandoClientes, setSincronizandoClientes] = useState<Set<number>>(new Set());
  // Sincronização do filtro inteiro: o POST só dispara (202) e o resultado chega por
  // polling em /sincronizar/status — o lote pode passar de minutos, muito além do timeout
  // do nginx (ver comentário na rota, backend/src/routes/pedidos.ts).
  const [sincronizandoFiltro, setSincronizandoFiltro] = useState(false);
  const pollingRef = useRef<number | null>(null);

  const [erro, setErro] = useState<string | null>(null);

  // Filtros mandados pras rotas de listagem e pro disparo da sincronização do filtro —
  // centralizado pra "o que a tela mostra" e "o que a sincronização vai buscar" nunca
  // divergirem. (A rota de itens de um cliente ignora `cliente`, já escopada pelo path.)
  function paramsFiltros() {
    return {
      cliente: clienteDebounced || undefined,
      numped: numpedDebounced || undefined,
      sitped: sitpedFiltro.length > 0 ? sitpedFiltro.join(",") : undefined,
      datemiDe: datemiDe || undefined,
      datemiAte: datemiAte || undefined,
    };
  }

  function carregar() {
    setLoading(true);
    axios
      .get("/api/pedidos", { params: { ...paramsFiltros(), page, pageSize: PAGE_SIZE } })
      .then(({ data }) => {
        setPedidos(data.pedidos);
        setTotal(data.total);
        setErro(null);
      })
      .catch((err) => setErro(err.response?.data?.error ?? "Falha ao carregar pedidos"))
      .finally(() => setLoading(false));
  }

  function carregarPorCliente() {
    setLoadingClientes(true);
    axios
      .get("/api/pedidos/por-cliente/indice", { params: paramsFiltros() })
      .then(({ data }) => {
        setIndice(data.pedidos);
        setNomesClientes(Object.fromEntries((data.clientes as { codcli: number; nome: string }[]).map((c) => [c.codcli, c.nome])));
        setErro(null);
      })
      .catch((err) => setErro(err.response?.data?.error ?? "Falha ao carregar clientes"))
      .finally(() => setLoadingClientes(false));
  }

  function carregarIndicadores() {
    setLoadingIndicadores(true);
    axios
      .get("/api/pedidos/indicadores")
      .then(({ data }) => setIndicadores(data))
      .catch((err) => setErro(err.response?.data?.error ?? "Falha ao carregar indicadores"))
      .finally(() => setLoadingIndicadores(false));
  }

  // Indicadores do "Dash" refletem sempre a base inteira, não os filtros das outras abas —
  // por isso carrega só uma vez ao montar, fora dos effects de filtro.
  useEffect(() => {
    carregarIndicadores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada aba só busca o próprio dado quando está ativa — evita bater nos dois endpoints
  // (Lista e Por Cliente) toda vez que um filtro muda, independente da aba visível.
  useEffect(() => {
    if (visao === "lista") carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao, clienteDebounced, numpedDebounced, sitpedFiltro, datemiDe, datemiAte, page]);

  // Sem `pageCliente` nas dependências: a aba Por Cliente carrega o índice inteiro do
  // filtro de uma vez e pagina no cliente.
  useEffect(() => {
    if (visao === "cliente") carregarPorCliente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao, clienteDebounced, numpedDebounced, sitpedFiltro, datemiDe, datemiAte]);

  // Digitar ou trocar filtro reseta as duas paginações pra página 1 (senão a busca pode
  // "sumir" numa página que não existe mais) e colapsa qualquer cliente expandido — o
  // cache de itens dele reflete o filtro antigo e ficaria inconsistente com a contagem nova.
  useEffect(() => {
    setPage(1);
    setPageCliente(1);
    setClientesExpandidos(new Set());
    setItensPorCliente({});
  }, [clienteDebounced, numpedDebounced, sitpedFiltro, datemiDe, datemiAte]);

  const indicePorCliente = useMemo(() => {
    const mapa = new Map<number, PedidoIndice[]>();
    for (const p of indice) {
      const lista = mapa.get(p.codcli);
      if (lista) lista.push(p);
      else mapa.set(p.codcli, [p]);
    }
    return mapa;
  }, [indice]);

  const totalClientesFiltro = useMemo(() => new Set(indice.map((p) => p.codcli)).size, [indice]);

  const grupos = useMemo<ClienteGrupo[]>(() => {
    const porCliente = new Map<number, { quantidade: number; valorLiquido: number }>();
    for (const p of indice) {
      const bucket = porCliente.get(p.codcli) ?? { quantidade: 0, valorLiquido: 0 };
      bucket.quantidade += 1;
      bucket.valorLiquido += p.vlrliq ?? 0;
      porCliente.set(p.codcli, bucket);
    }
    return [...porCliente.entries()]
      .map(([codcli, bucket]) => ({ codcli, nome: nomesClientes[codcli] ?? String(codcli), ...bucket }))
      .sort((a, b) => b.valorLiquido - a.valorLiquido);
  }, [indice, nomesClientes]);

  const clientes = useMemo(
    () => grupos.slice((pageCliente - 1) * PAGE_SIZE, pageCliente * PAGE_SIZE),
    [grupos, pageCliente]
  );

  function abrirPedido(p: { codemp: number; codfil: number; numped: number }) {
    navigate(`/mercado/pedido/${p.codemp}/${p.codfil}/${p.numped}`);
  }

  function carregarItensCliente(codcli: number) {
    setItensPorCliente((i) => ({ ...i, [codcli]: "carregando" }));
    axios
      .get(`/api/pedidos/por-cliente/${codcli}/itens`, { params: paramsFiltros() })
      .then(({ data }) => setItensPorCliente((i) => ({ ...i, [codcli]: data.itens })))
      .catch(() => setItensPorCliente((i) => ({ ...i, [codcli]: "erro" })));
  }

  function toggleExpandirCliente(cliente: ClienteGrupo) {
    setClientesExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(cliente.codcli)) {
        proximo.delete(cliente.codcli);
      } else {
        proximo.add(cliente.codcli);
        if (!itensPorCliente[cliente.codcli]) carregarItensCliente(cliente.codcli);
      }
      return proximo;
    });
  }

  // Puxa do Senior, na hora, todos os pedidos deste cliente e recarrega a tela com o
  // resultado. O cache de itens do cliente é sempre invalidado — se estiver expandido
  // recarrega na hora, se não, na próxima vez que expandir.
  async function sincronizarCliente(cliente: ClienteGrupo) {
    if (sincronizandoClientes.has(cliente.codcli)) return;
    setSincronizandoClientes((s) => new Set(s).add(cliente.codcli));
    try {
      const { data } = await axios.post(`/api/pedidos/por-cliente/${cliente.codcli}/sincronizar`);
      toast.mostrar(
        `${cliente.nome}: ${data.total} pedido(s) no Senior — ${data.criados} novo(s), ${data.atualizados} atualizado(s).`,
        "success"
      );
      carregarPorCliente();
      if (clientesExpandidos.has(cliente.codcli)) {
        carregarItensCliente(cliente.codcli);
      } else {
        setItensPorCliente((i) => {
          const proximo = { ...i };
          delete proximo[cliente.codcli];
          return proximo;
        });
      }
    } catch (err) {
      const mensagem = axios.isAxiosError(err) ? err.response?.data?.error : null;
      toast.mostrar(mensagem ?? "Falha ao sincronizar os pedidos deste cliente com o ERP", "destructive");
    } finally {
      setSincronizandoClientes((s) => {
        const proximo = new Set(s);
        proximo.delete(cliente.codcli);
        return proximo;
      });
    }
  }

  function pararPolling() {
    if (pollingRef.current != null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  // Acompanha a sincronização do filtro até acabar. Chamado tanto logo após o disparo
  // quanto ao entrar na aba com um lote já rodando (outra aba do navegador, F5 no meio, ou
  // outro usuário) — por isso é idempotente.
  function acompanharSincronizacaoFiltro() {
    if (pollingRef.current != null) return;
    pollingRef.current = window.setInterval(() => {
      axios
        .get("/api/pedidos/sincronizar/status")
        .then(({ data }) => {
          if (data.emAndamento) return;
          pararPolling();
          setSincronizandoFiltro(false);

          if (data.erro) {
            toast.mostrar(`Falha na sincronização do filtro: ${data.erro}`, "destructive");
          } else if (data.resultado) {
            toast.mostrar(
              `${data.totalClientes} cliente(s) sincronizado(s): ${data.resultado.total} pedido(s) — ` +
                `${data.resultado.criados} novo(s), ${data.resultado.atualizados} atualizado(s).`,
              "success"
            );
          }

          carregarPorCliente();
          setClientesExpandidos(new Set());
          setItensPorCliente({});
        })
        // Erro no polling é transitório (rede/deploy): não derruba o acompanhamento,
        // tenta de novo no próximo tick.
        .catch(() => {});
    }, 3000);
  }

  async function sincronizarFiltro() {
    if (sincronizandoFiltro) return;
    setSincronizandoFiltro(true);
    try {
      const { data } = await axios.post("/api/pedidos/sincronizar", null, { params: paramsFiltros() });
      toast.mostrar(`Sincronizando ${data.totalClientes} cliente(s) com o Senior — rodando em segundo plano.`, "neutral");
      acompanharSincronizacaoFiltro();
    } catch (err) {
      setSincronizandoFiltro(false);
      const mensagem = axios.isAxiosError(err) ? err.response?.data?.error : null;
      toast.mostrar(mensagem ?? "Falha ao disparar a sincronização do filtro", "destructive");
    }
  }

  // Ao abrir a aba Por Cliente, verifica se já existe lote rodando pra tela refletir isso
  // em vez de oferecer um disparo que o backend recusaria com 409.
  useEffect(() => {
    if (visao !== "cliente" || sincronizandoFiltro) return;
    axios
      .get("/api/pedidos/sincronizar/status")
      .then(({ data }) => {
        if (!data.emAndamento) return;
        setSincronizandoFiltro(true);
        acompanharSincronizacaoFiltro();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao]);

  useEffect(() => pararPolling, []);

  const tabClass = (ativa: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      ativa ? "bg-primary text-primary-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <div>
      <p className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-muted">Mercado · Listar Pedidos</p>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Listar Pedidos</h1>
          <p className="mt-1 text-sm text-muted">Pedidos importados do Senior (E120PED).</p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-md border border-border p-1">
          <button onClick={() => setVisao("lista")} className={tabClass(visao === "lista")}>
            Lista
          </button>
          <button onClick={() => setVisao("cliente")} className={tabClass(visao === "cliente")}>
            Por Cliente
          </button>
          <button onClick={() => setVisao("dash")} className={tabClass(visao === "dash")}>
            Dash
          </button>
        </div>
      </div>

      {visao !== "dash" && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            value={clienteInput}
            onChange={(e) => setClienteInput(e.target.value)}
            placeholder="Cliente (código ou nome)"
            className={`${inputClass} w-64`}
          />
          <input
            value={numpedInput}
            onChange={(e) => setNumpedInput(e.target.value)}
            placeholder="Nº do pedido (aceita lista: 101,102)"
            className={`${inputClass} w-64`}
          />
          <MultiSelectDropdown<number>
            opcoes={SITPED_OPCOES}
            selecionados={sitpedFiltro}
            onChange={setSitpedFiltro}
            labelTodos="Todas as situações"
            labelSufixo="situação(ões)"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Emissão:</span>
            <input type="date" value={datemiDe} onChange={(e) => setDatemiDe(e.target.value)} className={inputClass} />
            <span className="text-sm text-muted">até</span>
            <input type="date" value={datemiAte} onChange={(e) => setDatemiAte(e.target.value)} className={inputClass} />
          </div>
        </div>
      )}

      {erro && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{erro}</p>
      )}

      {visao === "dash" && <PedidosDashboard dados={indicadores} loading={loadingIndicadores} />}

      {visao === "lista" && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH_CLASS}>Emp./Fil.</th>
                  <th className={TH_CLASS}>Pedido</th>
                  <th className={TH_CLASS}>Cliente</th>
                  <th className={TH_CLASS}>Emissão</th>
                  <th className={TH_CLASS}>Previsão</th>
                  <th className={TH_CLASS}>Pedido do Cliente</th>
                  <th className={TH_CLASS}>Cond. Pagamento</th>
                  <th className={TH_CLASS_RIGHT}>Valor Líquido</th>
                  <th className={TH_CLASS_RIGHT}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t border-border/60">
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-[7px] py-[10px]">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!loading &&
                  pedidos.map((p) => (
                    <LinhaPedido key={`${p.codemp}-${p.codfil}-${p.numped}`} pedido={p} onAbrir={() => abrirPedido(p)} />
                  ))}
                {!loading && pedidos.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-sm text-muted">
                      Nenhum pedido encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} loading={loading} onPageChange={setPage} label="pedidos" />
        </div>
      )}

      {visao === "cliente" && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-muted">
              {totalClientesFiltro.toLocaleString("pt-BR")} cliente(s) no filtro atual
            </p>
            <button
              onClick={sincronizarFiltro}
              disabled={sincronizandoFiltro || totalClientesFiltro === 0}
              className="rounded-md border border-border px-3 py-1.5 text-[12.5px] text-muted transition hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sincronizandoFiltro ? "Sincronizando..." : "Sinc. ERP do filtro inteiro"}
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH_CLASS}>Cliente</th>
                  <th className={TH_CLASS_RIGHT}>Qtd. Pedidos</th>
                  <th className={TH_CLASS_RIGHT}>Valor Líquido</th>
                  <th className={TH_CLASS_RIGHT}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loadingClientes &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-t border-border/60">
                      {Array.from({ length: 4 }).map((__, j) => (
                        <td key={j} className="px-[7px] py-[10px]">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!loadingClientes &&
                  clientes.map((c) => {
                    const expandido = clientesExpandidos.has(c.codcli);
                    const itens = itensPorCliente[c.codcli];
                    return (
                      <Fragment key={c.codcli}>
                        <tr className="cursor-pointer border-t border-border/60 transition hover:bg-surface-2" onClick={() => toggleExpandirCliente(c)}>
                          <td className="px-[7px] py-[10px] text-sm text-foreground">
                            <span className="mr-2 font-mono text-muted">{expandido ? "−" : "+"}</span>
                            {c.nome}
                          </td>
                          <td className={`${TD_CLASS} text-right font-mono text-sm tabular-nums text-muted`}>{c.quantidade}</td>
                          <td className={`${TD_CLASS} text-right font-mono text-sm font-semibold tabular-nums text-foreground`}>
                            {fmtMoney(c.valorLiquido)}
                          </td>
                          <td className={`${TD_CLASS} text-right`}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                sincronizarCliente(c);
                              }}
                              disabled={sincronizandoClientes.has(c.codcli) || sincronizandoFiltro}
                              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted transition hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {sincronizandoClientes.has(c.codcli) ? "..." : "Sinc. ERP"}
                            </button>
                          </td>
                        </tr>
                        {expandido && (
                          <tr className="border-t border-border/60 bg-surface-2/40">
                            <td colSpan={4} className="px-[7px] py-[10px]">
                              {itens === "carregando" && <Skeleton className="h-4 w-48" />}
                              {itens === "erro" && <p className="text-sm text-destructive">Falha ao carregar os pedidos deste cliente.</p>}
                              {Array.isArray(itens) && itens.length === 0 && (
                                <p className="text-sm text-muted">Nenhum pedido deste cliente com os filtros atuais.</p>
                              )}
                              {Array.isArray(itens) && itens.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr>
                                        <th className={TH_CLASS}>Pedido</th>
                                        <th className={TH_CLASS}>Emissão</th>
                                        <th className={TH_CLASS}>Previsão</th>
                                        <th className={TH_CLASS}>Cond. Pagamento</th>
                                        <th className={TH_CLASS_RIGHT}>Valor Líquido</th>
                                        <th className={TH_CLASS_RIGHT}>Situação</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {itens.map((p) => (
                                        <tr
                                          key={`${p.codemp}-${p.codfil}-${p.numped}`}
                                          className="cursor-pointer border-t border-border/60 transition hover:bg-surface"
                                          onClick={() => abrirPedido(p)}
                                        >
                                          <td className={`${TD_CLASS} font-mono text-sm font-semibold text-foreground`}>
                                            {p.codemp}/{p.codfil}/{p.numped}
                                          </td>
                                          <td className={`${TD_CLASS} font-mono text-sm text-muted`}>{fmtData(p.datemi)}</td>
                                          <td className={`${TD_CLASS} font-mono text-sm text-muted`}>{fmtData(p.datprv)}</td>
                                          <td className={`${TD_CLASS} text-sm text-muted`}>{p.condicaoPagamentoLabel ?? "—"}</td>
                                          <td className={`${TD_CLASS} text-right font-mono text-sm font-semibold tabular-nums text-foreground`}>
                                            {fmtMoney(p.vlrliq)}
                                          </td>
                                          <td className={`${TD_CLASS} text-right`}>
                                            <span className={`inline-block whitespace-nowrap rounded px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-wide ${toneBadge[p.sitpedTone]}`}>
                                              {p.sitpedLabel}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                {!loadingClientes && clientes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted">
                      Nenhum cliente encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Pagination
              page={pageCliente}
              pageSize={PAGE_SIZE}
              total={grupos.length}
              loading={loadingClientes}
              onPageChange={setPageCliente}
              label="clientes"
            />
          </div>
        </div>
      )}
    </div>
  );
}
