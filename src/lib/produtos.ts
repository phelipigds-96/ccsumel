import { supabase } from "@/integrations/supabase/client";

export interface Produto {
  id: string;
  gtin: string | null;
  codigo: string | null;
  descricao: string;
  preco_venda: number;
  created_at?: string;
  updated_at?: string;
}

export async function listProdutos(search = ""): Promise<Produto[]> {
  let q = supabase.from("produtos").select("*").order("descricao", { ascending: true });
  const s = search.trim();
  if (s) q = q.or(`descricao.ilike.%${s}%,gtin.ilike.%${s}%,codigo.ilike.%${s}%`);
  const { data, error } = await q.limit(500);
  if (error) throw error;
  return (data ?? []) as Produto[];
}

export async function findByGtin(gtin: string): Promise<Produto | null> {
  const g = gtin.trim();
  if (!g) return null;
  const { data, error } = await supabase.from("produtos").select("*").eq("gtin", g).maybeSingle();
  if (error) throw error;
  return (data as Produto | null) ?? null;
}

export async function upsertProdutos(
  rows: Array<Omit<Produto, "id" | "created_at" | "updated_at">>,
  opts: { chunkSize?: number; onProgress?: (done: number, total: number) => void } = {},
) {
  if (rows.length === 0) return { inserted: 0 };
  const chunkSize = opts.chunkSize ?? 1000;

  // Dedup GTINs within payload (keep last) to avoid
  // "ON CONFLICT DO UPDATE affects row a second time" errors.
  const seen = new Map<string, typeof rows[number]>();
  const withoutGtin: typeof rows = [];
  for (const r of rows) {
    if (r.gtin) seen.set(r.gtin, r);
    else withoutGtin.push(r);
  }
  const withGtin = Array.from(seen.values());

  const total = withGtin.length + withoutGtin.length;
  let done = 0;
  let count = 0;

  const runChunks = async (
    list: typeof rows,
    fn: (chunk: typeof rows) => Promise<number>,
  ) => {
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      count += await fn(chunk);
      done += chunk.length;
      opts.onProgress?.(done, total);
    }
  };

  await runChunks(withGtin, async (chunk) => {
    const { error, count: c } = await supabase
      .from("produtos")
      .upsert(chunk, { onConflict: "gtin", count: "exact", ignoreDuplicates: false });
    if (error) throw error;
    return c ?? chunk.length;
  });

  await runChunks(withoutGtin, async (chunk) => {
    const { error, count: c } = await supabase
      .from("produtos")
      .insert(chunk, { count: "exact" });
    if (error) throw error;
    return c ?? chunk.length;
  });

  return { inserted: count };
}

export async function deleteProduto(id: string) {
  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllProdutos() {
  const { error } = await supabase.from("produtos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
}
