/**
 * Upsert em lote de fornecedores com suporte a código interno e razão social.
 * Otimizado para alta performance com monitoramento de progresso em tempo real.
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

export interface FornecedorBatchProgress {
  processados: number;
  total: number;
  etapa: string;
  percentual: number;
}

/**
 * Realiza upsert de fornecedores em lote com suporte a codigo_interno e razao_social.
 * - Localiza fornecedores existentes em uma única consulta rápida inicial (sem gerar URLs gigantes).
 * - Preserva IDs existentes para manter integridade referencial com degustações e produtos.
 * - Envia blocos otimizados via PostgREST garantindo alta velocidade e atualizando a barra de progresso.
 */
export async function upsertFornecedoresBatch(
  rows: FornecedorBatchRow[],
  onProgress?: (progress: FornecedorBatchProgress) => void,
): Promise<FornecedorBatchResult> {
  const start = Date.now();
  let novos = 0;
  let existentes = 0;
  let erros = 0;

  // 1. Normaliza linhas
  onProgress?.({
    processados: 0,
    total: rows.length,
    etapa: "Preparando registros...",
    percentual: 0,
  });

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

  const totalRegistros = normalizados.length;
  if (totalRegistros === 0) {
    return { novos: 0, existentes: 0, erros: 0, duracao_ms: Date.now() - start };
  }

  // 2. Consulta rápida de fornecedores existentes no banco (1 única requisição direta)
  onProgress?.({
    processados: 0,
    total: totalRegistros,
    etapa: "Verificando base de dados existente...",
    percentual: 5,
  });

  const existingByCode = new Map<string, string>();
  const existingByName = new Map<string, string>();

  try {
    const { data: dbExisting, error: fetchErr } = await supabase
      .from("fornecedores")
      .select("id, codigo_interno, nome, razao_social");

    if (!fetchErr && dbExisting) {
      for (const row of dbExisting) {
        if (row.codigo_interno && row.codigo_interno.trim()) {
          existingByCode.set(row.codigo_interno.trim(), row.id);
        }
        if (row.nome && row.nome.trim()) {
          existingByName.set(row.nome.trim().toUpperCase(), row.id);
        }
        if (row.razao_social && row.razao_social.trim()) {
          existingByName.set(row.razao_social.trim().toUpperCase(), row.id);
        }
      }
    }
  } catch (e) {
    console.warn("Aviso ao buscar fornecedores existentes:", e);
  }

  // 3. Monta o payload unificado:
  // - Para fornecedores que já existem no banco, mantém o ID original (preserva FKs).
  // - Para novos fornecedores, gera um novo UUID único.
  const payloadCompleto = normalizados.map((item) => {
    const existingId =
      (item.codigo_interno && existingByCode.get(item.codigo_interno)) ||
      existingByName.get(item.razao_social) ||
      existingByName.get(item.nome);

    if (existingId) {
      existentes++;
      return {
        id: existingId,
        codigo_interno: item.codigo_interno,
        razao_social: item.razao_social,
        nome: item.nome,
        ativo: item.ativo,
        observacoes: item.observacoes,
      };
    } else {
      novos++;
      const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
      // Registra nos maps para evitar duplicidade dentro do próprio lote
      if (item.codigo_interno) existingByCode.set(item.codigo_interno, newId);
      existingByName.set(item.razao_social, newId);
      existingByName.set(item.nome, newId);

      return {
        id: newId,
        codigo_interno: item.codigo_interno,
        razao_social: item.razao_social,
        nome: item.nome,
        ativo: item.ativo,
        observacoes: item.observacoes,
      };
    }
  });

  // 4. Executa upsert em lotes otimizados de 200 itens
  const CHUNK_SIZE = 200;
  let processados = 0;
  const totalChunks = Math.ceil(payloadCompleto.length / CHUNK_SIZE);

  for (let i = 0; i < payloadCompleto.length; i += CHUNK_SIZE) {
    const chunk = payloadCompleto.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const pct = Math.round(10 + (processados / totalRegistros) * 85);

    onProgress?.({
      processados,
      total: totalRegistros,
      etapa: `Gravando lote ${chunkNum} de ${totalChunks}...`,
      percentual: pct,
    });

    const { error: upsertErr } = await supabase
      .from("fornecedores")
      .upsert(chunk as any, { onConflict: "id" });

    if (upsertErr) {
      console.warn(`Aviso no lote ${chunkNum}, processando em sub-lotes menores:`, upsertErr);
      const SUB_SIZE = 25;
      for (let s = 0; s < chunk.length; s += SUB_SIZE) {
        const sub = chunk.slice(s, s + SUB_SIZE);
        const { error: subErr } = await supabase
          .from("fornecedores")
          .upsert(sub as any, { onConflict: "id" });
        if (subErr) {
          erros += sub.length;
          console.error("Erro no sub-lote:", subErr);
        }
      }
    }

    processados += chunk.length;
    const finalPct = Math.round(10 + (Math.min(processados, totalRegistros) / totalRegistros) * 85);
    onProgress?.({
      processados: Math.min(processados, totalRegistros),
      total: totalRegistros,
      etapa: `Processados ${Math.min(processados, totalRegistros)} de ${totalRegistros}`,
      percentual: finalPct,
    });
  }

  onProgress?.({
    processados: totalRegistros,
    total: totalRegistros,
    etapa: "Finalizando importação...",
    percentual: 100,
  });

  return {
    novos,
    existentes,
    erros,
    duracao_ms: Date.now() - start,
  };
}
