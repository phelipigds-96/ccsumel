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

export async function listFornecedores(
  search = "",
  page = 1,
  pageSize = 10,
): Promise<{ rows: FornecedorComContagem[]; total: number }> {
  let q = supabase
    .from("fornecedores")
    .select("*", { count: "exact" })
    .order("nome", { ascending: true });
  const s = search.trim();
  if (s) q = q.ilike("nome", `%${s}%`);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  const fornecedores = (data ?? []) as Fornecedor[];

  // Uma única consulta que busca todos os fornecedores dos produtos,
  // conta no código e aplica aos fornecedores da página atual.
  const contagens = new Map<string, number>();
  const { data: prodRows } = await supabase
    .from("produtos")
    .select("fornecedor");
  for (const row of prodRows ?? []) {
    const k = (row.fornecedor ?? "").toUpperCase();
    if (k) contagens.set(k, (contagens.get(k) ?? 0) + 1);
  }

  return {
    rows: fornecedores.map((f) => ({
      ...f,
      produtos: contagens.get(f.nome.toUpperCase()) ?? 0,
    })),
    total: count ?? 0,
  };
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
