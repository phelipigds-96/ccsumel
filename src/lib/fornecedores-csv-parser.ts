import type { Fornecedor } from "@/lib/fornecedores";

export interface FornecedorCsvRow {
  nome: string;
  linhaOriginal: number;
}

export interface FornecedoresCsvResult {
  fornecedores: FornecedorCsvRow[];
  totalLidos: number;
  validos: number;
  ignorados: number;
}

const CNPJ_REGEX = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
const CPF_REGEX = /\d{3}\.\d{3}\.\d{3}-\d{2}/;
const DOC_REGEX = /\d{3}\.\d{3}\.\d{3}[-\/]\d{2}/;

function hasDocument(cols: string[]): boolean {
  return cols.some((c) => DOC_REGEX.test(c.trim()));
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
 * Parser de relatório de fornecedores exportado do ERP.
 *
 * O arquivo contém blocos repetidos de cabeçalho/rodapé a cada ~90 linhas
 * com título, data, cabeçalho de coluna e "Processado por: ...".
 *
 * A estratégia de validação é: qualquer linha que contenha um trecho
 * com formato de CNPJ (99.999.999/9999-99) ou CPF (999.999.999-99)
 * em qualquer coluna é considerada uma linha de dados válida.
 *
 * O nome do fornecedor é a primeira coluna não vazia da linha.
 */
export function parseFornecedoresCsv(text: string): FornecedoresCsvResult {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("Arquivo CSV vazio.");
  }

  const delimiter = detectDelimiter(lines[0]);

  const seen = new Map<string, number>(); // nome lowercase → índice
  const fornecedores: FornecedorCsvRow[] = [];
  let totalLidos = 0;
  let ignorados = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    totalLidos++;
    const cols = splitLine(rawLine, delimiter);

    // Linha válida apenas se tiver conteúdo que pareça CNPJ ou CPF em alguma coluna
    if (!hasDocument(cols)) {
      ignorados++;
      continue;
    }

    // Primeira coluna não vazia = nome do fornecedor
    const nome = cols.find((c) => c.trim().length > 0)?.trim() ?? "";
    if (!nome) {
      ignorados++;
      continue;
    }

    const nomeLower = nome.toLowerCase();
    if (seen.has(nomeLower)) {
      // duplicado — ignora, mantendo a primeira ocorrência
      ignorados++;
      continue;
    }

    seen.set(nomeLower, fornecedores.length);
    fornecedores.push({ nome: nome.toUpperCase(), linhaOriginal: i + 1 });
  }

  if (fornecedores.length === 0) {
    throw new Error(
      "Nenhum fornecedor válido encontrado. O arquivo precisa conter linhas com CNPJ (99.999.999/9999-99) ou CPF (999.999.999-99).",
    );
  }

  return {
    fornecedores,
    totalLidos,
    validos: fornecedores.length,
    ignorados,
  };
}

/**
 * Decodifica o buffer com fallback UTF-8 → windows-1252.
 * Replica a estratégia usada em produtos-csv-parser.
 */
export function decodeFile(buffer: ArrayBuffer): string {
  let text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (text.includes("\uFFFD")) {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text;
}
