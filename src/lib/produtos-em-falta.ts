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

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

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
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  const { error } = await table()
    .update({
      status: input.status,
      management_observation: input.observation?.trim() ?? "",
      managed_by: user?.id ?? null,
      managed_at: new Date().toISOString(),
    })
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
