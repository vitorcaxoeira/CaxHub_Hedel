import "dotenv/config";
import express from "express";
import { garantirDiretorioUploads, AVATARS_DIR } from "./config/uploads";
import { authRouter } from "./auth/routes";
import { syncErpRouter } from "./routes/syncErp";
import { usersRouter } from "./routes/users";
import { perfilRouter } from "./routes/perfil";
import { financeiroRouter } from "./routes/financeiro";
import { recebimentosRouter } from "./routes/recebimentos";
import { inadimplenciaRouter } from "./routes/inadimplencia";
import { clientesFinanceiroRouter } from "./routes/clientesFinanceiro";
import { fluxoCaixaRouter } from "./routes/fluxoCaixa";
import { historicoFinanceiroRouter } from "./routes/historicoFinanceiro";
import { pedidosRouter } from "./routes/pedidos";
import { pedidoVisualizacaoRouter } from "./routes/pedidoVisualizacao";
import { notasFiscaisEntradaRouter } from "./routes/notasFiscaisEntrada";

import { scheduleEmpresaSync } from "./sync/empresaSync";
import { scheduleFilialSync } from "./sync/filialSync";
import { scheduleClienteSync } from "./sync/clienteSync";
import { scheduleFornecedorSync } from "./sync/fornecedorSync";
import { scheduleNotaFiscalEntradaSync } from "./sync/notaFiscalEntradaSync";
import { scheduleTipoTituloSync } from "./sync/tipoTituloSync";
import { scheduleTituloReceberSync } from "./sync/tituloReceberSync";
import { scheduleMovimentoTituloReceberSync } from "./sync/movimentoTituloReceberSync";
import { scheduleRepresentanteSync } from "./sync/representanteSync";
import { scheduleCentroCustoSync } from "./sync/centroCustoSync";
import { scheduleMovimentoContaSync } from "./sync/movimentoContaSync";
import { scheduleNaturezaFinanceiraSync } from "./sync/naturezaFinanceiraSync";
import { schedulePortadorSync } from "./sync/portadorSync";
import { scheduleMoedaSync } from "./sync/moedaSync";
import { scheduleContaCorrenteSync } from "./sync/contaCorrenteSync";
import { scheduleTransacaoSync } from "./sync/transacaoSync";
import { schedulePedidoSync } from "./sync/pedidoSync";
import { scheduleFormaPagamentoSync } from "./sync/formaPagamentoSync";
import { scheduleCondicaoPagamentoSync } from "./sync/condicaoPagamentoSync";

// CaxHub_Hedel — espelho local da estrutura PADRÃO do Senior (nada de tabela/view USU_,
// que é customização e mora no CaxHub). Só leitura do ERP: não há canal de escrita aqui.
const app = express();
app.use(express.json());

garantirDiretorioUploads();

// Única pasta de upload servida SEM autenticação, de propósito: o avatar carrega por
// <img src> puro, que não manda header Authorization. O arquivo é sempre `{userId}.webp`,
// então a URL não revela nada além do id — e o fotoUrl gravado no banco leva ?v=timestamp
// pra furar o cache do navegador quando a foto troca.
app.use("/uploads/avatars", express.static(AVATARS_DIR));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/perfil", perfilRouter);
app.use("/sync-erp", syncErpRouter);

// A ordem de montagem importa: "/financeiro" é prefixo dos outros cinco, mas o Express casa
// por caminho completo dentro de cada router, então quem pede /financeiro/recebimentos cai no
// router certo. O prefixo em si é contrato com o frontend, que chama caminho absoluto.
app.use("/financeiro", financeiroRouter);
app.use("/financeiro/recebimentos", recebimentosRouter);
app.use("/financeiro/inadimplencia", inadimplenciaRouter);
app.use("/financeiro/clientes", clientesFinanceiroRouter);
app.use("/financeiro/fluxo-caixa", fluxoCaixaRouter);
app.use("/financeiro/historico", historicoFinanceiroRouter);

app.use("/pedidos", pedidosRouter);
app.use("/pedido-visualizacao", pedidoVisualizacaoRouter);
app.use("/notas-fiscais-entrada", notasFiscaisEntradaRouter);

const PORT = Number(process.env.PORT ?? 3001);

app.listen(PORT, () => {
  console.log(`CaxHub_Hedel backend rodando na porta ${PORT}`);

  // Mesma ordem de dependência do registry (src/sync/registry.ts) — ver o comentário lá
  // sobre por que Portador e Transação vêm antes dos Títulos.
  scheduleEmpresaSync();
  scheduleFilialSync();
  scheduleClienteSync();
  scheduleFornecedorSync();
  scheduleNotaFiscalEntradaSync();
  scheduleTipoTituloSync();
  schedulePortadorSync();
  scheduleTransacaoSync();
  scheduleTituloReceberSync();
  scheduleMovimentoTituloReceberSync();
  scheduleRepresentanteSync();
  scheduleCentroCustoSync();
  scheduleMovimentoContaSync();
  scheduleNaturezaFinanceiraSync();
  scheduleMoedaSync();
  scheduleContaCorrenteSync();
  schedulePedidoSync();
  scheduleFormaPagamentoSync();
  scheduleCondicaoPagamentoSync();
});
