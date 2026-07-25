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
  const normalized = normalizeText(line.trim());

  return (
    !normalized ||
    normalized.includes("sumel alimentos") ||
    normalized.includes("relatorio de sistema") ||
    normalized.includes("quantidade de produtos") ||
    normalized.includes("processado por:") ||
    normalized.startsWith("pagina") ||
    /^[-_=\s]+$/.test(line)
  );
}

const MONEY_PATTERN = /\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+,\d{2,4}/g;
const INTERNAL_CODE_PATTERN = /(\d+)\s*$/;
const BARCODE_PATTERN = /^(.+?)\s+(\d{8,14})\s*$/;

function parseSysmoProductLine(line: string): ImportRow | null {
  const codigoMatch = INTERNAL_CODE_PATTERN.exec(line);
  if (!codigoMatch) return null;

  const codigo = codigoMatch[1];
  const beforeCodigo = line.slice(0, codigoMatch.index).trimEnd();
  const moneyMatches = Array.from(beforeCodigo.matchAll(MONEY_PATTERN));

  if (moneyMatches.length === 0) return null;

  const lastMoney = moneyMatches[moneyMatches.length - 1];
  const gapBetweenLastMoneyAndCode = beforeCodigo.length - (lastMoney.index ?? 0) - lastMoney[0].length;
  const hasCost = moneyMatches.length >= 2 && gapBetweenLastMoneyAndCode <= 6;

  const custoMatch = hasCost ? lastMoney : null;
  const precoVendaMatch = hasCost ? moneyMatches[moneyMatches.length - 2] : lastMoney;
  const descricaoAndBarcode = beforeCodigo.slice(0, precoVendaMatch.index).trimEnd();
  const barcodeMatch = BARCODE_PATTERN.exec(descricaoAndBarcode);

  const descricao = (barcodeMatch ? barcodeMatch[1] : descricaoAndBarcode).trim();
  if (!descricao) return null;

  return {
    codigo,
    gtin: barcodeMatch ? barcodeMatch[2] : null,
    descricao,
    preco_venda: parseBRNumber(precoVendaMatch[0]),
    custo: custoMatch ? parseBRNumber(custoMatch[0]) : 0,
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