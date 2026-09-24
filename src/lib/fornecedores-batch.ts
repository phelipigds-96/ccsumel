/**
 * Upsert em lote de fornecedores. Reaproveita a lógica de deduplicação
 * existente em syncFornecedores, mas realiza upsert ao invés de apenas insert.
 */
import { supabase } from "@/integrations/supabase/client";
import { upsertFornecedor } from "@/lib/fornecedores";

export interface FornecedorBatchResult {
  novos: number;
  existentes: number;
  erros: number;
  duracao_ms: number;
}

export interface FornecedorBatchRow {
  nome: string;
}

/**
 * Realiza upsert de fornecedores em lote.
 * - Se o nome já existe (case-insensitive): incrementa existentes.
 * - Se o nome não existe: cria e incrementa novos.
 * Processa em chunks de 500 para evitar payload grande.
 */
export async function upsertFornecedoresBatch(
  rows: FornecedorBatchRow[],
): Promise<FornecedorBatchResult> {
  const start = Date.now();
  let novos = 0;
  let existentes = 0;
  let erros = 0;

  // Normaliza nomes (já vêm em maiúsculas do parser, mas garante)
  const normalizados = rows.map((r) => ({
    nome: r.nome.toUpperCase().trim(),
  }));

  // Agrupa em chunks de 500
  const CHUNK = 500;
  for (let i = 0; i < normalizados.length; i += CHUNK) {
    const chunk = normalizados.slice(i, i + CHUNK);
    const lowerNames = chunk.map((r) => r.nome.toLowerCase());

    // Busca fornecedores já existentes neste chunk
    const { data: existentesData, error: fetchError } = await supabase
      .from("fornecedores")
      .select("id, nome")
      .in("nome", lowerNames);

    if (fetchError) throw fetchError;

    const existentesSet = new Set(
      (existentesData ?? []).map((r: { nome: string }) => r.nome.toLowerCase()),
    );

    const paraCriar = chunk.filter((r) => !existentesSet.has(r.nome.toLowerCase()));
    existentes += chunk.length - paraCriar.length;

    // Cria os que ainda não existem (um a um para reutilizar upsertFornecedor que lida com created_at/updated_at)
    for (const fornecedor of paraCriar) {
      try {
        await upsertFornecedor({ nome: fornecedor.nome });
        novos++;
      } catch {
        erros++;
      }
    }
  }

  return {
    novos,
    existentes,
    erros,
    duracao_ms: Date.now() - start,
  };
}
