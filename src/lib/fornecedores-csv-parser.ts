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

function detectDelimiter(lines: string[]): string {
  const candidates = [";", ",", "\t", "|"];
  let best = "";
  let bestCount = 0;
  for (const c of candidates) {
    let count = 0;
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      count += lines[i].split(c).length - 1;
    }
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return bestCount > 0 ? best : "";
}

/** Split respeitando aspas duplas. Se não houver delimitador (arquivo txt formatado por espaços), retorna a linha inteira. */
function splitLine(line: string, delimiter: string): string[] {
  if (!delimiter) return [line.trim()];

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

function cleanCode(raw: any): string {
  if (raw === undefined || raw === null) return "";
  let str = String(raw).trim();
  // Remove sufixo .0 ou .00 comum em exportações numéricas do Excel
  str = str.replace(/\.0+$/, "");
  return str;
}

/**
 * Regex para capturar Código e Nome quando estão na mesma linha ou célula (relatório de impressão TXT ou Excel sem colunas delimitadas).
 * Ex: "   Código:     55685         Nome:       FITOS ALIMENTOS LTDA         Tipo:   F ..."
 */
const INLINE_ERP_REGEX = /c[óo\uFFFD]digo\s*:\s*([0-9]+(?:\.[0-9]+)?)\s+nome\s*:\s*(.*?)(?:\s+tipo\s*:|\s{4,}Grupo:|\s{4,}CNPJ|$)/i;

/**
 * Analisa uma linha para extrair fornecedor:
 * 1. Verifica padrão em linha de texto corrida (TXT ou Excel com linha em célula única).
 * 2. Verifica padrão de células separadas (CSV/XLS com colunas C e H ou rótulos "Código:" e "Nome:").
 */
function parseRowSupplier(row: any[], r: number): { codigo: string; nome: string } | null {
  const fullRowStr = Array.isArray(row) ? row.map((c) => String(c ?? "")).join(" ") : String(row ?? "");
  const inlineMatch = fullRowStr.match(INLINE_ERP_REGEX);
  if (inlineMatch) {
    const cod = cleanCode(inlineMatch[1]);
    const nome = inlineMatch[2].replace(/[;,]+$/, "").trim().toUpperCase();
    if (nome && !nome.includes("PROCESSADO POR") && !nome.includes("RELATÓRIO")) {
      return { codigo: cod, nome };
    }
  }

  if (Array.isArray(row)) {
    let codCol = -1;
    let nomeCol = -1;

    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] ?? "").trim();
      if (/^c[óo\uFFFD]digo\:?$/i.test(val)) {
        codCol = c;
      } else if (/^nome\:?$/i.test(val)) {
        nomeCol = c;
      }
    }

    if (codCol !== -1 && nomeCol !== -1) {
      let rawCodigo: any = "";
      for (let c = codCol + 1; c < nomeCol; c++) {
        const val = String(row[c] ?? "").trim();
        if (val) {
          rawCodigo = row[c];
          break;
        }
      }
      if (!rawCodigo && row[2] !== undefined && String(row[2]).trim() !== "") {
        rawCodigo = row[2];
      }

      let rawNome: any = "";
      for (let c = nomeCol + 1; c < row.length; c++) {
        const val = String(row[c] ?? "").trim();
        if (val) {
          rawNome = row[c];
          break;
        }
      }
      if (!rawNome && row[7] !== undefined && String(row[7]).trim() !== "") {
        rawNome = row[7];
      }

      const cod = cleanCode(rawCodigo);
      const nome = String(rawNome ?? "").trim().toUpperCase();
      if (nome && !nome.includes("PROCESSADO POR") && !nome.includes("RELATÓRIO") && !nome.includes("TOTAL")) {
        return { codigo: cod, nome };
      }
    }
  }

  return null;
}

/**
 * Processa a matriz de dados (linhas x colunas).
 * Suporta:
 * 1. Arquivos TXT de relatório de ERP (como forntxt.txt com 1.700+ fornecedores).
 * 2. Arquivos CSV ou XLS de relatório em blocos (com código na col C e nome na col H).
 * 3. Planilhas/CSVs tabulares convencionais com cabeçalho (Código / Razão Social).
 */
function processDataGrid(grid: any[][]): FornecedoresCsvResult {
  const seen = new Set<string>();
  const fornecedores: FornecedorParsedRow[] = [];
  let totalLidos = 0;
  let ignorados = 0;

  // 1. Tenta extrair fornecedores no formato de relatório do ERP Sumel
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (!Array.isArray(row)) continue;
    totalLidos++;

    const parsed = parseRowSupplier(row, r);
    if (parsed) {
      const dedupKey = parsed.codigo ? `cod:${parsed.codigo}` : `nome:${parsed.nome}`;
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        fornecedores.push({
          codigo_interno: parsed.codigo,
          razao_social: parsed.nome,
          nome: parsed.nome,
          linhaOriginal: r + 1,
        });
      } else {
        ignorados++;
      }
    } else {
      ignorados++;
    }
  }

  // 2. Se não encontrou registros no formato de relatório ERP, tenta formato tabular tradicional
  if (fornecedores.length === 0) {
    totalLidos = 0;
    ignorados = 0;
    seen.clear();

    let colCodigo = -1;
    let colNome = -1;
    let startRow = 1;

    for (let r = 0; r < Math.min(10, grid.length); r++) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;
      row.forEach((cell, idx) => {
        const val = String(cell ?? "").trim().toUpperCase();
        if (val === "CÓDIGO" || val === "CODIGO" || val === "CÓD." || val === "COD.") {
          colCodigo = idx;
        }
        if (val === "RAZÃO SOCIAL" || val === "RAZAO SOCIAL" || val === "NOME" || val === "FORNECEDOR") {
          colNome = idx;
        }
      });
      if (colNome !== -1) {
        startRow = r + 1;
        break;
      }
    }

    if (colNome === -1) {
      colCodigo = 0;
      colNome = 1;
      startRow = 0;
    }

    for (let r = startRow; r < grid.length; r++) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;
      totalLidos++;

      const rawCodigo = colCodigo !== -1 ? row[colCodigo] : "";
      const rawNome = row[colNome];

      const codigo = cleanCode(rawCodigo);
      const razaoSocial = String(rawNome ?? "").trim().toUpperCase();

      if (!razaoSocial || razaoSocial === "RAZÃO SOCIAL" || razaoSocial === "NOME") {
        ignorados++;
        continue;
      }

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
        linhaOriginal: r + 1,
      });
    }
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
 * Parser de texto CSV / TXT com delimitador automático.
 */
export function parseFornecedoresCsv(text: string): FornecedoresCsvResult {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("Arquivo vazio.");
  }

  const delimiter = detectDelimiter(lines);
  const grid = lines.map((line) => splitLine(line, delimiter));

  return processDataGrid(grid);
}

/**
 * Decodifica o buffer com fallback UTF-8 → windows-1252.
 */
export function decodeFile(buffer: ArrayBuffer): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    if (!text.includes("\uFFFD")) return text;
  } catch {
    // Falha de UTF-8, decodifica como windows-1252
  }
  return new TextDecoder("windows-1252").decode(buffer);
}
