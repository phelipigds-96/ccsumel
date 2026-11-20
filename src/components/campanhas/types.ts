import {
  type Campanha,
  type Oferta,
  type Status,
  type MaterialApoio,
  type ChecklistItem,
  type TipoPromocaoOferta,
  categoriaCampanha,
  statusCampanha,
  formatFiliais,
} from "@/lib/campanhas-store";

export {
  type Campanha,
  type Oferta,
  type Status,
  type MaterialApoio,
  type ChecklistItem,
  type TipoPromocaoOferta,
  categoriaCampanha,
  statusCampanha,
  formatFiliais,
};

export const CATEGORIAS = [
  "Bebidas",
  "Mercearia",
  "Higiene",
  "Limpeza",
  "Frios",
  "Padaria",
  "Hortifruti",
];

export const FORNECEDORES = [
  "Ambev",
  "Nestlé",
  "Unilever",
  "P&G",
  "Coca-Cola",
  "BRF",
  "JBS",
];

export const FILIAIS = [
  "Matriz",
  "Filial Esteio",
  "Filial Sapucaia",
  "Filial São Leopoldo",
];

export const STATUS: Status[] = ["Ativa", "Programada", "Encerrada", "Rascunho"];

export const statusVariant: Record<Status, string> = {
  Ativa: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Programada: "bg-blue-100 text-blue-700 border-blue-200",
  Encerrada: "bg-slate-200 text-slate-700 border-slate-300",
  Rascunho: "bg-amber-100 text-amber-700 border-amber-200",
};

export const emptyCampanha = (): Campanha => ({
  id: crypto.randomUUID(),
  nome: "",
  descricao: "",
  dataInicial: "",
  dataFinal: "",
  status: "Rascunho",
  filiais: [],
  clubeSumel: false,
  materiais: [],
  checklist: [
    { id: "c1", task: "Coletar produtos", status: "Pendente" },
    { id: "c2", task: "Precificar ofertas", status: "Pendente" },
    { id: "c3", task: "Cadastrar no Sistema", status: "Pendente" },
    { id: "c4", task: "Fazer cartazes para impressão", status: "Pendente" },
    { id: "c5", task: "Criar encarte digital", status: "Pendente" },
  ],
});

export const emptyOferta = (campanha: Campanha): Oferta => ({
  id: crypto.randomUUID(),
  campanhaId: campanha.id,
  codigo: "",
  gtin: "",
  gtinsCresceVendas: "",
  descricao: "",
  fornecedor: FORNECEDORES[0],
  categoria: CATEGORIAS[0],
  precoNormal: 0,
  custo: 0,
  precoPromocional: 0,
  tipoPromocao: "simples",
  quantidadeMinima: 1,
  clubeSumel: campanha.clubeSumel ?? false,
  dataInicial: campanha.dataInicial,
  dataFinal: campanha.dataFinal,
  filiais: [...(campanha.filiais ?? [])],
  corredor: "",
  estoque: 0,
  margem: 0,
  status: statusCampanha(campanha),
  selloutTemVerba: false,
  selloutFornecedor: "",
  selloutValor: 0,
  selloutObs: "",
});
