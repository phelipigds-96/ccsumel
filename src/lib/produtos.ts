import { supabase } from "@/integrations/supabase/client";

export interface Produto {
  id: string;
  gtin: string | null;
  codigo: string | null;
  descricao: string;
  preco_venda: number;
  custo: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ImportacaoHistorico {
  id: string;
  usuario: string | null;
  arquivo: string | null;
  processados: number;
  novos: number;
  atualizados: number;
  sem_barras: number;
  erros: number;
  duracao_ms: number;
  created_at: string;
}

export async function listProdutos(search = ""): Promise<Produto[]> {
  let q = supabase.from("produtos").select("*").order("descricao", { ascending: true });
  const s = search.trim();
  if (s) q = q.or(`descricao.ilike.%${s}%,gtin.ilike.%${s}%,codigo.ilike.%${s}%`);
  const { data, error } = await q.limit(1000);
  if (error) throw error;
  return (data ?? []) as Produto[];
}

export async function countProdutos(): Promise<{ total: number; ativos: number }> {
  const [{ count: total }, { count: ativos }] = await Promise.all([
    supabase.from("produtos").select("*", { count: "exact", head: true }),
    supabase.from("produtos").select("*", { count: "exact", head: true }).eq("ativo", true),
  ]);
  return { total: total ?? 0, ativos: ativos ?? 0 };
}

export async function findByGtin(gtin: string): Promise<Produto | null> {
  const g = gtin.trim();
  if (!g) return null;
  const { data, error } = await supabase.from("produtos").select("*").eq("gtin", g).maybeSingle();
  if (error) throw error;
  return (data as Produto | null) ?? null;
}

export async function deleteProduto(id: string) {
  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) throw error;
}

export interface ImportRow {
  codigo: string;
  gtin: string | null;
  descricao: string;
  preco_venda: number;
  custo: number;
}

export interface ImportResult {
  processados: number;
  novos: number;
  atualizados: number;
  sem_barras: number;
  erros: number;
  duracao_ms: number;
}

/**
 * Upsert produtos usando "codigo" como chave. Se existir, atualiza gtin, descricao, preco_venda, custo.
 * Se não existir, cria novo.
 */
export async function importProdutosByCodigo(
  rows: ImportRow[],
  opts: { chunkSize?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<ImportResult> {
  const started = Date.now();
  const chunkSize = opts.chunkSize ?? 500;

  // Dedup por código (mantém último)
  const seen = new Map<string, ImportRow>();
  for (const r of rows) if (r.codigo) seen.set(r.codigo, r);
  const list = Array.from(seen.values());

  const codigos = list.map((r) => r.codigo);
  // Buscar existentes em lotes
  const existentes = new Set<string>();
  for (let i = 0; i < codigos.length; i += 1000) {
    const slice = codigos.slice(i, i + 1000);
    const { data, error } = await supabase.from("produtos").select("codigo").in("codigo", slice);
    if (error) throw error;
    for (const row of data ?? []) if (row.codigo) existentes.add(row.codigo);
  }

  let novos = 0;
  let atualizados = 0;
  let erros = 0;
  let done = 0;
  const total = list.length;

  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("produtos")
      .upsert(chunk, { onConflict: "codigo", ignoreDuplicates: false });
    if (error) {
      erros += chunk.length;
    } else {
      for (const r of chunk) {
        if (existentes.has(r.codigo)) atualizados++;
        else novos++;
      }
    }
    done += chunk.length;
    opts.onProgress?.(done, total);
  }

  const sem_barras = list.filter((r) => !r.gtin).length;

  return {
    processados: total,
    novos,
    atualizados,
    sem_barras,
    erros,
    duracao_ms: Date.now() - started,
  };
}

export async function saveImportHistorico(
  result: ImportResult,
  meta: { usuario?: string | null; arquivo?: string | null },
) {
  const { error } = await supabase.from("produto_importacoes").insert({
    usuario: meta.usuario ?? null,
    arquivo: meta.arquivo ?? null,
    processados: result.processados,
    novos: result.novos,
    atualizados: result.atualizados,
    sem_barras: result.sem_barras,
    erros: result.erros,
    duracao_ms: result.duracao_ms,
  });
  if (error) throw error;
}

export async function getLastImport(): Promise<ImportacaoHistorico | null> {
  const { data, error } = await supabase
    .from("produto_importacoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ImportacaoHistorico | null) ?? null;
}
