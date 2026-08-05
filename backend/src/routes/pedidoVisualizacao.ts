import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { prisma } from "../db/prisma";
import { sitpedLabel, sitpedTone, tippedLabel, prcpedLabel } from "../domain/pedidoDominio";
import { resolverFormaECondicaoPagamento } from "./pedidos";

// Tela de visualização somente-leitura de um Pedido.
//
// Portada do CaxHub sem a seção de RAT/Proposta (nº da RAT, link pra ficha da RAT, nº da
// proposta, situação da proposta e as duas formas de faturamento). Ver o cabeçalho de
// routes/pedidos.ts: o vínculo depende de `usu_numrat` e das tabelas USU_, que não
// existem neste espelho.
export const pedidoVisualizacaoRouter = Router();
pedidoVisualizacaoRouter.use(requireAuth, requireRole("admin", "diretoria", "comercial"));

// Vários campos de texto livre do Senior vêm preenchidos só com espaço (" ") em vez de
// nulo quando "vazios" — mesmo comportamento já visto no pedidoSync (obsmot é quase
// sempre " ") — sem isso, a tela mostraria a seção de Observações em branco.
function textoOuNulo(valor: string | null): string | null {
  if (valor == null) return null;
  const limpo = valor.trim();
  return limpo === "" ? null : limpo;
}

pedidoVisualizacaoRouter.get("/:codemp/:codfil/:numped", async (req, res) => {
  try {
    const codemp = Number(req.params.codemp);
    const codfil = Number(req.params.codfil);
    const numped = Number(req.params.numped);
    if (!Number.isFinite(codemp) || !Number.isFinite(codfil) || !Number.isFinite(numped)) {
      res.status(400).json({ error: "codemp/codfil/numped inválidos" });
      return;
    }

    // Sem filtro de `removidoEmSenior` aqui, diferente das listagens: quem chega nesta
    // tela veio de um link direto e transformar isso em 404 esconderia a informação mais
    // útil, que é "este pedido existia e sumiu do ERP". O registro vem normalmente, com a
    // data de remoção, e a tela mostra uma tarja.
    const pedido = await prisma.pedido.findUnique({ where: { codemp_codfil_numped: { codemp, codfil, numped } } });
    if (!pedido) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    const [cliente, empresa, { formaPagamentoPorChave, condicaoPagamentoPorChave }] = await Promise.all([
      prisma.cliente.findUnique({ where: { codcli: pedido.codcli } }),
      prisma.empresa.findUnique({ where: { codemp: pedido.codemp } }),
      resolverFormaECondicaoPagamento([pedido]),
    ]);

    const formaPagamento = pedido.codfpg != null ? formaPagamentoPorChave.get(`${pedido.codemp}-${pedido.codfpg}`) : undefined;
    const condicaoPagamento = condicaoPagamentoPorChave.get(`${pedido.codemp}-${pedido.codcpg}`);

    res.json({
      pedido: {
        codemp: pedido.codemp,
        codfil: pedido.codfil,
        numped: pedido.numped,
        // O grupo tem 7 empresas — diferente do CaxHub, onde só existe uma e o nome seria
        // ruído. Aqui saber de qual empresa é o pedido importa.
        empresaNome: empresa?.nomemp ?? null,
        cliente: cliente ? `${cliente.codcli} - ${cliente.nomcli}` : String(pedido.codcli),
        sitpedLabel: sitpedLabel(pedido.sitped),
        sitpedTone: sitpedTone(pedido.sitped),
        tippedLabel: tippedLabel(pedido.tipped),
        prcpedLabel: prcpedLabel(pedido.prcped),
        tnspro: textoOuNulo(pedido.tnspro),
        tnsser: textoOuNulo(pedido.tnsser),
        datemi: pedido.datemi,
        horemi: pedido.horemi,
        datprv: pedido.datprv,
        vlrliq: pedido.vlrliq != null ? Number(pedido.vlrliq) : null,
        formaPagamentoLabel: formaPagamento?.desfpg ?? null,
        condicaoPagamentoLabel: condicaoPagamento?.descpg ?? null,
        obsped: textoOuNulo(pedido.obsped),
        obsmot: textoOuNulo(pedido.obsmot),
        pedcli: textoOuNulo(pedido.pedcli),
        // null = pedido vivo no Senior. Preenchido = sumiu de lá e já não aparece nas
        // listagens; os dados abaixo são o último retrato conhecido.
        removidoEmSenior: pedido.removidoEmSenior,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[pedido-visualizacao]", message);
    res.status(500).json({ error: message });
  }
});
