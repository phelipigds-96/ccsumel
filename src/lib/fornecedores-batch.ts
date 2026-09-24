/**
 * Upsert em lote de fornecedores. Reaproveita a lógica de deduplicação
 * existente em syncFornecedores, mas realiza upsert ao invés de apenas insert.
 */
import { supabase } from "@/integrations/supabase/client";

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
 *
 * Usa comparação normalizada para maiúsculas (padrão do banco)
 * e bulk upsert em vez de chamadas sequenciais por registro.
 */
export async function upsertFornecedoresBatch(
  rows: FornecedorBatchRow[],
): Promise<FornecedorBatchResult> {
  const start = Date.now();
  let novos = 0;
  let existentes = 0;
  let erros = 0;

  // Normaliza nomes para maiúsculas (padrão do banco)
  const normalizados = rows.map((r) => ({
    nome: r.nome.toUpperCase().trim(),
  }));

  // Chunk de 500 para batch
  const CHUNK = 500;
  for (let i = 0; i < normalizados.length; i += CHUNK) {
    const chunk = normalizados.slice(i, i + CHUNK);
    const nomesUpper = chunk.map((r) => r.nome);

    // Busca fornecedores existentes neste chunk — compara em maiúsculas
    const { data: dbRows, error: fetchError } = await supabase
      .from("fornecedores")
      .select("id, nome")
      .in(
        "nome",
        nomesUpper.map((n) => n.toLowerCase()),
      );

    if (fetchError) throw fetchError;

    // Normaliza nomes do banco para maiúsculas para comparar corretamente
    const existentesSet = new Set(
      (dbRows ?? []).map((r: { nome: string }) => r.nome.toUpperCase()),
    );

    const paraCriar = chunk.filter((r) => !existentesSet.has(r.nome));
    existentes += chunk.length - paraCriar.length;

    // Upsert em lote — uma chamada por chunk em vez de uma por fornecedor
    if (paraCriar.length > 0) {
      const { error: upsertError } = await supabase
        .from("fornecedores")
        .upsert(
          paraCriar.map((f) => ({ nome: f.nome })),
          { onConflict: "nome", ignoreDuplicates: false },
        );

      if (upsertError) {
        // Tenta um a um para contar exatamente quais falharam
        for (const fornecedor of paraCriar) {
          try {
            const { error: singleError } = await supabase
              .from("fornecedores")
              .upsert({ nome: fornecedor.nome }, { onConflict: "nome" });
            if (singleError) throw singleError;
            novos++;
          } catch {
            erros++;
          }
        }
      } else {
        novos += paraCriar.length;
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
