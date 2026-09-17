import { supabase } from "@/integrations/supabase/client";

export const SOLICITACAO_STATUS = [
  "Pendente",
  "Em análise",
  "Aprovado",
  "Cadastro solicitado",
  "Cadastrado",
  "Não aprovado",
  "Produto já cadastrado",
] as const;

export type SolicitacaoStatus = (typeof SOLICITACAO_STATUS)[number];

export const SOLICITACAO_URGENCIAS = ["Normal", "Alta"] as const;
export type SolicitacaoUrgencia = (typeof SOLICITACAO_URGENCIAS)[number];

/** Permissão usada no menu lateral e no controle de acesso da tratativa. */
export const PERM_SOLICITACOES = "/solicitacoes-produtos";

export interface SolicitacaoNovoProduto {
  id: string;
  store_id: string;
  reported_by_user_id: string | null;
  reported_by_name: string;
  reported_at: string;
  nome: string;
  marca: string;
  gramagem_volume: string;
  categoria: string;
  gtin: string | null;
  observacao: string | null;
  quantidade_solicitada: number;
  urgencia: string;
  motivo: string | null;
  status: SolicitacaoStatus;
  management_observation: string | null;
  managed_by: string | null;
  managed_at: string | null;
  product_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolicitacaoHistorico {
  id: string;
  solicitacao_id: string;
  status_anterior: string | null;
  status_novo: string;
  changed_by: string | null;
  changed_by_name: string;
  observation: string | null;
  created_at: string;
}

const table = () => supabase.from("solicitacoes_novos_produtos" as any);
const histTable = () => supabase.from("solicitacoes_novos_produtos_historico" as any);

async function currentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export function podeGerenciarSolicitacoes(
  user: { isAdmin?: boolean; permissions?: string[] } | null,
): boolean {
  return !!user && (user.isAdmin || (user.permissions ?? []).includes(PERM_SOLICITACOES));
}

export interface NovaSolicitacaoInput {
  store_id: string;
  reported_by_name: string;
  nome: string;
  marca: string;
  gramagem_volume: string;
  categoria: string;
  gtin?: string;
  observacao?: string;
  motivo?: string;
  quantidade_solicitada?: number;
  urgencia?: SolicitacaoUrgencia;
}

export async function createSolicitacao(input: NovaSolicitacaoInput): Promise<string> {
  const solicitante = input.reported_by_name.trim();
  if (!solicitante) throw new Error("Informe o nome de quem está solicitando.");
  if (!input.nome.trim()) throw new Error("Informe o nome do produto.");
  if (!input.marca.trim()) throw new Error("Informe a marca do produto.");
  if (!input.gramagem_volume.trim()) throw new Error("Informe a gramagem ou o volume.");
  if (!input.categoria.trim()) throw new Error("Informe a categoria do produto.");

  const user = await currentUser();
  const qtd = Number(input.quantidade_solicitada);

  const payload = {
    store_id: input.store_id,
    reported_by_user_id: user?.id ?? null,
    reported_by_name: solicitante,
    nome: input.nome.trim(),
    marca: input.marca.trim(),
    gramagem_volume: input.gramagem_volume.trim(),
    categoria: input.categoria.trim(),
    gtin: (input.gtin ?? "").trim(),
    observacao: (input.observacao ?? "").trim(),
    motivo: (input.motivo ?? "").trim(),
    quantidade_solicitada: Number.isFinite(qtd) && qtd > 0 ? qtd : 1,
    urgencia: input.urgencia ?? "Normal",
    status: "Pendente" as SolicitacaoStatus,
  };

  const { data, error } = await table().insert(payload).select("id").single();
  if (error) throw error;

  const nova = data as unknown as { id: string };

  try {
    const { error: histError } = await histTable().insert({
      solicitacao_id: nova.id,
      status_anterior: null,
      status_novo: "Pendente",
      changed_by: user?.id ?? null,
      changed_by_name: solicitante,
      observation: payload.observacao,
    });
    if (histError) {
      // A solicitação já está criada; o histórico é complementar.
      console.warn("Histórico da solicitação não registrado:", histError.message);
    }
  } catch (e) {
    console.warn("Histórico da solicitação não registrado:", (e as Error).message);
  }

  return nova.id;
}

export async function listSolicitacoes(
  opts: { status?: SolicitacaoStatus | "todos"; loja?: string | null; busca?: string } = {},
): Promise<SolicitacaoNovoProduto[]> {
  let q = table().select("*").order("reported_at", { ascending: false }).limit(400);
  if (opts.status && opts.status !== "todos") q = q.eq("status", opts.status);
  if (opts.loja) q = q.eq("store_id", opts.loja);

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as unknown as SolicitacaoNovoProduto[];
  const termo = (opts.busca ?? "").trim().toLowerCase();
  if (termo) {
    rows = rows.filter((r) =>
      [r.nome, r.marca, r.categoria, r.gramagem_volume, r.gtin, r.reported_by_name, r.store_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo)),
    );
  }
  return rows;
}

export interface CamposSolicitacao {
  nome?: string;
  marca?: string;
  gramagem_volume?: string;
  categoria?: string;
  gtin?: string;
  observacao?: string;
  quantidade_solicitada?: number;
  urgencia?: SolicitacaoUrgencia;
}

export interface TratativaSolicitacaoInput {
  id: string;
  status_anterior: string;
  status: SolicitacaoStatus;
  observation?: string;
  changed_by_name: string;
  campos?: CamposSolicitacao;
}

/**
 * Atualiza a solicitação (campos e/ou status) e registra a movimentação no
 * histórico. Retorna true quando o histórico também foi gravado.
 */
export async function tratarSolicitacao(input: TratativaSolicitacaoInput): Promise<boolean> {
  const user = await currentUser();
  const observacao = (input.observation ?? "").trim();

  const payload: Record<string, unknown> = {
    status: input.status,
    management_observation: observacao,
    managed_by: user?.id ?? null,
    managed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const c = input.campos;
  if (c) {
    if (c.nome !== undefined && c.nome.trim()) payload.nome = c.nome.trim();
    if (c.marca !== undefined && c.marca.trim()) payload.marca = c.marca.trim();
    if (c.gramagem_volume !== undefined && c.gramagem_volume.trim())
      payload.gramagem_volume = c.gramagem_volume.trim();
    if (c.categoria !== undefined && c.categoria.trim()) payload.categoria = c.categoria.trim();
    if (c.gtin !== undefined) payload.gtin = c.gtin.trim();
    if (c.observacao !== undefined) payload.observacao = c.observacao.trim();
    if (c.quantidade_solicitada !== undefined && Number(c.quantidade_solicitada) > 0)
      payload.quantidade_solicitada = Number(c.quantidade_solicitada);
    if (c.urgencia !== undefined) payload.urgencia = c.urgencia;
  }

  const { error } = await table().update(payload).eq("id", input.id);
  if (error) throw error;

  try {
    const { error: histError } = await histTable().insert({
      solicitacao_id: input.id,
      status_anterior: input.status_anterior,
      status_novo: input.status,
      changed_by: user?.id ?? null,
      changed_by_name: input.changed_by_name,
      observation: observacao,
    });
    if (histError) return false;
    return true;
  } catch {
    return false;
  }
}

export async function listHistoricoSolicitacoesMany(
  ids: string[],
): Promise<SolicitacaoHistorico[]> {
  if (ids.length === 0) return [];
  const { data, error } = await histTable()
    .select("*")
    .in("solicitacao_id", ids)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SolicitacaoHistorico[];
}
