import { Router } from "express";
import { Pedido, Cliente } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/middleware";
import { prisma } from "../db/prisma";
import { sitpedLabel, sitpedTone, SITPED_LABELS } from "../domain/pedidoDominio";
import { runPedidoSyncPorClientes, ResultadoSyncPorCliente } from "../sync/pedidoSync";

// Tela "Mercado > Listar Pedidos" — espelho de E120PED (ver backend/src/sync/pedidoSync.ts).
//
// PORTADO DO CAXHUB SEM O VÍNCULO PEDIDO -> RAT -> PROPOSTA.
// Lá, cada pedido é decorado com a RAT que o originou (casando `usu_numrat`), a proposta
// dessa RAT e o consultor executor — e há três filtros construídos em cima dessa
// indireção (nº da RAT, nº da proposta, modalidade da proposta). Nada disso existe aqui,
// e não por opção: o recorte deste projeto é só tabela PADRÃO do Senior, então nem a
// coluna `usu_numrat` veio para o model Pedido, nem as tabelas USU_TE777RAT /
// USU_TE077PRO existem no espelho. O que sobra é o pedido em si — que para um grupo de
// máquinas e importação é o dado que interessa.
//
// Também saem, por dependerem da proposta: o KPI "com RAT vinculada" e a distribuição
// por forma de faturamento (`forfat` é campo da Proposta, não do Pedido).
//
// REGISTROS EXCLUÍDOS NO SENIOR: toda leitura que ALIMENTA uma lista, contagem ou soma de
// pedidos filtra `removidoEmSenior: null` — senão pedido apagado no ERP segue inflando
// listagem e KPI (ver backend/src/sync/varrerRemovidos.ts).
//
// O que NÃO se filtra, de propósito:
//   - lookups de Cliente/FormaPagamento/CondicaoPagamento, que só decoram a linha:
//     filtrar ali faria um pedido vivo aparecer sem nome de cliente. A regra geral é "se
//     o registro é lido a partir de uma FK de outra linha que continua visível, não se
//     filtra";
//   - a tela de detalhe (routes/pedidoVisualizacao.ts), que viraria 404 — ela devolve o
//     pedido com `removidoEmSenior` preenchido e a tela mostra uma tarja.
export const pedidosRouter = Router();
// Papéis em sincronia com o RequireRole de App.tsx e o grupo "Mercado" da Sidebar.
pedidosRouter.use(requireAuth, requireRole("admin", "diretoria", "comercial"));

