import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Status = "Ativa" | "Programada" | "Encerrada" | "Rascunho";

export interface MaterialApoio {
  path: string;
  nome: string;
  tipo: string;
  tamanho: number;
}

export interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  dataInicial: string;
  dataFinal: string;
  status: Status;
  filiais: string[];
  clubeSumel: boolean;
  materiais: MaterialApoio[];
}

export interface Oferta {
  id: string;
  campanhaId: string;
  codigo: string;
  gtin: string;
  gtinsCresceVendas: string;
  descricao: string;
  fornecedor: string;
  categoria: string;
  precoNormal: number;
  custo: number;
  precoPromocional: number;
  clubeSumel: boolean;
  dataInicial: string;
  dataFinal: string;
  filiais: string[];
  corredor: string;
  estoque: number;
  margem: number;
  status: Status;
  selloutTemVerba: boolean;
  selloutFornecedor: string;
  selloutValor: number;
  selloutObs: string;
}

export interface Acerto {
  quantidadeVendida: number;
  registradoEm: string;
  baixado: boolean;
  baixadoEm: string | null;
}

type State = { campanhas: Campanha[]; ofertas: Oferta[]; acertos: Record<string, Acerto>; carregando: boolean };

const emptyState: State = { campanhas: [], ofertas: [], acertos: {}, carregando: true };

let state: State = emptyState;
const listeners = new Set<() => void>();
const emit = () => {
  state = { ...state };
  listeners.forEach((l) => l());
};

/* ---------- mapeamento banco <-> app ---------- */

const toCampanha = (r: any): Campanha => ({
  id: r.id,
  nome: r.nome ?? "",
  descricao: r.descricao ?? "",
  dataInicial: r.data_inicial ?? "",
  dataFinal: r.data_final ?? "",
  status: (r.status ?? "Rascunho") as Status,
  filiais: Array.isArray(r.filiais) ? r.filiais : [],
  clubeSumel: !!r.clube_sumel,
  materiais: Array.isArray(r.materiais) ? r.materiais : [],
});

const fromCampanha = (c: Campanha) => ({
  id: c.id,
  nome: c.nome,
  descricao: c.descricao ?? "",
  data_inicial: c.dataInicial || null,
  data_final: c.dataFinal || null,
  status: c.status,
  filiais: c.filiais ?? [],
  clube_sumel: !!c.clubeSumel,
  materiais: c.materiais ?? [],
});

const toOferta = (r: any): Oferta => ({
  id: r.id,
  campanhaId: r.campanha_id,
  codigo: r.codigo ?? "",
  gtin: r.gtin ?? "",
  gtinsCresceVendas: r.gtins_cresce_vendas ?? "",
  descricao: r.descricao ?? "",
  fornecedor: r.fornecedor ?? "",
  categoria: r.categoria ?? "",
  precoNormal: Number(r.preco_normal ?? 0),
  custo: Number(r.custo ?? 0),
  precoPromocional: Number(r.preco_promocional ?? 0),
  clubeSumel: !!r.clube_sumel,
  dataInicial: r.data_inicial ?? "",
  dataFinal: r.data_final ?? "",
  filiais: Array.isArray(r.filiais) ? r.filiais : [],
  corredor: r.corredor ?? "",
  estoque: Number(r.estoque ?? 0),
  margem: Number(r.margem ?? 0),
  status: (r.status ?? "Rascunho") as Status,
  selloutTemVerba: !!r.sellout_tem_verba,
  selloutFornecedor: r.sellout_fornecedor ?? "",
  selloutValor: Number(r.sellout_valor ?? 0),
  selloutObs: r.sellout_obs ?? "",
});

const fromOferta = (o: Oferta) => ({
  id: o.id,
  campanha_id: o.campanhaId,
  codigo: o.codigo ?? "",
  gtin: o.gtin ?? "",
  gtins_cresce_vendas: o.gtinsCresceVendas ?? "",
  descricao: o.descricao ?? "",
  fornecedor: o.fornecedor ?? "",
  categoria: o.categoria ?? "",
  preco_normal: Number(o.precoNormal ?? 0),
  custo: Number(o.custo ?? 0),
  preco_promocional: Number(o.precoPromocional ?? 0),
  clube_sumel: !!o.clubeSumel,
  data_inicial: o.dataInicial || null,
  data_final: o.dataFinal || null,
  filiais: o.filiais ?? [],
  corredor: o.corredor ?? "",
  estoque: Number(o.estoque ?? 0),
  margem: Number(o.margem ?? 0),
  status: o.status,
  sellout_tem_verba: !!o.selloutTemVerba,
  sellout_fornecedor: o.selloutFornecedor ?? "",
  sellout_valor: Number(o.selloutValor ?? 0),
  sellout_obs: o.selloutObs ?? "",
});

/* ---------- carregamento inicial ---------- */

let carregado = false;

export async function carregarCampanhas() {
  if (typeof window === "undefined") return;
  const [{ data: camps }, { data: ofs }, { data: acs }] = await Promise.all([
    supabase.from("campanhas" as any).select("*").order("data_inicial", { ascending: false }),
    supabase.from("ofertas" as any).select("*"),
    supabase.from("acertos" as any).select("*"),
  ]);
  const acertos: Record<string, Acerto> = {};
  for (const a of (acs ?? []) as any[]) {
    acertos[a.oferta_id] = {
      quantidadeVendida: Number(a.quantidade_vendida ?? 0),
      registradoEm: a.registrado_em ?? new Date().toISOString(),
      baixado: Boolean(a.baixado),
      baixadoEm: a.baixado_em ?? null,
    };
  }
  state = {
    campanhas: ((camps ?? []) as any[]).map(toCampanha),
    ofertas: ((ofs ?? []) as any[]).map(toOferta),
    acertos,
    carregando: false,
  };
  emit();
  void alinharStatusOfertas();
}

