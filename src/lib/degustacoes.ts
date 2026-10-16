import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type DegustacaoStatus = Database["public"]["Enums"]["degustacao_status"];
export type Degustacao = Database["public"]["Tables"]["degustacoes"]["Row"];
export type DegustacaoInsert = Database["public"]["Tables"]["degustacoes"]["Insert"];
export type DegustacaoUpdate = Database["public"]["Tables"]["degustacoes"]["Update"];

export type DegustacaoProduto = Database["public"]["Tables"]["degustacao_produtos"]["Row"];
export type DegustacaoProdutoInsert = Database["public"]["Tables"]["degustacao_produtos"]["Insert"];
export type DegustacaoProdutoUpdate = Database["public"]["Tables"]["degustacao_produtos"]["Update"];

export type DegustacaoHistorico = Database["public"]["Tables"]["degustacoes_historico"]["Row"];

export const DEGUSTACAO_STATUS_LIST: DegustacaoStatus[] = [
  "Programada",
  "Ativa",
  "Aguardando Resultados",
  "Concluída",
  "Cancelada",
];

export const LOJAS_DEGUSTACOES = [
  "Matriz",
  "Filial Esteio",
  "Filial Sapucaia",
  "Filial São Leopoldo",
] as const;

export interface DegustacaoFilters {
  loja?: string;
  status?: DegustacaoStatus | "TODOS";
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string; // YYYY-MM-DD
  search?: string;
}

export interface DegustacaoWithProdutosCount extends Degustacao {
  produtos_count?: number;
}

/**
 * Lista as degustações com filtros opcionais de loja, status, período e busca textual.
 * Visível globalmente para todos os usuários autenticados.
 */
