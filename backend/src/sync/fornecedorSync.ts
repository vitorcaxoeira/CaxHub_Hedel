import cron from "node-cron";
import { runSqlViaSoap } from "../soap/client";
import { prisma } from "../db/prisma";

export const JOB_NAME = "fornecedor-sync";
export const CRON_EXPR = "25 3 * * *";
export const CAMPO_DATA: string | null = "DatAtu";
const BASE_QUERY = `SELECT
  codfor AS codfor, nomfor AS nomfor, apefor AS apefor, tipfor AS tipfor,
  tipmer AS tipmer, codram AS codram, insest AS insest, cgccpf AS cgccpf,
  endfor AS endfor, cplend AS cplend, cepfor AS cepfor, baifor AS baifor,
  cidfor AS cidfor, sigufs AS sigufs, codpai AS codpai, sitfor AS sitfor
FROM e095for`;

function montarQuery(desde?: Date): string {
  if (!desde) return BASE_QUERY;
  return `${BASE_QUERY} WHERE ${CAMPO_DATA} >= '${desde.toISOString().slice(0, 10)}'`;
}

interface FornecedorRow {
  codfor: number;
  nomfor: string;
  apefor: string;
  tipfor: string;
  tipmer: string;
  codram: string | null;
  insest: string | null;
  cgccpf: number | null;
  endfor: string | null;
  cplend: string | null;
  cepfor: number | null;
  baifor: string | null;
  cidfor: string | null;
  sigufs: string | null;
  codpai: string | null;
  sitfor: string;
}

export async function runFornecedorSync(desde?: Date): Promise<void> {
  const query = montarQuery(desde);
  try {
    const rows = (await runSqlViaSoap(query)) as FornecedorRow[];

    for (const row of rows) {
      // Diferente de Cliente.cgccpf (obrigatório): aqui o dicionário do Senior marca o
      // campo como anulável, e a base tem fornecedor sem CNPJ/CPF cadastrado — BigInt(null)
      // lançaria, então só converte quando o valor existe.
      const data = { ...row, cgccpf: row.cgccpf != null ? BigInt(row.cgccpf) : null };
      await prisma.fornecedor.upsert({
        where: { codfor: row.codfor },
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

// Cadastro de fornecedores muda pouco — roda 1x por dia às 3h25, logo depois de
// cliente-sync (3h20). O modo incremental só roda quando disparado manualmente pela tela
// de administração de sincronização.
export function scheduleFornecedorSync(): void {
  cron.schedule(CRON_EXPR, () => runFornecedorSync());
}
