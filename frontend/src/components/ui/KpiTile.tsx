import { Skeleton } from "./Skeleton";

// No CaxHub este bloco está copiado literalmente em seis telas (ContasReceber, Recebimentos,
// Inadimplencia, Clientes, Historico e ExecutivaTab), cada uma com sua própria cópia dos mapas
// `toneText`/`toneBg`. Aqui ele é um componente só — mudar o visual do KPI passa a ser uma
// edição, não seis.
//
// Não confundir com o `KpiCard` do CaxHub, que é outra coisa: aquele tem ícone, barra de
// progresso e formatação de horas de proposta (USU_QtdHor), e não veio para este projeto.

export type KpiTone = "success" | "warning" | "destructive" | "neutral";

const toneText: Record<KpiTone, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  neutral: "text-foreground",
};

const toneBg: Record<KpiTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-muted",
};

export interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  /**
   * Omitir é significativo, não é o mesmo que "neutral": as telas do CaxHub vêm em duas
   * variantes, e ambas continuam existindo aqui.
   *
   *   sem `tone`  -> valor em text-foreground e legenda sem marcador (Recebimentos,
   *                  Clientes, Historico)
   *   com `tone`  -> valor colorido e bolinha da mesma cor antes da legenda
   *                  (Inadimplencia, ExecutivaTab)
   */
  tone?: KpiTone | string;
}

export function KpiTile({ label, value, sub, tone }: KpiTileProps) {
  // `tone` chega como string das telas — os cards são montados em arrays literais, sem
  // anotação de tipo. Valor fora do conjunto cai em "neutral" em vez de quebrar o className.
  const t: KpiTone | undefined =
    tone === undefined
      ? undefined
      : (["success", "warning", "destructive", "neutral"] as const).includes(tone as KpiTone)
        ? (tone as KpiTone)
        : "neutral";

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="mb-2 text-[11.5px] text-muted">{label}</p>
      <span
        className={`block font-mono text-2xl font-semibold tabular-nums ${t ? toneText[t] : "text-foreground"}`}
      >
        {value}
      </span>
      {sub && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
          {t && <span className={`h-1.5 w-1.5 flex-none rounded-full ${toneBg[t]}`} />}
          {sub}
        </p>
      )}
    </div>
  );
}

/** Placeholder do KpiTile durante o carregamento — mesma moldura, para a grade não pular. */
export function KpiTileSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <Skeleton className="mb-2 h-3.5 w-32" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}
