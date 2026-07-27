import { useSyncExternalStore } from "react";

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

const seedCampanhas: Campanha[] = [
  { id: "c1", nome: "Ofertas da Semana", descricao: "Ofertas semanais rotativas em todas as filiais.", dataInicial: "2026-07-22", dataFinal: "2026-07-28", status: "Ativa", filiais: [], materiais: [] },
  { id: "c2", nome: "Verão Gelado", descricao: "Campanha sazonal de bebidas e sorvetes.", dataInicial: "2026-07-20", dataFinal: "2026-08-15", status: "Ativa", filiais: [], materiais: [] },
  { id: "c3", nome: "Casa Limpa", descricao: "Promoções em produtos de limpeza doméstica.", dataInicial: "2026-08-01", dataFinal: "2026-08-20", status: "Programada", filiais: [], materiais: [] },
  { id: "c4", nome: "Café da Manhã", descricao: "Pães, cafés, laticínios e cereais.", dataInicial: "2026-07-15", dataFinal: "2026-07-30", status: "Ativa", filiais: [], materiais: [] },
  { id: "c5", nome: "Mês do Bebê", descricao: "Higiene infantil e cuidados com o bebê.", dataInicial: "2026-06-10", dataFinal: "2026-07-05", status: "Encerrada", filiais: [], materiais: [] },
];

const seedOfertas: Oferta[] = [
  { id: "1", campanhaId: "c2", codigo: "OF-0001", gtin: "", descricao: "Cerveja Brahma 350ml Pack 12", fornecedor: "Ambev", categoria: "Bebidas", precoNormal: 59.9, custo: 0, precoPromocional: 44.9, clubeSumel: true, dataInicial: "2026-07-20", dataFinal: "2026-08-10", filiais: ["Matriz"], corredor: "A3", estoque: 320, margem: 18.5, status: "Ativa", selloutTemVerba: true, selloutFornecedor: "Ambev", selloutValor: 1500, selloutObs: "Verba de exposição — pack promocional." },
  { id: "2", campanhaId: "c4", codigo: "OF-0002", gtin: "", descricao: "Café Nescafé Tradicional 500g", fornecedor: "Nestlé", categoria: "Mercearia", precoNormal: 29.9, custo: 0, precoPromocional: 23.9, clubeSumel: false, dataInicial: "2026-07-15", dataFinal: "2026-07-30", filiais: ["Filial 01"], corredor: "B7", estoque: 180, margem: 22.0, status: "Ativa", selloutTemVerba: false, selloutFornecedor: "", selloutValor: 0, selloutObs: "" },
  { id: "3", campanhaId: "c3", codigo: "OF-0003", gtin: "", descricao: "Sabão em Pó OMO 1,6kg", fornecedor: "Unilever", categoria: "Limpeza", precoNormal: 39.9, custo: 0, precoPromocional: 31.9, clubeSumel: true, dataInicial: "2026-08-01", dataFinal: "2026-08-20", filiais: ["Matriz"], corredor: "C2", estoque: 240, margem: 15.0, status: "Programada", selloutTemVerba: true, selloutFornecedor: "Unilever", selloutValor: 800, selloutObs: "" },
  { id: "4", campanhaId: "c5", codigo: "OF-0004", gtin: "", descricao: "Fralda Pampers G 40un", fornecedor: "P&G", categoria: "Higiene", precoNormal: 89.9, custo: 0, precoPromocional: 69.9, clubeSumel: true, dataInicial: "2026-06-10", dataFinal: "2026-07-05", filiais: ["Filial 02"], corredor: "D4", estoque: 60, margem: 25.5, status: "Encerrada", selloutTemVerba: false, selloutFornecedor: "", selloutValor: 0, selloutObs: "" },
  { id: "5", campanhaId: "c2", codigo: "OF-0005", gtin: "", descricao: "Refrigerante Coca-Cola 2L", fornecedor: "Coca-Cola", categoria: "Bebidas", precoNormal: 12.9, custo: 0, precoPromocional: 8.99, clubeSumel: false, dataInicial: "2026-07-25", dataFinal: "2026-08-15", filiais: ["Filial 03"], corredor: "A1", estoque: 500, margem: 12.0, status: "Ativa", selloutTemVerba: false, selloutFornecedor: "", selloutValor: 0, selloutObs: "" },
  { id: "6", campanhaId: "c1", codigo: "OF-0006", gtin: "", descricao: "Arroz Camil 5kg", fornecedor: "BRF", categoria: "Mercearia", precoNormal: 34.9, custo: 0, precoPromocional: 27.9, clubeSumel: true, dataInicial: "2026-07-22", dataFinal: "2026-07-28", filiais: ["Matriz"], corredor: "B1", estoque: 400, margem: 14.0, status: "Ativa", selloutTemVerba: true, selloutFornecedor: "BRF", selloutValor: 500, selloutObs: "Encarte semanal." },
];

