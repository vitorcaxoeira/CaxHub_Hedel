// Domínio "LTipNfe" do Senior (tipo da nota fiscal de entrada — E440NFC).
export const TIPNFE_LABELS: Record<number, string> = {
  1: "NF Entrada",
  2: "Devolução (NF do Cliente)",
  3: "Devolução (NF de Saída)",
  4: "Retorno (Industrialização)",
  5: "Retorno (Outros)",
  6: "NF Produtor",
  7: "NF Geração Manual",
  8: "NF Frete/Serviços Agregados",
  9: "NF Acerto",
  10: "NF Acerto (NF Saída)",
  11: "Transferência entre Empresas/Filiais",
};

export function tipnfeLabel(tipnfe: number | null): string {
  if (tipnfe === null) return "—";
  return TIPNFE_LABELS[tipnfe] ?? `Tipo ${tipnfe}`;
}

// Domínio "LSitNfs" do Senior (situação da nota fiscal — vale tanto para entrada quanto
// saída, por isso o nome não bate com "Nfc").
export const SITNFC_LABELS: Record<string, string> = {
  "1": "Digitada",
  "2": "Fechada",
  "3": "Cancelada",
  "4": "Documento Fiscal Emitido (saída)",
  "5": "Aguardando Fechamento (pós-saída)",
  "6": "Aguardando Integração WMS",
  "7": "Digitada Integração",
  "8": "Agrupada",
};

export function sitnfcLabel(sitnfc: string): string {
  return SITNFC_LABELS[sitnfc] ?? `Situação ${sitnfc}`;
}

export function sitnfcTone(sitnfc: string): "success" | "warning" | "destructive" | "neutral" {
  if (sitnfc === "3") return "destructive"; // Cancelada
  if (sitnfc === "2") return "success"; // Fechada
  if (sitnfc === "1" || sitnfc === "7") return "warning"; // Digitada / Digitada Integração — ainda não fechada
  return "neutral"; // Documento Fiscal Emitido, Aguardando Fechamento, Aguardando WMS, Agrupada
}
