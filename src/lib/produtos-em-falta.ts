import { supabase } from "@/integrations/supabase/client";

export const FALTA_STATUS = [
  "Pendente",
  "Em análise",
  "Comprar",
  "Pedido realizado",
  "Aguardando recebimento",
  "Estoque disponível / verificar loja",
  "Falta no fornecedor",
  "Produto descontinuado",
  "Resolvido",
  "Não é ruptura",
] as const;

export type FaltaStatus = (typeof FALTA_STATUS)[number];

export const LOJAS = ["Matriz", "Filial 01", "Filial 02", "Filial 03"];

export const PERM_REGISTRAR = "/produtos-em-falta";
export const PERM_GERENCIAR = "/central-produtos-em-falta";

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Loja do usuário compartilhado: derivada do login/nome do perfil (ex.: "filial01",
 * "Filial 01", "matriz"). Administradores e usuários de gestão não ficam restritos.
 */
export function lojaDoUsuario(
  user: { name?: string; username?: string; isAdmin?: boolean; permissions?: string[] } | null,
): string | null {
  if (!user || user.isAdmin) return null;
  if ((user.permissions ?? []).includes(PERM_GERENCIAR)) return null;
  const alvos = [user.username, user.name].filter(Boolean).map((v) => slug(String(v)));
  return LOJAS.find((l) => alvos.includes(slug(l))) ?? null;
}

export function podeGerenciarFaltas(
  user: { isAdmin?: boolean; permissions?: string[] } | null,
): boolean {
  return !!user && (user.isAdmin || (user.permissions ?? []).includes(PERM_GERENCIAR));
}

export interface ProdutoEmFalta {
  id: string;
  product_id: string;
  store_id: string;
  reported_by_name: string;
  reported_by_user_id: string | null;
  reported_by_username: string;
  reported_at: string;
  observation: string;
  status: FaltaStatus;
  management_observation: string;
  managed_by: string | null;
  managed_at: string | null;
  created_at: string;
  updated_at: string;
  produto?: { id: string; descricao: string; codigo: string | null; gtin: string | null } | null;
}

export interface FaltaHistorico {
  id: string;
  falta_id: string;
  status_anterior: FaltaStatus | null;
  status_novo: FaltaStatus;
  changed_by: string | null;
  changed_by_name: string;
  observation: string;
  created_at: string;
}

/**
 * Lê o usuário da sessão local. NÃO usar supabase.auth.getUser(): qualquer
 * falha de rede/token nessa chamada dispara signOut global e derruba o login
 * compartilhado da loja no meio do registro.
 */
async function currentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

const table = () => supabase.from("produtos_em_falta" as any);
const historicoTable = () => supabase.from("produtos_em_falta_historico" as any);