const KEY_CAMP = "sgmc.campanhas.v1";
const KEY_OFER = "sgmc.ofertas.v1";
const KEY_ACER = "sgmc.acertos.v1";

export interface Acerto {
  quantidadeVendida: number;
  registradoEm: string;
}

type State = { campanhas: Campanha[]; ofertas: Oferta[]; acertos: Record<string, Acerto> };

const loadState = (): State => {
  if (typeof window === "undefined") return { campanhas: seedCampanhas, ofertas: seedOfertas, acertos: {} };
  try {
    const c = window.localStorage.getItem(KEY_CAMP);
    const o = window.localStorage.getItem(KEY_OFER);
    const a = window.localStorage.getItem(KEY_ACER);
    const ofertasRaw = o ? (JSON.parse(o) as any[]) : seedOfertas;
    const ofertasMigradas: Oferta[] = ofertasRaw.map((of) => {
      if (of && !Array.isArray(of.filiais)) {
        const legacy = typeof of.filial === "string" && of.filial ? [of.filial] : [];
        const { filial: _drop, ...rest } = of;
        return { ...rest, filiais: legacy } as Oferta;
      }
      return of as Oferta;
    });
    const campanhasRaw = c ? (JSON.parse(c) as any[]) : seedCampanhas;
    const campanhasMigradas: Campanha[] = campanhasRaw.map((cp) => ({
      ...cp,
      filiais: Array.isArray(cp?.filiais) ? cp.filiais : [],
      materiais: Array.isArray(cp?.materiais) ? cp.materiais : [],
    }));
    return {
      campanhas: campanhasMigradas,
      ofertas: ofertasMigradas,
      acertos: a ? (JSON.parse(a) as Record<string, Acerto>) : {},
    };
  } catch {
    return { campanhas: seedCampanhas, ofertas: seedOfertas, acertos: {} };
  }
};

let state: State = loadState();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const persist = () => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_CAMP, JSON.stringify(state.campanhas));
  window.localStorage.setItem(KEY_OFER, JSON.stringify(state.ofertas));
  window.localStorage.setItem(KEY_ACER, JSON.stringify(state.acertos));
};

export const campanhasStore = {
  get: () => state,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setCampanhas: (updater: (prev: Campanha[]) => Campanha[]) => {
    state = { ...state, campanhas: updater(state.campanhas) };
    persist();
    emit();
  },
  setOfertas: (updater: (prev: Oferta[]) => Oferta[]) => {
    state = { ...state, ofertas: updater(state.ofertas) };
    persist();
    emit();
  },
  setAcerto: (ofertaId: string, quantidadeVendida: number) => {
    state = {
      ...state,
      acertos: {
        ...state.acertos,
        [ofertaId]: { quantidadeVendida, registradoEm: new Date().toISOString() },
      },
    };
    persist();
    emit();
  },
};

const serverSnap: State = { campanhas: seedCampanhas, ofertas: seedOfertas, acertos: {} };

export function useCampanhasStore(): State {
  return useSyncExternalStore(
    campanhasStore.subscribe,
    campanhasStore.get,
    () => serverSnap,
  );
}

/** Today's date (local) as YYYY-MM-DD. */
export const todayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Classify a campaign as "encerrada", "futura" or "ativa" based on status and dates. */
export function categoriaCampanha(c: Campanha): "encerrada" | "futura" | "ativa" {
  const hoje = todayIso();
  if (c.status === "Encerrada") return "encerrada";
  if (c.dataFinal && c.dataFinal < hoje) return "encerrada";
  if (c.status === "Programada") return "futura";
  if (c.dataInicial && c.dataInicial > hoje) return "futura";
  return "ativa";
}
