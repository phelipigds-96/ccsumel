import type { ImportRow } from "@/lib/produtos";

export interface CsvParseResult {
  rows: ImportRow[];
  totalLidos: number;
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
function splitCsvLine(line: string, delimiter: string): string[] {
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

function normalize(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Aceita 1.234,56 / 1234,56 / 1234.56 / 1,234.56 */
export function parseMoney(raw: string): number {
  const v = (raw ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!v) return 0;
  const hasComma = v.includes(",");
  const hasDot = v.includes(".");
  let normalized = v;
  if (hasComma && hasDot) {
    normalized = v.lastIndexOf(",") > v.lastIndexOf(".")
      ? v.replace(/\./g, "").replace(",", ".")
      : v.replace(/,/g, "");
  } else if (hasComma) {
    normalized = v.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function isHeaderLine(cols: string[]): boolean {
  const joined = normalize(cols.join(" "));
  return (
    (joined.includes("codigo") || joined.includes("cod")) &&
    (joined.includes("descricao") || joined.includes("produto")) &&
    !/^\d+$/.test(normalize(cols[0] ?? ""))
  );
}

/**
 * CSV do catálogo:
 * A código interno | B código de barras | C descrição | D preço venda | E fornecedor | F custo
 * Campos vazios permanecem vazios.
 */
export function parseProdutosCsv(text: string): CsvParseResult {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("Arquivo CSV vazio.");
  }
  const delimiter = detectDelimiter(lines[0]);

  const rows: ImportRow[] = [];
  let ignorados = 0;
  let totalLidos = 0;

  for (let i = 0; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (i === 0 && isHeaderLine(cols)) continue;
    totalLidos++;

    const codigo = (cols[0] ?? "").replace(/\D/g, "").trim();
    const gtinRaw = (cols[1] ?? "").replace(/\D/g, "").trim();
    const descricao = (cols[2] ?? "").trim();
    const preco_venda = parseMoney(cols[3] ?? "");
    const fornecedor = (cols[4] ?? "").trim();
    const custo = parseMoney(cols[5] ?? "");

    if (!codigo || !descricao) {
      ignorados++;
      continue;
    }

    rows.push({
      codigo,
      gtin: gtinRaw || null,
      descricao,
      preco_venda,
      custo,
      fornecedor,
    });
  }

  if (rows.length === 0) {
    throw new Error(
      "Não foi possível identificar produtos no CSV. Verifique a ordem das colunas: código, código de barras, descrição, preço de venda, fornecedor, custo.",
    );
  }

  return { rows, totalLidos, ignorados };
}