export async function listDegustacoes(
  filters: DegustacaoFilters = {},
): Promise<DegustacaoWithProdutosCount[]> {
  let query = supabase
    .from("degustacoes")
    .select("*, degustacao_produtos(count)")
    .order("data", { ascending: false })
    .order("horario_inicio", { ascending: true, nullsFirst: false });

  if (filters.loja && filters.loja !== "TODAS") {
    query = query.eq("loja", filters.loja);
  }

  if (filters.status && filters.status !== "TODOS") {
    query = query.eq("status", filters.status);
  }

  if (filters.dataInicio) {
    query = query.gte("data", filters.dataInicio);
  }

  if (filters.dataFim) {
    query = query.lte("data", filters.dataFim);
  }

  const s = filters.search?.trim();
  if (s) {
    // Busca flexível por nome, fornecedor ou responsável
    query = query.or(
      `nome.ilike.%${s}%,fornecedor_nome.ilike.%${s}%,responsavel_nome.ilike.%${s}%,loja.ilike.%${s}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao listar degustações:", error);
    throw error;
  }

  return (data ?? []).map((row: any) => {
    const produtosCount = Array.isArray(row.degustacao_produtos)
      ? row.degustacao_produtos[0]?.count ?? 0
      : 0;
    const { degustacao_produtos, ...rest } = row;
    return {
      ...rest,
      produtos_count: produtosCount,
    } as DegustacaoWithProdutosCount;
  });
}

/**
 * Obtém uma única degustação pelo ID.
 */
export async function getDegustacaoById(id: string): Promise<Degustacao | null> {
  const { data, error } = await supabase
    .from("degustacoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao obter degustação por ID:", error);
    throw error;
  }

  return data;
}

/**
 * Cria uma nova degustação. Restrito a administradores ativos (Master).
 */
export async function createDegustacao(payload: DegustacaoInsert): Promise<Degustacao> {
  const { data, error } = await supabase
    .from("degustacoes")
    .insert({
      ...payload,
      status: payload.status ?? "Programada",
      faturamento_total_calculado: 0,
      quantidade_total_vendida: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar degustação:", error);
    throw error;
  }

  return data;
}

/**
 * Atualiza dados de uma degustação existente.
 * Se a degustação já estiver concluída ou se for alteração estrutural, a justificativa é obrigatória.
 */
export async function updateDegustacao(
  id: string,
  patch: DegustacaoUpdate,
  justificativa?: string,
): Promise<Degustacao> {
  const updatePayload: DegustacaoUpdate = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (justificativa?.trim()) {
    updatePayload.justificativa_alteracao = justificativa.trim();
  }

  const { data, error } = await supabase
    .from("degustacoes")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar degustação:", error);
    throw error;
  }

  return data;
}

/**
 * Cancela uma degustação. Exige obrigatoriamente justificativa.
 */
export async function cancelDegustacao(
  id: string,
  justificativa: string,
): Promise<Degustacao> {
  if (!justificativa || !justificativa.trim()) {
    throw new Error("Justificativa é obrigatória para cancelar uma degustação.");
  }

  return updateDegustacao(
    id,
    {
      status: "Cancelada",
      justificativa_alteracao: justificativa.trim(),
    },
    justificativa.trim(),
  );
}

/**
 * Conclui uma degustação após a execução, validando que possui produtos associados.
 */
export async function concluirDegustacao(
  id: string,
  params: {
    observacoesResultados?: string;
    justificativa?: string;
    userName?: string;
  } = {},
): Promise<Degustacao> {
  // 1. Validar se existem produtos cadastrados
  const produtos = await listDegustacaoProdutos(id);
  if (!produtos || produtos.length === 0) {
    throw new Error(
      "Não é possível concluir uma degustação sem produtos vinculados. Adicione pelo menos um produto antes de concluir.",
    );
  }

  const patch: DegustacaoUpdate = {
    status: "Concluída",
    resultado_registrado_em: new Date().toISOString(),
    observacoes_resultados: params.observacoesResultados ?? "",
    resultado_registrado_por_nome: params.userName ?? "Usuário Master",
  };

  if (params.justificativa?.trim()) {
    patch.justificativa_alteracao = params.justificativa.trim();
  }

  return updateDegustacao(id, patch, params.justificativa);
}

/**
 * Reabre uma degustação concluída ou cancelada, exigindo justificativa.
 */
export async function reabrirDegustacao(
  id: string,
  novoStatus: "Programada" | "Ativa" | "Aguardando Resultados",
  justificativa: string,
): Promise<Degustacao> {
  if (!justificativa || !justificativa.trim()) {
    throw new Error("Justificativa é obrigatória para reabrir ou alterar o status da degustação.");
  }

  return updateDegustacao(
    id,
    {
      status: novoStatus,
      justificativa_alteracao: justificativa.trim(),
    },
    justificativa.trim(),
  );
}

/**
 * Transição de status comum (ex: Programada -> Ativa, Ativa -> Aguardando Resultados).
 */
export async function mudarStatusDegustacao(
  id: string,
  novoStatus: DegustacaoStatus,
  justificativa?: string,
): Promise<Degustacao> {
  if (novoStatus === "Cancelada") {
    if (!justificativa?.trim()) {
      throw new Error("Justificativa é obrigatória para cancelar uma degustação.");
    }
    return cancelDegustacao(id, justificativa);
  }

  if (novoStatus === "Concluída") {
    return concluirDegustacao(id, { justificativa });
  }

  return updateDegustacao(id, { status: novoStatus }, justificativa);
}

// ========================================================
// PRODUTOS DA DEGUSTAÇÃO
// ========================================================

/**
 * Lista todos os produtos vinculados a uma degustação.
 */
export async function listDegustacaoProdutos(degustacaoId: string): Promise<DegustacaoProduto[]> {
  const { data, error } = await supabase
    .from("degustacao_produtos")
    .select("*")
    .eq("degustacao_id", degustacaoId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao listar produtos da degustação:", error);
    throw error;
  }

  return data ?? [];
}

/**
 * Adiciona um produto à degustação.
 * Calcula automaticamente o faturamento_total = preco_praticado * quantidade_vendida.
 */
export async function addDegustacaoProduto(
  payload: DegustacaoProdutoInsert,
  justificativa?: string,
): Promise<DegustacaoProduto> {
  const qtd = Number(payload.quantidade_vendida) || 0;
  const preco = Number(payload.preco_praticado) || 0;
  const faturamento = Number((qtd * preco).toFixed(2));

  const insertData: DegustacaoProdutoInsert = {
    ...payload,
    quantidade_vendida: qtd,
    preco_praticado: preco,
    faturamento_total: faturamento,
    justificativa_alteracao: justificativa?.trim() || null,
  };

  const { data, error } = await supabase
    .from("degustacao_produtos")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Erro ao adicionar produto à degustação:", error);
    throw error;
  }

  return data;
}

/**
 * Atualiza um produto da degustação (preço praticado, quantidade vendida, observações).
 */
export async function updateDegustacaoProduto(
  id: string,
  patch: DegustacaoProdutoUpdate,
  justificativa?: string,
): Promise<DegustacaoProduto> {
  const updateData: DegustacaoProdutoUpdate = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (patch.preco_praticado !== undefined || patch.quantidade_vendida !== undefined) {
    const qtd = Number(patch.quantidade_vendida) || 0;
    const preco = Number(patch.preco_praticado) || 0;
    updateData.faturamento_total = Number((qtd * preco).toFixed(2));
  }

  if (justificativa?.trim()) {
    updateData.justificativa_alteracao = justificativa.trim();
  }

  const { data, error } = await supabase
    .from("degustacao_produtos")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar produto da degustação:", error);
    throw error;
  }

  return data;
}

/**
 * Remove um produto da degustação.
 */
export async function deleteDegustacaoProduto(
  id: string,
  degustacaoId: string,
  justificativa?: string,
): Promise<void> {
  if (justificativa?.trim()) {
    // Registra a justificativa no registro antes do delete para que a trigger capture no OLD
    await supabase
      .from("degustacao_produtos")
      .update({ justificativa_alteracao: justificativa.trim() })
      .eq("id", id);
  }

  const { error } = await supabase.from("degustacao_produtos").delete().eq("id", id);
  if (error) {
    console.error("Erro ao remover produto da degustação:", error);
    throw error;
  }
}

// ========================================================
// HISTÓRICO DE AUDITORIA
// ========================================================

/**
 * Lista o histórico de auditoria de uma degustação (ou original se já foi recriada).
 */
export async function listDegustacaoHistorico(
  degustacaoId: string,
): Promise<DegustacaoHistorico[]> {
  const { data, error } = await supabase
    .from("degustacoes_historico")
    .select("*")
    .or(`degustacao_id.eq.${degustacaoId},degustacao_id_original.eq.${degustacaoId}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar histórico de degustação:", error);
    throw error;
  }

  return data ?? [];
}