function handleError(res: import("express").Response, error: unknown, label: string) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[pedidos:${label}]`, message);
  res.status(500).json({ error: message });
}

// Forma de Pagamento (codfpg) e Condição de Pagamento (codcpg) direto do Pedido. Padrão
// `IN` (não `OR` por chave composta) mesmo em tabelas pequenas (59/534 linhas hoje), por
// consistência: essa função também roda sobre a base inteira em /indicadores, e `OR` com
// milhares de cláusulas explode o planning time do Postgres.
export async function resolverFormaECondicaoPagamento(pedidos: Pedido[]) {
  const codempsUnicos = [...new Set(pedidos.map((p) => p.codemp))];
  const codfpgsUnicos = [...new Set(pedidos.filter((p) => p.codfpg != null).map((p) => p.codfpg as number))];
  const codcpgsUnicos = [...new Set(pedidos.map((p) => p.codcpg))];

  const formasPagamento =
    codfpgsUnicos.length > 0
      ? await prisma.formaPagamento.findMany({ where: { codemp: { in: codempsUnicos }, codfpg: { in: codfpgsUnicos } } })
      : [];
  const formaPagamentoPorChave = new Map(formasPagamento.map((f) => [`${f.codemp}-${f.codfpg}`, f]));

  const condicoesPagamento =
    codcpgsUnicos.length > 0
      ? await prisma.condicaoPagamento.findMany({ where: { codemp: { in: codempsUnicos }, codcpg: { in: codcpgsUnicos } } })
      : [];
  const condicaoPagamentoPorChave = new Map(condicoesPagamento.map((c) => [`${c.codemp}-${c.codcpg}`, c]));

  return { formaPagamentoPorChave, condicaoPagamentoPorChave };
}

interface FiltrosPedidos {
  buscaCliente: string;
  buscaNumped: string;
  sitpedFiltro: number[];
  datemiDe: Date | null;
  datemiAte: Date | null;
}

// Data de emissão vem do <input type="date"> como "yyyy-mm-dd". Comparada em UTC de
// propósito: `datemi` é `@db.Date`, então o Prisma devolve meia-noite UTC — montar a data
// no fuso do servidor deslocaria o limite e deixaria o pedido do próprio dia de fora.
function lerData(valor: unknown): Date | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(data.getTime()) ? null : data;
}

// Number("") é 0 (não NaN) — sem essa guarda, ausência do filtro viraria [0] e
// esconderia todos os pedidos.
function lerFiltroMultiSelect(valor: unknown): number[] {
  const raw = typeof valor === "string" ? valor : "";
  return raw
    ? raw
        .split(",")
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v))
    : [];
}

// Lê os filtros compartilhados pelas 3 rotas de listagem (Lista, Por Cliente e os itens
// de um cliente expandido) — cada rota decide quais desses aplicar.
function lerFiltros(req: import("express").Request): FiltrosPedidos {
  return {
    buscaCliente: typeof req.query.cliente === "string" ? req.query.cliente.trim().toLowerCase() : "",
    buscaNumped: typeof req.query.numped === "string" ? req.query.numped.trim() : "",
    sitpedFiltro: lerFiltroMultiSelect(req.query.sitped),
    datemiDe: lerData(req.query.datemiDe),
    datemiAte: lerData(req.query.datemiAte),
  };
}

// Suporta lista separada por vírgula num campo de busca (ex.: "12124,12123,12121") —
// cada termo continua comparado por substring, igual busca de valor único, só que
// "bate com QUALQUER um dos termos" em vez de exigir um valor exato.
function termosBusca(valor: string): string[] {
  return valor
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function aplicarFiltros(
  pedidos: Pedido[],
  filtros: FiltrosPedidos,
  clientePorCodcli: Map<number, Cliente>,
  { comCliente = true }: { comCliente?: boolean } = {}
): Pedido[] {
  let resultado = pedidos;
  if (comCliente && filtros.buscaCliente) {
    resultado = resultado.filter((p) => {
      const cliente = clientePorCodcli.get(p.codcli);
      const label = cliente ? `${cliente.codcli} - ${cliente.nomcli}` : String(p.codcli);
      return label.toLowerCase().includes(filtros.buscaCliente);
    });
  }
  if (filtros.buscaNumped) {
    const termos = termosBusca(filtros.buscaNumped);
    resultado = resultado.filter((p) => termos.some((t) => String(p.numped).includes(t)));
  }
  if (filtros.sitpedFiltro.length > 0) {
    resultado = resultado.filter((p) => filtros.sitpedFiltro.includes(p.sitped));
  }
  // Intervalo fechado dos dois lados: quem digita 27/07 a 27/07 espera ver os pedidos
  // emitidos em 27/07. Cada limite funciona sozinho — só "de", só "até", ou os dois.
  if (filtros.datemiDe) {
    const de = filtros.datemiDe;
    resultado = resultado.filter((p) => p.datemi >= de);
  }
  if (filtros.datemiAte) {
    const ate = filtros.datemiAte;
    resultado = resultado.filter((p) => p.datemi <= ate);
  }
  return resultado;
}

interface Lookups {
  clientePorCodcli: Map<number, Cliente>;
  formaPagamentoPorChave: Awaited<ReturnType<typeof resolverFormaECondicaoPagamento>>["formaPagamentoPorChave"];
  condicaoPagamentoPorChave: Awaited<ReturnType<typeof resolverFormaECondicaoPagamento>>["condicaoPagamentoPorChave"];
}

// Monta a linha de resposta de um pedido com os labels/vínculos resolvidos — reaproveitada
// por GET / e GET /por-cliente/:codcli/itens.
function mapearPedido(p: Pedido, lookups: Lookups) {
  const cliente = lookups.clientePorCodcli.get(p.codcli);
  const formaPagamento = p.codfpg != null ? lookups.formaPagamentoPorChave.get(`${p.codemp}-${p.codfpg}`) : undefined;
  const condicaoPagamento = lookups.condicaoPagamentoPorChave.get(`${p.codemp}-${p.codcpg}`);
  return {
    codemp: p.codemp,
    codfil: p.codfil,
    numped: p.numped,
    cliente: cliente ? `${cliente.codcli} - ${cliente.nomcli}` : String(p.codcli),
    datemi: p.datemi,
    datprv: p.datprv,
    obsped: p.obsped,
    obsmot: p.obsmot,
    vlrliq: p.vlrliq != null ? Number(p.vlrliq) : null,
    pedcli: p.pedcli,
    sitped: p.sitped,
    sitpedLabel: sitpedLabel(p.sitped),
    sitpedTone: sitpedTone(p.sitped),
    formaPagamentoLabel: formaPagamento?.desfpg ?? null,
    condicaoPagamentoLabel: condicaoPagamento?.descpg ?? null,
  };
}

// GET / — lista de pedidos, com filtro de cliente (busca livre), número do pedido,
// situação (multi-select) e faixa de emissão. Carrega tudo via Prisma, filtra em memória,
// pagina por último.
pedidosRouter.get("/", async (req, res) => {
  try {
    let pedidos = await prisma.pedido.findMany({
      where: { removidoEmSenior: null },
      orderBy: [{ datemi: "desc" }, { numped: "desc" }],
    });

    const codclisUnicos = [...new Set(pedidos.map((p) => p.codcli))];
    const clientes = codclisUnicos.length > 0 ? await prisma.cliente.findMany({ where: { codcli: { in: codclisUnicos } } }) : [];
    const clientePorCodcli = new Map(clientes.map((c) => [c.codcli, c]));

    const filtros = lerFiltros(req);
    pedidos = aplicarFiltros(pedidos, filtros, clientePorCodcli);

    const total = pedidos.length;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));
    const inicioPagina = (page - 1) * pageSize;
    pedidos = pedidos.slice(inicioPagina, inicioPagina + pageSize);

    // Forma/Condição de Pagamento só pra página atual.
    const { formaPagamentoPorChave, condicaoPagamentoPorChave } = await resolverFormaECondicaoPagamento(pedidos);
    const lookups: Lookups = { clientePorCodcli, formaPagamentoPorChave, condicaoPagamentoPorChave };

    res.json({
      total,
      pedidos: pedidos.map((p) => mapearPedido(p, lookups)),
    });
  } catch (error) {
    handleError(res, error, "listar");
  }
});

// Pedidos que passam nos filtros da barra da tela. É a base comum de
// GET /por-cliente/indice e POST /sincronizar — os dois TÊM que enxergar exatamente o
// mesmo conjunto, senão o contador do botão de sincronizar não bate com o que a tela mostra.
async function resolverPedidosFiltrados(req: import("express").Request) {
  const pedidosTodos = await prisma.pedido.findMany({ where: { removidoEmSenior: null } });

  const codclisUnicos = [...new Set(pedidosTodos.map((p) => p.codcli))];
  const clientes = codclisUnicos.length > 0 ? await prisma.cliente.findMany({ where: { codcli: { in: codclisUnicos } } }) : [];
  const clientePorCodcli = new Map(clientes.map((c) => [c.codcli, c]));

  const filtros = lerFiltros(req);
  const pedidos = aplicarFiltros(pedidosTodos, filtros, clientePorCodcli);

  return { pedidos, clientePorCodcli };
}

// Clientes que batem com os filtros atuais, agregados e ordenados por valor líquido
// somado (maior primeiro) — sem paginação. Usado por POST /sincronizar, que precisa da
// lista INTEIRA de codclis do filtro, não só a da página visível.
async function resolverGruposPorCliente(req: import("express").Request) {
  const { pedidos: pedidosFiltrados, clientePorCodcli } = await resolverPedidosFiltrados(req);

  const porClienteMap = new Map<number, { quantidade: number; valorLiquido: number }>();
  for (const p of pedidosFiltrados) {
    const bucket = porClienteMap.get(p.codcli) ?? { quantidade: 0, valorLiquido: 0 };
    bucket.quantidade += 1;
    bucket.valorLiquido += p.vlrliq != null ? Number(p.vlrliq) : 0;
    porClienteMap.set(p.codcli, bucket);
  }

  return [...porClienteMap.entries()]
    .map(([codcli, bucket]) => {
      const cliente = clientePorCodcli.get(codcli);
      return { codcli, nome: cliente ? `${cliente.codcli} - ${cliente.nomcli}` : String(codcli), ...bucket };
    })
    .sort((a, b) => b.valorLiquido - a.valorLiquido);
}

// GET /por-cliente/indice — índice ENXUTO de todos os pedidos que passam nos filtros da
// barra, para a aba "Por Cliente" filtrar por coluna no navegador.
//
// Por que existe: a aba carrega os itens de um cliente só quando o accordion é expandido,
// então o browser não tem como saber os valores distintos de uma coluna, nem recalcular
// "Qtd. Pedidos"/"Valor Líquido" de cada grupo, nem esconder cliente que ficou sem
// resultado. Esse índice dá exatamente isso e nada mais — a linha completa continua vindo
// de /por-cliente/:codcli/itens ao expandir.
pedidosRouter.get("/por-cliente/indice", async (req, res) => {
  try {
    const { pedidos, clientePorCodcli } = await resolverPedidosFiltrados(req);

    const codclisPresentes = [...new Set(pedidos.map((p) => p.codcli))];

    res.json({
      // Nome do cliente vem à parte, uma vez por cliente — repetir em cada pedido
      // engordaria o índice à toa.
      clientes: codclisPresentes.map((codcli) => {
        const cliente = clientePorCodcli.get(codcli);
        return { codcli, nome: cliente ? `${cliente.codcli} - ${cliente.nomcli}` : String(codcli) };
      }),
      pedidos: pedidos.map((p) => ({
        // Mesma chave da linha completa, pra casar índice e linha exibida.
        chave: `${p.codemp}-${p.codfil}-${p.numped}`,
        codcli: p.codcli,
        vlrliq: p.vlrliq != null ? Number(p.vlrliq) : null,
        sitped: p.sitped,
        sitpedLabel: sitpedLabel(p.sitped),
      })),
    });
  } catch (error) {
    handleError(res, error, "indice-por-cliente");
  }
});

// GET /por-cliente/:codcli/itens — pedidos de um cliente específico, sob os mesmos
// filtros de Pedido/Situação/emissão (não o de Cliente, que já é o :codcli do path). Sem
// paginação — mostra tudo do grupo já filtrado.
pedidosRouter.get("/por-cliente/:codcli/itens", async (req, res) => {
  try {
    const codcli = Number(req.params.codcli);
    if (!Number.isFinite(codcli)) {
      res.status(400).json({ error: "codcli inválido" });
      return;
    }

    let pedidos = await prisma.pedido.findMany({
      where: { codcli, removidoEmSenior: null },
      orderBy: [{ datemi: "desc" }, { numped: "desc" }],
    });

    const cliente = await prisma.cliente.findUnique({ where: { codcli } });
    const clientePorCodcli = new Map(cliente ? [[cliente.codcli, cliente]] : []);

    const filtros = lerFiltros(req);
    pedidos = aplicarFiltros(pedidos, filtros, clientePorCodcli, { comCliente: false });

    const { formaPagamentoPorChave, condicaoPagamentoPorChave } = await resolverFormaECondicaoPagamento(pedidos);
    const lookups: Lookups = { clientePorCodcli, formaPagamentoPorChave, condicaoPagamentoPorChave };

    res.json({ itens: pedidos.map((p) => mapearPedido(p, lookups)) });
  } catch (error) {
    handleError(res, error, "por-cliente-itens");
  }
});

// POST /por-cliente/:codcli/sincronizar — puxa do Senior, na hora, todos os pedidos deste
// cliente (ação "Sinc. ERP" da aba Por Cliente), sem esperar o job diário.
//
// Diferente do disparo de sync do painel de administração (syncErp.ts, "fire and forget"),
// aqui a requisição espera o resultado: é uma consulta pequena (um cliente só) e a tela
// precisa do número de pedidos novos/atualizados pra dar o retorno e recarregar a lista.
const sincronizacoesEmAndamento = new Set<number>();

// Estado da sincronização em lote (POST /sincronizar), em memória — o backend roda em
// processo único e o painel de administração já guarda o "em andamento" dele do mesmo
// jeito. Some se o processo reiniciar, e tudo bem: o efeito colateral do job (os upserts)
// é o que importa, o estado aqui é só pra tela acompanhar.
interface StatusSincronizacaoLote {
  emAndamento: boolean;
  totalClientes: number;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  resultado: ResultadoSyncPorCliente | null;
  erro: string | null;
}

let statusLote: StatusSincronizacaoLote = {
  emAndamento: false,
  totalClientes: 0,
  iniciadoEm: null,
  concluidoEm: null,
  resultado: null,
  erro: null,
};

pedidosRouter.post("/por-cliente/:codcli/sincronizar", async (req, res) => {
  const codcli = Number(req.params.codcli);
  if (!Number.isInteger(codcli)) {
    res.status(400).json({ error: "codcli inválido" });
    return;
  }
  if (statusLote.emAndamento) {
    res.status(409).json({ error: "Sincronização do filtro em andamento — aguarde ela terminar" });
    return;
  }
  // Guarda contra duplo clique / duas abas: dois pulls simultâneos do mesmo cliente
  // fariam os mesmos upserts em paralelo à toa.
  if (sincronizacoesEmAndamento.has(codcli)) {
    res.status(409).json({ error: "Sincronização deste cliente já em andamento" });
    return;
  }

  sincronizacoesEmAndamento.add(codcli);
  try {
    const resultado = await runPedidoSyncPorClientes([codcli]);
    res.json(resultado);
  } catch (error) {
    handleError(res, error, "sincronizar-cliente");
  } finally {
    sincronizacoesEmAndamento.delete(codcli);
  }
});

// POST /sincronizar — mesma coisa, mas pra TODOS os clientes que batem com os filtros
// atuais (todas as páginas, não só a visível).
//
// Aqui, diferente da ação de um cliente só, a requisição NÃO espera o fim: o filtro pode
// pegar centenas de clientes e o nginx da VPS corta requisição parada em 60s
// (deploy/nginx.conf não sobe o proxy_read_timeout). Responde 202 e a tela acompanha por
// GET /sincronizar/status — mesmo padrão "fire and forget" de syncErp.ts.
pedidosRouter.post("/sincronizar", async (req, res) => {
  try {
    if (statusLote.emAndamento) {
      res.status(409).json({ error: "Já existe uma sincronização de filtro em andamento" });
      return;
    }
    if (sincronizacoesEmAndamento.size > 0) {
      res.status(409).json({ error: "Existe sincronização de cliente em andamento — aguarde ela terminar" });
      return;
    }

    const grupos = await resolverGruposPorCliente(req);
    const codclis = grupos.map((g) => g.codcli);
    if (codclis.length === 0) {
      res.status(400).json({ error: "Nenhum cliente bate com os filtros atuais" });
      return;
    }

    statusLote = {
      emAndamento: true,
      totalClientes: codclis.length,
      iniciadoEm: new Date().toISOString(),
      concluidoEm: null,
      resultado: null,
      erro: null,
    };

    runPedidoSyncPorClientes(codclis)
      .then((resultado) => {
        statusLote = { ...statusLote, resultado, erro: null };
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[pedidos:sincronizar-filtro] falhou:", message);
        statusLote = { ...statusLote, resultado: null, erro: message };
      })
      .finally(() => {
        statusLote = { ...statusLote, emAndamento: false, concluidoEm: new Date().toISOString() };
      });

    res.status(202).json({ status: "iniciado", totalClientes: codclis.length });
  } catch (error) {
    handleError(res, error, "sincronizar-filtro");
  }
});

// GET /sincronizar/status — acompanhamento do POST /sincronizar. Depois que termina, o
// último resultado continua aqui até a próxima sincronização, pra tela conseguir mostrar
// o desfecho mesmo se o polling perder a virada (ou se a pessoa recarregar a página).
pedidosRouter.get("/sincronizar/status", (_req, res) => {
  res.json({ ...statusLote, clientesEmAndamento: [...sincronizacoesEmAndamento] });
});

// GET /indicadores — KPIs pra aba "Dash": sempre sobre a base inteira, sem aplicar os
// filtros da aba Lista.
//
// Sem "com RAT vinculada" nem distribuição por forma de faturamento, que no CaxHub vêm da
// proposta. Em troca entram dois recortes que fazem sentido aqui e lá não fariam: ticket
// médio, e a distribuição por empresa do grupo — são 7 empresas no Hedel, contra 1 no
// CaxHub, então "de qual empresa é este pedido" deixa de ser pergunta trivial.
pedidosRouter.get("/indicadores", async (_req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({ where: { removidoEmSenior: null } });
    const total = pedidos.length;

    const naoFechados = pedidos.filter((p) => p.sitped === 9).length;
    const abertos = pedidos.filter((p) => p.sitped === 1 || p.sitped === 2).length;
    const valorLiquidoTotal = pedidos.reduce((soma, p) => soma + (p.vlrliq != null ? Number(p.vlrliq) : 0), 0);
    const ticketMedio = total > 0 ? valorLiquidoTotal / total : 0;

    const porSituacaoMap = new Map<number, number>();
    const porEmpresaMap = new Map<number, { quantidade: number; valorLiquido: number }>();
    for (const p of pedidos) {
      porSituacaoMap.set(p.sitped, (porSituacaoMap.get(p.sitped) ?? 0) + 1);
      const bucketEmp = porEmpresaMap.get(p.codemp) ?? { quantidade: 0, valorLiquido: 0 };
      bucketEmp.quantidade += 1;
      bucketEmp.valorLiquido += p.vlrliq != null ? Number(p.vlrliq) : 0;
      porEmpresaMap.set(p.codemp, bucketEmp);
    }

    const empresas = await prisma.empresa.findMany({ where: { codemp: { in: [...porEmpresaMap.keys()] } } });
    const empresaPorCodemp = new Map(empresas.map((e) => [e.codemp, e]));

    const codclisUnicos = [...new Set(pedidos.map((p) => p.codcli))];
    const clientes = codclisUnicos.length > 0 ? await prisma.cliente.findMany({ where: { codcli: { in: codclisUnicos } } }) : [];
    const clientePorCodcli = new Map(clientes.map((c) => [c.codcli, c]));
    const porClienteMap = new Map<number, { quantidade: number; valorLiquido: number }>();
    for (const p of pedidos) {
      const bucket = porClienteMap.get(p.codcli) ?? { quantidade: 0, valorLiquido: 0 };
      bucket.quantidade += 1;
      bucket.valorLiquido += p.vlrliq != null ? Number(p.vlrliq) : 0;
      porClienteMap.set(p.codcli, bucket);
    }
    const topClientes = [...porClienteMap.entries()]
      .sort((a, b) => b[1].valorLiquido - a[1].valorLiquido)
      .slice(0, 10)
      .map(([codcli, bucket]) => {
        const cliente = clientePorCodcli.get(codcli);
        return {
          codcli,
          nome: cliente ? `${cliente.codcli} - ${cliente.nomcli}` : String(codcli),
          quantidade: bucket.quantidade,
          valorLiquido: bucket.valorLiquido,
        };
      });

    res.json({
      total,
      naoFechados,
      abertos,
      valorLiquidoTotal,
      ticketMedio,
      porSituacao: [...porSituacaoMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([sitped, quantidade]) => ({
          sitped,
          label: SITPED_LABELS[sitped] ?? `Situação ${sitped}`,
          tone: sitpedTone(sitped),
          quantidade,
        })),
      porEmpresa: [...porEmpresaMap.entries()]
        .sort((a, b) => b[1].valorLiquido - a[1].valorLiquido)
        .map(([codemp, bucket]) => ({
          codemp,
          nome: empresaPorCodemp.get(codemp)?.nomemp ?? `Empresa ${codemp}`,
          quantidade: bucket.quantidade,
          valorLiquido: bucket.valorLiquido,
        })),
      topClientes,
    });
  } catch (error) {
    handleError(res, error, "indicadores");
  }
});
