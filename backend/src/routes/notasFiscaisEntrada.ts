import { Router } from "express";
import { Prisma } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/middleware";
import { prisma } from "../db/prisma";
import { tipnfeLabel, sitnfcLabel, sitnfcTone } from "../domain/notaFiscalEntradaDominio";

// Tela "Suprimentos > Notas de Entrada" — espelho de E440NFC
// (ver backend/src/sync/notaFiscalEntradaSync.ts).
export const notasFiscaisEntradaRouter = Router();
// Papéis em sincronia com o RequireRole de App.tsx e o grupo "Suprimentos" da Sidebar.
notasFiscaisEntradaRouter.use(requireAuth, requireRole("admin", "diretoria", "financeiro"));

function handleError(res: import("express").Response, error: unknown, label: string) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[notas-fiscais-entrada:${label}]`, message);
  res.status(500).json({ error: message });
}

function lerData(valor: unknown): Date | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function lerSituacoes(valor: unknown): string[] {
  const raw = typeof valor === "string" ? valor : "";
  return raw
    ? raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
}

// Formato "codemp:codfil,codemp:codfil" — mesmo formato que EmpresaFilialFilter.tsx
// produz (usado em Financeiro · Contas a Receber e aqui). Pares que não vierem como dois
// números válidos são descartados em silêncio, em vez de derrubar a requisição.
function lerEmpresasFiliais(valor: unknown): { codemp: number; codfil: number }[] {
  const raw = typeof valor === "string" ? valor : "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((par) => {
      const [codempStr, codfilStr] = par.split(":");
      const codemp = Number(codempStr);
      const codfil = Number(codfilStr);
      return Number.isFinite(codemp) && Number.isFinite(codfil) ? { codemp, codfil } : null;
    })
    .filter((v): v is { codemp: number; codfil: number } => v !== null);
}

// Condição de empresa/filial, reaproveitada entre a lista e os indicadores — mesmo padrão
// de Financeiro · Contas a Receber, onde empFil é filtro de ESCOPO (afeta KPIs e lista),
// diferente de situação/fornecedor/data, que só refinam a lista.
function condicaoEmpresasFiliais(empFil: { codemp: number; codfil: number }[]): Prisma.NotaFiscalEntradaWhereInput | null {
  if (empFil.length === 0) return null;
  return { OR: empFil.map((e) => ({ codemp: e.codemp, codfil: e.codfil })) };
}

// Filtro a nível de banco (WHERE do Prisma), não em memória: diferente de Pedido (~4 mil
// linhas, carrega tudo e filtra em JS), esta tabela já nasce com 86 mil linhas na origem
// e só cresce — filtrar em memória a cada requisição não escalaria.
//
// Construído como array de condições em AND, cada uma podendo ter seu próprio OR interno
// (fornecedor OU nome; um par empresa/filial OU outro) — atribuir direto em `where.OR`
// duas vezes seguidas (fornecedor e depois empFil) sobrescreveria a primeira condição em
// vez de somar as duas.
function montarWhere(req: import("express").Request): Prisma.NotaFiscalEntradaWhereInput {
  const AND: Prisma.NotaFiscalEntradaWhereInput[] = [];

  const fornecedor = typeof req.query.fornecedor === "string" ? req.query.fornecedor.trim() : "";
  if (fornecedor) {
    const comoNumero = Number(fornecedor);
    AND.push({
      OR: [
        ...(Number.isFinite(comoNumero) ? [{ codfor: comoNumero }] : []),
        { fornecedor: { nomfor: { contains: fornecedor, mode: "insensitive" as const } } },
      ],
    });
  }

  const condEmpFil = condicaoEmpresasFiliais(lerEmpresasFiliais(req.query.empFil));
  if (condEmpFil) AND.push(condEmpFil);

  const situacoes = lerSituacoes(req.query.situacao);
  if (situacoes.length > 0) AND.push({ sitnfc: { in: situacoes } });

  const datemiDe = lerData(req.query.datemiDe);
  const datemiAte = lerData(req.query.datemiAte);
  if (datemiDe || datemiAte) {
    AND.push({
      datemi: {
        ...(datemiDe ? { gte: datemiDe } : {}),
        ...(datemiAte ? { lte: datemiAte } : {}),
      },
    });
  }

  return AND.length > 0 ? { AND } : {};
}

// GET /opcoes-filtro — empresas e filiais pra alimentar o EmpresaFilialFilter, mesmo
// componente e mesmo endpoint no espírito do que Financeiro · Contas a Receber usa.
notasFiscaisEntradaRouter.get("/opcoes-filtro", async (_req, res) => {
  try {
    const [empresas, filiais] = await Promise.all([
      prisma.empresa.findMany({ select: { codemp: true, nomemp: true, sigemp: true }, orderBy: { codemp: "asc" } }),
      prisma.filial.findMany({
        select: { codemp: true, codfil: true, nomfil: true, sigfil: true },
        orderBy: [{ codemp: "asc" }, { codfil: "asc" }],
      }),
    ]);
    res.json({ empresas, filiais });
  } catch (error) {
    handleError(res, error, "opcoes-filtro");
  }
});

// GET / — lista paginada, com filtro de empresa/filial, fornecedor (busca livre por
// código ou nome), situação (multi-select) e faixa de emissão.
notasFiscaisEntradaRouter.get("/", async (req, res) => {
  try {
    const where = montarWhere(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));

    const [total, notas, condicoesPagamento] = await Promise.all([
      prisma.notaFiscalEntrada.count({ where }),
      prisma.notaFiscalEntrada.findMany({
        where,
        orderBy: [{ datemi: "desc" }, { numnfc: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        // CodFor é FK de verdade (ver schema.prisma) — dá pra usar `include` nativo do
        // Prisma em vez do resolver manual por código que Pedido precisa fazer pra Cliente.
        include: { fornecedor: { select: { codfor: true, nomfor: true } } },
      }),
      // Só ~530 linhas — mais barato buscar tudo de uma vez do que resolver por chave a
      // cada página, mesmo padrão de resolverFormaECondicaoPagamento em routes/pedidos.ts.
      prisma.condicaoPagamento.findMany({ select: { codemp: true, codcpg: true, descpg: true } }),
    ]);

    const condPorChave = new Map(condicoesPagamento.map((c) => [`${c.codemp}-${c.codcpg}`, c.descpg]));

    res.json({
      total,
      notas: notas.map((n) => ({
        codemp: n.codemp,
        codfil: n.codfil,
        codfor: n.codfor,
        numnfc: n.numnfc,
        codsnf: n.codsnf,
        fornecedor: `${n.fornecedor.codfor} - ${n.fornecedor.nomfor}`,
        tipnfeLabel: tipnfeLabel(n.tipnfe),
        datemi: n.datemi,
        datent: n.datent,
        vlrliq: n.vlrliq != null ? Number(n.vlrliq) : null,
        sitnfc: n.sitnfc,
        sitnfcLabel: sitnfcLabel(n.sitnfc),
        sitnfcTone: sitnfcTone(n.sitnfc),
        condicaoPagamentoLabel: condPorChave.get(`${n.codemp}-${n.codcpg}`) ?? null,
      })),
    });
  } catch (error) {
    handleError(res, error, "listar");
  }
});

// GET /indicadores — KPIs pra aba "Dash". Empresa/filial É aplicado (mesmo padrão de
// Contas a Receber: é filtro de ESCOPO, não de refinamento de lista) — fornecedor,
// situação e faixa de emissão continuam de fora, só a aba Lista usa esses três.
// Usa aggregate/groupBy do Prisma — a soma e o agrupamento rodam no Postgres, sem
// carregar as ~86 mil linhas pra somar em memória.
notasFiscaisEntradaRouter.get("/indicadores", async (req, res) => {
  try {
    const where = condicaoEmpresasFiliais(lerEmpresasFiliais(req.query.empFil)) ?? {};

    const [totais, porSituacao, topFornecedoresAgrupado] = await Promise.all([
      prisma.notaFiscalEntrada.aggregate({ where, _count: true, _sum: { vlrliq: true } }),
      prisma.notaFiscalEntrada.groupBy({ where, by: ["sitnfc"], _count: true }),
      prisma.notaFiscalEntrada.groupBy({
        where,
        by: ["codfor"],
        _count: true,
        _sum: { vlrliq: true },
        orderBy: { _sum: { vlrliq: "desc" } },
        take: 10,
      }),
    ]);

    const total = totais._count;
    const valorLiquidoTotal = totais._sum.vlrliq != null ? Number(totais._sum.vlrliq) : 0;
    const ticketMedio = total > 0 ? valorLiquidoTotal / total : 0;

    const fornecedores = await prisma.fornecedor.findMany({
      where: { codfor: { in: topFornecedoresAgrupado.map((f) => f.codfor) } },
      select: { codfor: true, nomfor: true },
    });
    const fornecedorPorCodigo = new Map(fornecedores.map((f) => [f.codfor, f.nomfor]));

    res.json({
      total,
      valorLiquidoTotal,
      ticketMedio,
      porSituacao: porSituacao
        .map((s) => ({
          sitnfc: s.sitnfc,
          label: sitnfcLabel(s.sitnfc),
          tone: sitnfcTone(s.sitnfc),
          quantidade: s._count,
        }))
        .sort((a, b) => b.quantidade - a.quantidade),
      topFornecedores: topFornecedoresAgrupado.map((f) => ({
        codfor: f.codfor,
        nome: fornecedorPorCodigo.get(f.codfor) ?? String(f.codfor),
        quantidade: f._count,
        valorLiquido: f._sum.vlrliq != null ? Number(f._sum.vlrliq) : 0,
      })),
    });
  } catch (error) {
    handleError(res, error, "indicadores");
  }
});
