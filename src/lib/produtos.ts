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

export async function upsertProdutos(rows: Array<Omit<Produto, "id" | "created_at" | "updated_at">>) {
  if (rows.length === 0) return { inserted: 0 };
  // Upsert by gtin
  const withGtin = rows.filter(r => r.gtin);
  const withoutGtin = rows.filter(r => !r.gtin);
  let count = 0;
  if (withGtin.length) {
    const { error, count: c } = await supabase.from("produtos").upsert(withGtin, { onConflict: "gtin", count: "exact" });
    if (error) throw error;
    count += c ?? withGtin.length;
  }
  if (withoutGtin.length) {
    const { error, count: c } = await supabase.from("produtos").insert(withoutGtin, { count: "exact" });
    if (error) throw error;
    count += c ?? withoutGtin.length;
  }
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