export async function listFaltas(opts: { status?: FaltaStatus | "todos"; loja?: string; busca?: string } = {}) {
  let q = table()
    .select("*, produto:produtos(id, descricao, codigo, gtin)")
    .order("reported_at", { ascending: false })
    .limit(300);

  if (opts.status && opts.status !== "todos") q = q.eq("status", opts.status);
  if (opts.loja && opts.loja !== "todas") q = q.eq("store_id", opts.loja);

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as unknown as ProdutoEmFalta[];
  const s = (opts.busca ?? "").trim().toLowerCase();
  if (s) {
    rows = rows.filter((r) =>
      [r.produto?.descricao, r.produto?.codigo, r.produto?.gtin, r.reported_by_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    );
  }
  return rows;
}

export async function createFalta(input: {
  product_id: string;
  store_id: string;
  reported_by_name: string;
  observation?: string;
}) {
  const name = input.reported_by_name.trim();
  if (!name) throw new Error("Informe o nome de quem está apontando a falta.");

  const user = await currentUser();

  const payload = {
    product_id: input.product_id,
    store_id: input.store_id,
    reported_by_name: name,
    reported_by_user_id: user?.id ?? null,
    reported_by_username: (user?.user_metadata?.["username"] as string) ?? user?.email ?? "",
    observation: input.observation?.trim() ?? "",
    status: "Pendente" as FaltaStatus,
  };

  const { data, error } = await table().insert(payload).select("id").single();
  if (error) throw error;

  const falta = data as unknown as { id: string };
  await historicoTable().insert({
    falta_id: falta.id,
    status_anterior: null,
    status_novo: "Pendente",
    changed_by: user?.id ?? null,
    changed_by_name: name,
    observation: payload.observation,
  });

  return falta.id;
}

export async function updateFaltaStatus(input: {
  id: string;
  status_anterior: FaltaStatus;
  status: FaltaStatus;
  observation?: string;
  changed_by_name: string;
}) {
  const user = await currentUser();

  const payload: any = {
    status: input.status,
    management_observation: input.observation?.trim() ?? "",
    managed_by: user?.id ?? null,
    managed_at: new Date().toISOString(),
  };

  // Se a tratativa tiver status diferente de Pendente, atualiza a data de retorno
  // para que ela apareça na lista de Retorno às Lojas e reseta o ciente para a loja.
  if (input.status !== "Pendente") {
    payload.retorno_em = new Date().toISOString();
    payload.ciente_at = null;
    payload.ciente_by = null;
    payload.ciente_by_name = "";
  }

  const { error } = await table()
    .update(payload)
    .eq("id", input.id);
  if (error) throw error;

  const { error: histError } = await historicoTable().insert({
    falta_id: input.id,
    status_anterior: input.status_anterior,
    status_novo: input.status,
    changed_by: user?.id ?? null,
    changed_by_name: input.changed_by_name,
    observation: input.observation?.trim() ?? "",
  });
  if (histError) throw histError;
}

export async function listHistoricoMany(faltaIds: string[]): Promise<FaltaHistorico[]> {
  if (faltaIds.length === 0) return [];
  const { data, error } = await historicoTable()
    .select("*")
    .in("falta_id", faltaIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FaltaHistorico[];
}

export async function listHistorico(faltaId: string): Promise<FaltaHistorico[]> {
  const { data, error } = await historicoTable()
    .select("*")
    .eq("falta_id", faltaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FaltaHistorico[];
}

export async function deleteFalta(id: string) {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Bloqueio de novos lançamentos (por produto + loja)
// ---------------------------------------------------------------------------

export interface ProdutoBloqueio {
  id: string;
  product_id: string;
  store_id: string;
  status: FaltaStatus;
  permanente: boolean;
  ativo: boolean;
  motivo: string;
  tratado_em: string;
}

const bloqueiosTable = () => supabase.from("produto_bloqueios" as any);

export async function listFaltasPendentes(productIds: string[], loja: string) {
  const set = new Set<string>();
  if (productIds.length === 0 || !loja) return set;
  const { data, error } = await table()
    .select("product_id")
    .in("product_id", productIds)
    .eq("store_id", loja)
    .eq("status", "Pendente");
  if (error) throw error;
  for (const r of (data ?? []) as any[]) set.add(r.product_id);
  return set;
}

export async function checkFaltaPendente(productId: string, loja: string) {
  const { data, error } = await table()
    .select("id")
    .eq("product_id", productId)
    .eq("store_id", loja)
    .eq("status", "Pendente")
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

/** Bloqueios ativos para uma lista de produtos em uma loja (uso na pesquisa). */
export async function listBloqueiosAtivos(productIds: string[], loja: string) {
  const map = new Map<string, ProdutoBloqueio>();
  if (productIds.length === 0 || !loja) return map;
  const { data, error } = await bloqueiosTable()
    .select("id, product_id, store_id, status, permanente, motivo, tratado_em")
    .in("product_id", productIds)
    .eq("store_id", loja)
    .eq("ativo", true);
  if (error) throw error;
  for (const b of (data ?? []) as unknown as ProdutoBloqueio[]) map.set(b.product_id, b);
  return map;
}

/** Bloqueio ativo de um produto em uma loja (uso na Central / revalidação). */
export async function getBloqueioAtivo(productId: string, loja: string) {
  const { data, error } = await bloqueiosTable()
    .select("id, product_id, store_id, status, permanente, motivo, tratado_em")
    .eq("product_id", productId)
    .eq("store_id", loja)
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ProdutoBloqueio | null) ?? null;
}

/** Converte os erros do gatilho do banco em mensagens claras para o chão de loja. */
export function traduzErroLancamento(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  if (msg.includes("PRODUTO_BLOQUEADO")) {
    const partes = msg.split("|");
    const status = partes[1]?.trim();
    const data = partes[2]?.trim();
    return [
      "Este produto possui um retorno da área de Compras:",
      status ? `Status atual: ${status}` : null,
      data ? `Solicitação anterior tratada em: ${data}` : null,
      "O produto não pode ser adicionado novamente à Lista de Faltas.",
    ].filter(Boolean).join("\n");
  }
  if (msg.includes("PRODUTO_JA_SOLICITADO")) {
    return "Este produto já possui uma solicitação pendente para esta loja.";
  }
  return msg || "Não foi possível registrar.";
}

/** Usuário logado: id e nome de exibição (usado na liberação e no histórico). */
async function usuarioAtualComNome() {
  const user = await currentUser();
  return {
    id: (user?.id ?? null) as string | null,
    nome:
      (user?.user_metadata?.["name"] as string) ??
      (user?.user_metadata?.["username"] as string) ??
      user?.email ??
      "Administrador",
  };
}

/** Liberação administrativa do bloqueio ("Produto ativo"). Restrita a admin no banco. */
export async function liberarBloqueio(bloqueioId: string, motivo: string) {
  const { nome } = await usuarioAtualComNome();
  const { error } = await supabase.rpc("liberar_produto_bloqueado" as any, {
    _bloqueio_id: bloqueioId,
    _nome: nome,
    _motivo: motivo.trim(),
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Alteração da condição de bloqueio + histórico (produto + loja)
// ---------------------------------------------------------------------------

export interface ProdutoBloqueioAtivo extends ProdutoBloqueio {
  produto?: { id: string; descricao: string; codigo: string | null; gtin: string | null } | null;
}

export interface ProdutoBloqueioHistorico {
  id: string;
  bloqueio_id: string | null;
  product_id: string;
  store_id: string;
  status_anterior: string | null;
  status_novo: string;
  changed_by: string | null;
  changed_by_name: string;
  motivo: string;
  created_at: string;
  produto?: { id: string; descricao: string } | null;
}

const bloqueiosHistTable = () => supabase.from("produto_bloqueios_historico" as any);

async function descreverProdutos(ids: string[]) {
  const map = new Map<
    string,
    { id: string; descricao: string; codigo: string | null; gtin: string | null }
  >();
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return map;
  const { data } = await supabase
    .from("produtos")
    .select("id, descricao, codigo, gtin")
    .in("id", unicos);
  for (const p of (data ?? []) as any[]) map.set(String(p.id), p);
  return map;
}

/** Bloqueios ativos (de todas as lojas ou de uma loja), com o produto carregado. */
export async function listBloqueiosAtivosTodos(
  opts: { loja?: string | null } = {},
): Promise<ProdutoBloqueioAtivo[]> {
  let q = bloqueiosTable()
    .select("id, product_id, store_id, status, permanente, motivo, tratado_em")
    .eq("ativo", true)
    .order("tratado_em", { ascending: false })
    .limit(300);
  if (opts.loja) q = q.eq("store_id", opts.loja);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as ProdutoBloqueioAtivo[];
  const map = await descreverProdutos(rows.map((r) => r.product_id));
  return rows.map((r) => ({ ...r, produto: map.get(r.product_id) ?? null }));
}

/**
 * Histórico das alterações de condição de bloqueio, do mais recente para o
 * mais antigo. Se a tabela de histórico ainda não existir no banco, devolve
 * lista vazia em vez de derrubar a tela.
 */
export async function listHistoricoBloqueios(limite = 50): Promise<ProdutoBloqueioHistorico[]> {
  try {
    const { data, error } = await bloqueiosHistTable()
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    const rows = (data ?? []) as unknown as ProdutoBloqueioHistorico[];
    const map = await descreverProdutos(rows.map((r) => r.product_id));
    return rows.map((r) => ({ ...r, produto: map.get(r.product_id) ?? null }));
  } catch {
    return [];
  }
}

/**
 * Altera a condição de bloqueio de um produto em uma loja e registra a ação no
 * histórico (produto, loja, status anterior, novo status, usuário, data/hora e
 * motivo). "Produto ativo" libera o produto para novos lançamentos pelo RPC
 * administrativo; qualquer outro status apenas troca a condição, mantendo o
 * bloqueio. Devolve true quando o histórico foi gravado.
 */
export async function alterarCondicaoBloqueio(input: {
  bloqueio: ProdutoBloqueio;
  novoStatus: string;
  motivo: string;
}): Promise<boolean> {
  const motivo = input.motivo.trim();
  if (!motivo) throw new Error("Informe o motivo da alteração.");

  if (input.novoStatus === "Produto ativo") {
    await liberarBloqueio(input.bloqueio.id, motivo);
  } else {
    const { error } = await bloqueiosTable()
      .update({
        status: input.novoStatus,
        motivo,
        tratado_em: new Date().toISOString(),
      })
      .eq("id", input.bloqueio.id);
    if (error) throw error;
  }

  try {
    const { id, nome } = await usuarioAtualComNome();
    const { error } = await bloqueiosHistTable().insert({
      bloqueio_id: input.bloqueio.id,
      product_id: input.bloqueio.product_id,
      store_id: input.bloqueio.store_id,
      status_anterior: input.bloqueio.status,
      status_novo: input.novoStatus,
      changed_by: id,
      changed_by_name: nome,
      motivo,
    });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Retorno às Lojas
// ---------------------------------------------------------------------------

export const PERM_RETORNO = "/retorno-as-lojas";

export interface RetornoLoja extends ProdutoEmFalta {
  pedido_realizado_em: string | null;
  retorno_em: string | null;
  ciente_by: string | null;
  ciente_by_name: string;
  ciente_at: string | null;
  responsavel_nome?: string;
}

/** Prazo (em dias) de exibição no Retorno às Lojas. Configurável no banco. */
export async function getPrazoRetornoDias(): Promise<number> {
  const { data } = await supabase
    .from("app_settings" as any)
    .select("value")
    .eq("key", "retorno_lojas")
    .maybeSingle();
  const v = (data as any)?.value?.prazo_dias;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

export async function setPrazoRetornoDias(dias: number) {
  const { error } = await supabase
    .from("app_settings" as any)
    .update({ value: { prazo_dias: dias } })
    .eq("key", "retorno_lojas");
  if (error) throw error;
}

export function podeVerRetorno(
  user: { isAdmin?: boolean; permissions?: string[] } | null,
): boolean {
  return !!user && (user.isAdmin || (user.permissions ?? []).includes(PERM_RETORNO));
}

/**
 * Regra: qualquer falta cujo status seja DIFERENTE de "Pendente" entra no
 * Retorno às Lojas — sem lista fixa de status, então status novos passam a
 * aparecer automaticamente. A data de entrada (`retorno_em`) é gravada pelo
 * banco na primeira mudança de situação, e a saída da lista é automática
 * pelo prazo configurado — nada é excluído do banco.
 */
export async function listRetornoLojas(opts: { loja?: string | null } = {}) {
  const prazo = await getPrazoRetornoDias();
  const limite = new Date(Date.now() - prazo * 24 * 60 * 60 * 1000).toISOString();

  let q = table()
    .select("*, produto:produtos(id, descricao, codigo, gtin)")
    .neq("status", "Pendente")
    .gte("retorno_em", limite)
    .order("retorno_em", { ascending: false })
    .limit(300);

  if (opts.loja) q = q.eq("store_id", opts.loja);

  const { data, error } = await q;
  if (error) throw error;
  return { prazo, rows: (data ?? []) as unknown as RetornoLoja[] };
}

export async function contarRetornosNaoCientes(loja?: string | null) {
  const { rows } = await listRetornoLojas({ loja: loja ?? null });
  return rows.filter((r) => !r.ciente_at).length;
}


export async function marcarCiente(faltaId: string, nome: string) {
  const { error } = await supabase.rpc("marcar_retorno_ciente" as any, {
    _falta_id: faltaId,
    _nome: nome,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Regras configuráveis: quais situações bloqueiam novos lançamentos
// ---------------------------------------------------------------------------

export interface RegraStatus {
  status: FaltaStatus;
  bloqueia_novo_lancamento: boolean;
  bloqueio_permanente: boolean;
}

const regrasTable = () => supabase.from("falta_status_regras" as any);

/** Regras atuais, na mesma ordem dos status do sistema. */
export async function listRegrasStatus(): Promise<RegraStatus[]> {
  const { data, error } = await regrasTable().select("status, bloqueia_novo_lancamento, bloqueio_permanente");
  if (error) throw error;
  const rows = (data ?? []) as unknown as RegraStatus[];
  const map = new Map(rows.map((r) => [r.status, r]));
  return FALTA_STATUS.map(
    (s) => map.get(s) ?? { status: s, bloqueia_novo_lancamento: false, bloqueio_permanente: false },
  );
}

/** Atualiza uma regra (somente administradores, validado no banco). */
export async function updateRegraStatus(
  status: FaltaStatus,
  patch: { bloqueia_novo_lancamento?: boolean; bloqueio_permanente?: boolean },
) {
  const { error } = await regrasTable().update(patch).eq("status", status);
  if (error) throw error;
}
