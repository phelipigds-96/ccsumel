import type { ImportRow } from "@/lib/produtos";

export interface SysmoParseResult {
  rows: ImportRow[];
  totalLidos: number;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseBRNumber(raw: string): number {
  const value = raw.trim().replace(/\s/g, "");
  if (!value) return 0;

  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function isSysmoHeader(line: string): boolean {
  const normalized = normalizeText(line);

  return (
    normalized.includes("descricao") &&
    normalized.includes("barras") &&
    normalized.includes("venda") &&
    normalized.includes("custo") &&
    normalized.includes("codigo")
  );
}

function isSysmoFooterOrInstitutionalLine(line: string): boolean {
  const trimmed = line.trim();
  const normalized = normalizeText(trimmed);

  return (
    !normalized ||
    normalized.includes("sumel alimentos") ||
    normalized.includes("relatorio de sistema") ||
    normalized.includes("quantidade de produtos") ||
    normalized.includes("processado por") ||
    normalized.startsWith("pagina") ||
    normalized.startsWith("p_gina") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("hora:") ||
    /^[-_=\s.]+$/.test(trimmed)
  );
}

const MONEY_PATTERN = /\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+,\d{2,4}/g;
const INTERNAL_CODE_PATTERN = /(\d{2,})\s*$/;
const BARCODE_PATTERN = /^(.+?)\s+(\d{8,14})\s*$/;

function parseSysmoProductLine(line: string): ImportRow | null {
  const codigoMatch = INTERNAL_CODE_PATTERN.exec(line);
  if (!codigoMatch) return null;

  const codigo = codigoMatch[1];
  const beforeCodigo = line.slice(0, codigoMatch.index).trimEnd();
  const moneyMatches = Array.from(beforeCodigo.matchAll(MONEY_PATTERN));

  // Linha válida do Sysmo sempre tem preço de venda E custo (2 valores monetários).
  if (moneyMatches.length < 2) return null;

  const custoMatch = moneyMatches[moneyMatches.length - 1];
  const precoVendaMatch = moneyMatches[moneyMatches.length - 2];
  const descricaoAndBarcode = beforeCodigo.slice(0, precoVendaMatch.index).trimEnd();
  const barcodeMatch = BARCODE_PATTERN.exec(descricaoAndBarcode);

  const descricao = (barcodeMatch ? barcodeMatch[1] : descricaoAndBarcode).trim();
  if (descricao.length < 3) return null;

  const preco_venda = parseBRNumber(precoVendaMatch[0]);
  if (preco_venda <= 0) return null;

  return {
    codigo,
    gtin: barcodeMatch ? barcodeMatch[2] : null,
    descricao,
    preco_venda,
    custo: parseBRNumber(custoMatch[0]),
  };
}

/**
 * Parser dedicado ao TXT de largura fixa exportado pelo ERP Sysmo S1.
 *
 * Layout interpretado:
 * - ignora cabeçalhos institucionais, rodapés e quebras de página;
 * - inicia somente após o cabeçalho que contém "Descrição";
 * - lê as colunas: Descrição, barras opcional, venda, custo opcional e código;
 * - usa o código interno como chave principal da linha importada.
 */
export function parseSysmoTxt(content: string): SysmoParseResult {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const rows: ImportRow[] = [];
  let reachedProductTable = false;

  for (const line of lines) {
    if (isSysmoHeader(line)) {
      reachedProductTable = true;
      continue;
    }

    if (!reachedProductTable || isSysmoFooterOrInstitutionalLine(line)) {
      continue;
    }

    const row = parseSysmoProductLine(line);
    if (row) rows.push(row);
  }

  if (!reachedProductTable) {
    throw new Error('Cabeçalho "Descrição barras venda custo codigo" não encontrado no TXT do Sysmo S1.');
  }

  return {
    rows,
    totalLidos: rows.length,
  };
}