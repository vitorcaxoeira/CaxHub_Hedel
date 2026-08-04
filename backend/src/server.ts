import "dotenv/config";
import express from "express";
import { authRouter } from "./auth/routes";
import { syncErpRouter } from "./routes/syncErp";

import { scheduleEmpresaSync } from "./sync/empresaSync";
import { scheduleFilialSync } from "./sync/filialSync";
import { scheduleClienteSync } from "./sync/clienteSync";
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

app.use("/auth", authRouter);
app.use("/sync-erp", syncErpRouter);

const PORT = Number(process.env.PORT ?? 3001);

app.listen(PORT, () => {
  console.log(`CaxHub_Hedel backend rodando na porta ${PORT}`);

  // Mesma ordem de dependência do registry (src/sync/registry.ts) — ver o comentário lá
  // sobre por que Portador e Transação vêm antes dos Títulos.
  scheduleEmpresaSync();
  scheduleFilialSync();
  scheduleClienteSync();
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
