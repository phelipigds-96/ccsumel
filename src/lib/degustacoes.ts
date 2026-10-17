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

  // Se houver justificativa (ex: alteração pós-conclusão), registrar na auditoria
  if (justificativa?.trim()) {
    try {
      const { data: degustacao } = await supabase
        .from("degustacoes")
        .select("status, nome")
        .eq("id", payload.degustacao_id)
        .single();

      await supabase.from("degustacoes_historico").insert({
        degustacao_id: payload.degustacao_id,
        degustacao_nome: degustacao?.nome || "Degustação",
        produto_id: data.produto_id,
        produto_descricao: data.descricao,
        status_anterior: degustacao?.status || "Concluída",
        status_novo: degustacao?.status || "Concluída",
        acao: "Inclusão de Produto",
        justificativa: justificativa.trim(),
        observacao: `Produto adicionado: ${data.descricao}`,
        changed_by_name: "Master",
      });
    } catch (e) {
      console.warn("Auditoria de justificativa manual:", e);
    }
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

  if (justificativa?.trim() && data) {
    try {
      const { data: degustacao } = await supabase
        .from("degustacoes")
        .select("status, nome")
        .eq("id", data.degustacao_id)
        .single();

      await supabase.from("degustacoes_historico").insert({
        degustacao_id: data.degustacao_id,
        degustacao_nome: degustacao?.nome || "Degustação",
        produto_id: data.produto_id,
        produto_descricao: data.descricao,
        status_anterior: degustacao?.status || "Concluída",
        status_novo: degustacao?.status || "Concluída",
        acao: "Ajuste de Vendas do Item",
        justificativa: justificativa.trim(),
        observacao: `Produto alterado: ${data.descricao}`,
        changed_by_name: "Master",
      });
    } catch (e) {
      console.warn("Auditoria de justificativa manual:", e);
    }
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
  let produtoDesc = "";
  let produtoId: string | null = null;
  if (justificativa?.trim()) {
    try {
      const { data: prod } = await supabase
        .from("degustacao_produtos")
        .select("descricao, produto_id")
        .eq("id", id)
        .single();
      if (prod) {
        produtoDesc = prod.descricao;
        produtoId = prod.produto_id;
      }
    } catch (e) {
      // Ignora erro de busca prévia
    }
  }

  const { error } = await supabase.from("degustacao_produtos").delete().eq("id", id);
  if (error) {
    console.error("Erro ao remover produto da degustação:", error);
    throw error;
  }

  if (justificativa?.trim()) {
    try {
      const { data: degustacao } = await supabase
        .from("degustacoes")
        .select("status, nome")
        .eq("id", degustacaoId)
        .single();

      await supabase.from("degustacoes_historico").insert({
        degustacao_id: degustacaoId,
        degustacao_nome: degustacao?.nome || "Degustação",
        produto_id: produtoId,
        produto_descricao: produtoDesc,
        status_anterior: degustacao?.status || "Concluída",
        status_novo: degustacao?.status || "Concluída",
        acao: "Remoção de Produto",
        justificativa: justificativa.trim(),
        observacao: `Produto removido: ${produtoDesc}`,
        changed_by_name: "Master",
      });
    } catch (e) {
      console.warn("Auditoria de justificativa manual:", e);
    }
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

// ========================================================
// MATERIAIS DE APOIO, IMPRESSÃO E DECORAÇÃO (ANEXOS)
// ========================================================

export interface AnexoDegustacao {
  id?: string;
  path: string;
  nome: string;
  tipo: string;
  tamanho: number;
  bucket?: string;
  criado_em?: string;
}

export const DEGUSTACOES_STORAGE_BUCKET = "campanha-materiais";
export const DEGUSTACOES_FALLBACK_BUCKET = "degustacao-materiais";
export const DEGUSTACOES_FILE_ACCEPT = "image/jpeg,image/jpg,image/png,application/pdf";
export const DEGUSTACOES_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export function isDegustacaoImage(tipo: string): boolean {
  return tipo.startsWith("image/");
}

export function parseDegustacaoAnexos(
  degustacao: { anexos?: unknown } | null | undefined,
): AnexoDegustacao[] {
  if (!degustacao?.anexos) return [];
  if (Array.isArray(degustacao.anexos)) {
    return degustacao.anexos as AnexoDegustacao[];
  }
  return [];
}

/**
 * Faz o upload de um arquivo de material de degustação (PDF, JPG, PNG).
 * Salva no bucket de materiais sob a pasta organizada 'degustacoes/{degustacaoId}/...'.
 */
export async function uploadDegustacaoArquivo(
  degustacaoId: string,
  file: File,
): Promise<AnexoDegustacao> {
  if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
    throw new Error(`Formato não suportado para "${file.name}". Utilize PDF, JPG ou PNG.`);
  }

  if (file.size > DEGUSTACOES_MAX_FILE_SIZE) {
    throw new Error(`O arquivo "${file.name}" excede o tamanho máximo permitido de 20 MB.`);
  }

  const ext = file.name.split(".").pop() || "bin";
  const path = `degustacoes/${degustacaoId}/${crypto.randomUUID()}.${ext}`;

  // Salva no bucket de materiais configurado na aplicação
  let bucketUsed = DEGUSTACOES_STORAGE_BUCKET;
  let { error } = await supabase.storage.from(bucketUsed).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  // Fallback caso seja utilizado o bucket dedicado
  if (error && (error.message?.toLowerCase().includes("bucket") || (error as any).statusCode === 404)) {
    bucketUsed = DEGUSTACOES_FALLBACK_BUCKET;
    const fallbackPath = `${degustacaoId}/${crypto.randomUUID()}.${ext}`;
    const fallbackUpload = await supabase.storage.from(bucketUsed).upload(fallbackPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (fallbackUpload.error) {
      throw fallbackUpload.error;
    }
    return {
      path: fallbackPath,
      nome: file.name,
      tipo: file.type,
      tamanho: file.size,
      bucket: bucketUsed,
      criado_em: new Date().toISOString(),
    };
  }

  if (error) {
    throw error;
  }

  return {
    path,
    nome: file.name,
    tipo: file.type,
    tamanho: file.size,
    bucket: bucketUsed,
    criado_em: new Date().toISOString(),
  };
}

/**
 * Remove um anexo do Supabase Storage.
 */
export async function removeDegustacaoArquivo(anexo: AnexoDegustacao): Promise<void> {
  const bucket = anexo.bucket || DEGUSTACOES_STORAGE_BUCKET;
  const { error } = await supabase.storage.from(bucket).remove([anexo.path]);
  if (error) {
    // Tenta fallback caso tenha sido armazenado no outro bucket
    await supabase.storage.from(DEGUSTACOES_FALLBACK_BUCKET).remove([anexo.path]);
  }
}

/**
 * Gera URL para visualização/download de um anexo de degustação.
 */
export async function getDegustacaoArquivoUrl(anexo: AnexoDegustacao): Promise<string> {
  const bucket = anexo.bucket || DEGUSTACOES_STORAGE_BUCKET;

  // Tenta URL assinada
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(anexo.path, 3600);
  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  // Fallback para URL pública
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(anexo.path);
  if (publicData?.publicUrl) {
    return publicData.publicUrl;
  }

  // Fallback secundário no bucket alternativo
  const { data: fallbackPub } = supabase.storage
    .from(DEGUSTACOES_FALLBACK_BUCKET)
    .getPublicUrl(anexo.path);
  if (fallbackPub?.publicUrl) {
    return fallbackPub.publicUrl;
  }

  throw new Error("Não foi possível gerar link de acesso ao arquivo.");
}

/**
 * Atualiza atomicamente a lista de anexos no registro de uma degustação.
 */
export async function updateDegustacaoAnexos(
  degustacaoId: string,
  anexos: AnexoDegustacao[],
): Promise<Degustacao> {
  const { data, error } = await supabase
    .from("degustacoes")
    .update({ anexos: anexos as unknown as Json })
    .eq("id", degustacaoId)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar anexos da degustação:", error);
    throw error;
  }

  return data;
}
