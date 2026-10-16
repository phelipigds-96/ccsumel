/**
 * Upsert em lote de fornecedores com suporte a código interno e razão social.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FornecedorBatchResult {
  novos: number;
  existentes: number;
  erros: number;
  duracao_ms: number;
}

export interface FornecedorBatchRow {
  codigo_interno?: string;
  razao_social?: string;
  nome: string;
}

/**
 * Realiza upsert de fornecedores em lote com suporte a codigo_interno e razao_social.
 * - Localiza fornecedores existentes por codigo_interno ou razao_social/nome.
 * - Atualiza os existentes preservando o ID (não quebra vínculos de degustações/produtos).
 * - Insere novos fornecedores.
 */
export async function upsertFornecedoresBatch(
  rows: FornecedorBatchRow[],
): Promise<FornecedorBatchResult> {
  const start = Date.now();
  let novos = 0;
  let existentes = 0;
  let erros = 0;

  // Normaliza linhas
  const normalizados = rows.map((r) => {
    const razao = (r.razao_social || r.nome || "").trim().toUpperCase();
    const codigo = (r.codigo_interno ?? "").trim();
    return {
      codigo_interno: codigo,
      razao_social: razao,
      nome: razao || codigo,
      ativo: true,
      observacoes: "",
    };
  }).filter((r) => r.razao_social.length > 0 || r.codigo_interno.length > 0);

  const CHUNK = 500;
  for (let i = 0; i < normalizados.length; i += CHUNK) {
    const chunk = normalizados.slice(i, i + CHUNK);
    const codigos = chunk.map((r) => r.codigo_interno).filter((c) => c.length > 0);
    const nomes = chunk.map((r) => r.nome);

    // Consulta fornecedores existentes no banco para correlacionar IDs
    const existingById = new Map<string, string>(); // code or name -> id

    try {
      // 1. Busca por código interno se houver
      if (codigos.length > 0) {
        const { data: dbByCode } = await supabase
          .from("fornecedores")
          .select("id, codigo_interno, nome, razao_social")
          .in("codigo_interno", codigos);

        for (const row of dbByCode ?? []) {
          if (row.codigo_interno) {
            existingById.set(`cod:${row.codigo_interno.trim()}`, row.id);
          }
          if (row.nome) {
            existingById.set(`name:${row.nome.trim().toUpperCase()}`, row.id);
          }
        }
      }

      // 2. Busca por nome para os demais
      if (nomes.length > 0) {
        const { data: dbByName } = await supabase
          .from("fornecedores")
          .select("id, nome, codigo_interno, razao_social")
          .in("nome", nomes);

        for (const row of dbByName ?? []) {
          if (row.nome) {
            existingById.set(`name:${row.nome.trim().toUpperCase()}`, row.id);
          }
        }
      }
    } catch (e) {
      console.warn("Aviso ao buscar fornecedores existentes:", e);
    }

    // Monta payload final com IDs para os existentes
    const payloadParaEnvio = chunk.map((item) => {
      const existingId =
        (item.codigo_interno && existingById.get(`cod:${item.codigo_interno}`)) ||
        existingById.get(`name:${item.nome.toUpperCase()}`);

      if (existingId) {
        existentes++;
        return {
          id: existingId,
          codigo_interno: item.codigo_interno,
          razao_social: item.razao_social,
          nome: item.nome,
          ativo: item.ativo,
        };
      } else {
        novos++;
        return {
          codigo_interno: item.codigo_interno,
          razao_social: item.razao_social,
          nome: item.nome,
          ativo: item.ativo,
        };
      }
    });

    // Executa upsert em lote
    const { error: batchError } = await supabase
      .from("fornecedores")
      .upsert(payloadParaEnvio as any, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

    if (batchError) {
      console.warn("Falha no upsert em lote de fornecedores, tentando item a item:", batchError);
      // Fallback um a um
      for (const item of payloadParaEnvio) {
        try {
          const { error: singleError } = await supabase
            .from("fornecedores")
            .upsert(item as any, { onConflict: (item as any).id ? "id" : "nome" });

          if (singleError) throw singleError;
        } catch {
          erros++;
        }
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