/**
 * Mantém o status das ofertas igual ao status (derivado das datas) da campanha.
 * Persiste no banco apenas as ofertas que estiverem divergentes.
 */
async function alinharStatusOfertas() {
  const statusPorCampanha = new Map(state.campanhas.map((c) => [c.id, statusCampanha(c)]));
  const divergentes = state.ofertas.filter((o) => {
    const s = statusPorCampanha.get(o.campanhaId);
    return s && o.status !== s;
  });
  if (!divergentes.length) return;

  const next = state.ofertas.map((o) => {
    const s = statusPorCampanha.get(o.campanhaId);
    return s && o.status !== s ? { ...o, status: s } : o;
  });
  state = { ...state, ofertas: next };
  emit();

  const porStatus = new Map<Status, string[]>();
  for (const o of divergentes) {
    const s = statusPorCampanha.get(o.campanhaId)!;
    porStatus.set(s, [...(porStatus.get(s) ?? []), o.id]);
  }
  for (const [s, ids] of porStatus) {
    await supabase.from("ofertas" as any).update({ status: s }).in("id", ids);
  }
}


function ensureLoaded() {
  if (carregado || typeof window === "undefined") return;
  carregado = true;
  void carregarCampanhas().catch(() => {
    state = { ...state, carregando: false };
    emit();
  });
}

/* ---------- persistência por diferença ---------- */

async function syncCampanhas(prev: Campanha[], next: Campanha[]) {
  const prevMap = new Map(prev.map((c) => [c.id, c]));
  const nextMap = new Map(next.map((c) => [c.id, c]));
  const removidos = prev.filter((c) => !nextMap.has(c.id)).map((c) => c.id);
  const alterados = next.filter((c) => {
    const p = prevMap.get(c.id);
    return !p || JSON.stringify(p) !== JSON.stringify(c);
  });
  if (removidos.length) await supabase.from("campanhas" as any).delete().in("id", removidos);
  if (alterados.length) await supabase.from("campanhas" as any).upsert(alterados.map(fromCampanha));
}

async function syncOfertas(prev: Oferta[], next: Oferta[]) {
  const prevMap = new Map(prev.map((o) => [o.id, o]));
  const nextMap = new Map(next.map((o) => [o.id, o]));
  const removidos = prev.filter((o) => !nextMap.has(o.id)).map((o) => o.id);
  const alterados = next.filter((o) => {
    const p = prevMap.get(o.id);
    return !p || JSON.stringify(p) !== JSON.stringify(o);
  });
  if (removidos.length) await supabase.from("ofertas" as any).delete().in("id", removidos);
  if (alterados.length) await supabase.from("ofertas" as any).upsert(alterados.map(fromOferta));
}

export const campanhasStore = {
  get: () => state,
  subscribe: (fn: () => void) => {
    ensureLoaded();
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  reload: () => carregarCampanhas(),
  setCampanhas: (updater: (prev: Campanha[]) => Campanha[]) => {
    const prev = state.campanhas;
    const next = updater(prev);
    state = { ...state, campanhas: next };
    emit();
    void syncCampanhas(prev, next).then(() => alinharStatusOfertas());
  },
  setOfertas: (updater: (prev: Oferta[]) => Oferta[]) => {
    const prev = state.ofertas;
    const next = updater(prev);
    state = { ...state, ofertas: next };
    emit();
    void syncOfertas(prev, next);
  },
  setAcerto: (ofertaId: string, quantidadeVendida: number) => {
    const registradoEm = new Date().toISOString();
    state = {
      ...state,
      acertos: { ...state.acertos, [ofertaId]: { quantidadeVendida, registradoEm } },
    };
    emit();
    void supabase.from("acertos" as any).upsert({
      oferta_id: ofertaId,
      quantidade_vendida: quantidadeVendida,
      registrado_em: registradoEm,
    });
  },
};

const serverSnap: State = { campanhas: [], ofertas: [], acertos: {}, carregando: true };

export function useCampanhasStore(): State {
  return useSyncExternalStore(campanhasStore.subscribe, campanhasStore.get, () => serverSnap);
}

/** Today's date (local) as YYYY-MM-DD. */
export const todayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Classify a campaign based on the draft flag and its dates. */
export function categoriaCampanha(c: Campanha): "rascunho" | "encerrada" | "futura" | "ativa" {
  const hoje = todayIso();
  if (c.status === "Rascunho") return "rascunho";
  if (c.dataFinal && c.dataFinal < hoje) return "encerrada";
  if (c.dataInicial && c.dataInicial > hoje) return "futura";
  return "ativa";
}

/** Status derived from the campaign dates (or "Rascunho" when marked as draft). */
export function statusCampanha(c: Campanha): Status {
  const cat = categoriaCampanha(c);
  return cat === "rascunho" ? "Rascunho" : cat === "encerrada" ? "Encerrada" : cat === "futura" ? "Programada" : "Ativa";
}
