import { supabase } from "@/integrations/supabase/client";

export interface Fornecedor {
  id: string;
  nome: string;
  observacoes: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FornecedorComContagem extends Fornecedor {
  produtos: number;
}

export async function listFornecedores(search = ""): Promise<FornecedorComContagem[]> {
  let q = supabase.from("fornecedores").select("*").order("nome", { ascending: true });
  const s = search.trim();
  if (s) q = q.ilike("nome", `%${s}%`);
  const { data, error } = await q;
  if (error) throw error;
  const fornecedores = (data ?? []) as Fornecedor[];

  const contagens = await Promise.all(
    fornecedores.map(async (f) => {
      const { count } = await supabase
        .from("produtos")
        .select("*", { count: "exact", head: true })
        .eq("fornecedor", f.nome);
      return count ?? 0;
    }),
  );

  return fornecedores.map((f, i) => ({ ...f, produtos: contagens[i] }));
}

export async function upsertFornecedor(input: {
  id?: string;
  nome: string;
  observacoes?: string;
  ativo?: boolean;
}) {
  const payload = {
    nome: input.nome.trim(),
    observacoes: input.observacoes ?? "",
    ativo: input.ativo ?? true,
  };
  if (input.id) {
    const { error } = await supabase.from("fornecedores").update(payload).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("fornecedores")
      .upsert(payload, { onConflict: "nome", ignoreDuplicates: false });
    if (error) throw error;
  }
}

export async function deleteFornecedor(id: string) {
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);
  if (error) throw error;
}

/** Garante que todos os nomes existam na tabela fornecedores. Retorna quantos foram criados. */
export async function syncFornecedores(nomes: string[]): Promise<number> {
  const unicos = Array.from(
    new Map(
      nomes
        .map((n) => (n ?? "").trim())
        .filter(Boolean)
        .map((n) => [n.toLowerCase(), n]),
    ).values(),
  );
  if (unicos.length === 0) return 0;

  const existentes = new Set<string>();
  for (let i = 0; i < unicos.length; i += 500) {
    const slice = unicos.slice(i, i + 500);
    const { data, error } = await supabase.from("fornecedores").select("nome").in("nome", slice);
    if (error) throw error;
    for (const row of data ?? []) existentes.add(row.nome.toLowerCase());
  }

  const novos = unicos.filter((n) => !existentes.has(n.toLowerCase()));
  for (let i = 0; i < novos.length; i += 500) {
    const chunk = novos.slice(i, i + 500).map((nome) => ({ nome }));
    const { error } = await supabase
      .from("fornecedores")
      .upsert(chunk, { onConflict: "nome", ignoreDuplicates: true });
    if (error) throw error;
  }
  return novos.length;
}
