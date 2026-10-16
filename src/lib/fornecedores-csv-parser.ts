export interface FornecedorParsedRow {
  codigo_interno: string;
  razao_social: string;
  nome: string;
  linhaOriginal: number;
}

export type FornecedorCsvRow = FornecedorParsedRow;

export interface FornecedoresCsvResult {
  fornecedores: FornecedorParsedRow[];
  totalLidos: number;
  validos: number;
  ignorados: number;
}

function detectDelimiter(line: string): string {
  const candidates = [";", ",", "\t", "|"];
  let best = ";";
  let bestCount = -1;
  for (const c of candidates) {
    const count = line.split(c).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

/** Split respeitando aspas duplas. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/**
 * Processa a matriz de dados (linhas x colunas).
 * Regra: Primeiro fornecedor está na C8 (coluna C, linha 8) e o nome na H8 (coluna H, linha 8).
 * - Coluna C = índice 2
 * - Coluna H = índice 7
 * - Linha 8 = índice 7 (0-based)
 */
function processDataGrid(grid: any[][]): FornecedoresCsvResult {
  let startRow = 7; // Linha 8 (0-indexed)
  let colCodigo = 2; // Coluna C (0-indexed)
  let colNome = 7; // Coluna H (0-indexed)

  // Verifica se há cabeçalho explícito antes da linha 8
  for (let r = 0; r < Math.min(8, grid.length); r++) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;
    let foundCode = -1;
    let foundName = -1;
    row.forEach((cell, idx) => {
      const val = String(cell ?? "").trim().toUpperCase();
      if (val === "CÓDIGO" || val === "CODIGO" || val === "CÓD." || val === "COD.") {
        foundCode = idx;
      }
      if (val === "RAZÃO SOCIAL" || val === "RAZAO SOCIAL" || val === "NOME" || val === "FORNECEDOR") {
        foundName = idx;
      }
    });
    if (foundCode !== -1 && foundName !== -1) {
      colCodigo = foundCode;
      colNome = foundName;
      startRow = r + 1;
      break;
    }
  }

  const seen = new Set<string>();
  const fornecedores: FornecedorParsedRow[] = [];
  let totalLidos = 0;
  let ignorados = 0;

  for (let i = startRow; i < grid.length; i++) {
    const row = grid[i];
    if (!Array.isArray(row)) continue;
    totalLidos++;

    const rawCodigo = row[colCodigo];
    const rawNome = row[colNome];

    const codigo = String(rawCodigo ?? "").trim();
    const razaoSocial = String(rawNome ?? "").trim().toUpperCase();

    // Ignora linhas vazias
    if (!codigo && !razaoSocial) {
      ignorados++;
      continue;
    }

    // Ignora cabeçalhos repetidos, títulos de relatório ou rodapés
    if (
      razaoSocial.includes("TOTAL") ||
      razaoSocial.includes("PROCESSADO POR") ||
      razaoSocial.includes("RELATÓRIO") ||
      codigo.toUpperCase() === "CÓDIGO" ||
      codigo.toUpperCase() === "CODIGO"
    ) {
      ignorados++;
      continue;
    }

    // Razão social deve ser válida
    if (!razaoSocial) {
      ignorados++;
      continue;
    }

    // Deduplicação pelo código interno se houver, ou pela razão social
    const dedupKey = codigo ? `cod:${codigo}` : `nome:${razaoSocial}`;
    if (seen.has(dedupKey)) {
      ignorados++;
      continue;
    }
    seen.add(dedupKey);

    fornecedores.push({
      codigo_interno: codigo,
      razao_social: razaoSocial,
      nome: razaoSocial,
      linhaOriginal: i + 1,
    });
  }

  return {
    fornecedores,
    totalLidos,
    validos: fornecedores.length,
    ignorados,
  };
}

export async function parseFornecedoresFile(buffer: ArrayBuffer, fileName = ""): Promise<FornecedoresCsvResult> {
  const isExcel =
    fileName.toLowerCase().endsWith(".xlsx") ||
    fileName.toLowerCase().endsWith(".xls") ||
    isExcelBuffer(buffer);

  if (isExcel) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("A planilha não contém nenhuma aba.");
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
    return processDataGrid(grid);
  }

  // Arquivo de texto CSV / TXT
  const text = decodeFile(buffer);
  return parseFornecedoresCsv(text);
}

function isExcelBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer.slice(0, 4));
  // ZIP (PK..): 0x50, 0x4B, 0x03, 0x04 (XLSX)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return true;
  // OLE / Compound Document: 0xD0, 0xCF, 0x11, 0xE0 (XLS)
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return true;
  return false;
}

/**
 * Parser de texto CSV com delimitador automático.
 */
export function parseFornecedoresCsv(text: string): FornecedoresCsvResult {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("Arquivo CSV vazio.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const grid = lines.map((line) => splitLine(line, delimiter));

  return processDataGrid(grid);
}

/**
 * Decodifica o buffer com fallback UTF-8 → windows-1252.
 */
export function decodeFile(buffer: ArrayBuffer): string {
  let text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (text.includes("\uFFFD")) {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text;
}
