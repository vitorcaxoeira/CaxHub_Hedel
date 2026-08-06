import cron from "node-cron";
import { runSqlViaSoapPaginated } from "../soap/client";
import { prisma } from "../db/prisma";

export const JOB_NAME = "nota_fiscal_entrada-sync";
export const CRON_EXPR = "50 4 * * *";
// Data da geração do registro — mesma escolha e mesma incerteza de tituloReceberSync.ts:
// não há campo de "alteração" dedicado, e DatGer pode não capturar toda mudança de
// situação da nota. Nunca veio nulo nas 86.535 linhas conferidas contra a origem.
export const CAMPO_DATA: string | null = "DatGer";
const BASE_QUERY = `SELECT
  codemp AS codemp, codfil AS codfil, codfor AS codfor, numnfc AS numnfc, codsnf AS codsnf,
  tipnfe AS tipnfe, datent AS datent, datemi AS datemi, datger AS datger,
  codcpg AS codcpg, codfpg AS codfpg, codmoe AS codmoe, vlrliq AS vlrliq,
  sitnfc AS sitnfc, codmot AS codmot, chvnel AS chvnel
FROM e440nfc`;

function montarQuery(desde?: Date): string {
  if (!desde) return BASE_QUERY;
  return `${BASE_QUERY} WHERE ${CAMPO_DATA} >= '${desde.toISOString().slice(0, 10)}'`;
}

interface NotaFiscalEntradaRow {
  codemp: number;
  codfil: number;
  codfor: number;
  numnfc: number;
  codsnf: string;
  tipnfe: number | null;
  datent: string | null;
  datemi: string;
  datger: string | null;
  codcpg: string;
  codfpg: number | null;
  codmoe: string | null;
  vlrliq: number | null;
  sitnfc: string;
  codmot: number | null;
  chvnel: string | null;
}

export async function runNotaFiscalEntradaSync(desde?: Date): Promise<void> {
  const query = montarQuery(desde);
  try {
    // 86.535 linhas na origem — acima do limite de truncamento do serviço SOAP entre
    // 30 e 40 mil, então precisa paginar. ORDER BY pela própria PK, mesmo padrão de
    // tituloReceberSync.ts.
    const rows = (await runSqlViaSoapPaginated(query, [
      "codemp",
      "codfil",
      "codfor",
      "numnfc",
      "codsnf",
    ])) as NotaFiscalEntradaRow[];

    for (const row of rows) {
      const data = {
        codemp: row.codemp,
        codfil: row.codfil,
        codfor: row.codfor,
        numnfc: row.numnfc,
        codsnf: row.codsnf,
        tipnfe: row.tipnfe,
        datent: row.datent ? new Date(row.datent) : null,
        datemi: new Date(row.datemi),
        datger: row.datger ? new Date(row.datger) : null,
        codcpg: row.codcpg,
        // Dois sentinelas confirmados contra a origem, não órfãos de FK: CodFpg=0 e
        // CodMoe=' ' (espaço, não NULL) significam "não informado" em 83.513 e 40.273 das
        // 86.535 linhas. Sem esta conversão, gravariam 0 e "" em vez de ausência.
        codfpg: row.codfpg === 0 ? null : row.codfpg,
        codmoe: row.codmoe?.trim() ? row.codmoe.trim() : null,
        vlrliq: row.vlrliq,
        sitnfc: row.sitnfc,
        codmot: row.codmot,
        chvnel: row.chvnel,
      };
      await prisma.notaFiscalEntrada.upsert({
        where: {
          codemp_codfil_codfor_numnfc_codsnf: {
            codemp: row.codemp,
            codfil: row.codfil,
            codfor: row.codfor,
            numnfc: row.numnfc,
            codsnf: row.codsnf,
          },
        },
        update: data,
        create: data,
      });
    }

    await prisma.syncLog.create({
      data: { jobName: JOB_NAME, query, status: "success" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.syncLog.create({
      data: { jobName: JOB_NAME, query, status: "error", message },
    });
    console.error(`[${JOB_NAME}] falhou:`, message);
  }
}

// O agendamento automático sempre roda completo (sem "desde") — o modo incremental só é
// usado quando disparado manualmente pela tela de administração de sincronização.
export function scheduleNotaFiscalEntradaSync(): void {
  cron.schedule(CRON_EXPR, () => runNotaFiscalEntradaSync());
}
