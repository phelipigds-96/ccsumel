import { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Tag,
  DollarSign,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Columns3,
  Check,
  Trash2,
  Share2,
  Printer,
  FileDown,
  ListOrdered,
  Target,
  Sparkles,
  Building2,
  X,
  Copy,
  LayoutGrid,
  List,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useColumnPrefs } from "@/lib/column-prefs";
import { supabase } from "@/integrations/supabase/client";
import { updateOportunidadeStatus } from "@/lib/oportunidades";
import { campanhasStore } from "@/lib/campanhas-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  brl,
  fmtDate,
  printCampanhaPDF,
  MateriaisViewer,
} from "@/components/campanha-quick-view";
import { CresceVendasDialog } from "@/components/crescevendas-export";
import { DescricaoPrecoDialog } from "@/components/descricao-preco-export";
import { CampanhaChecklist } from "@/components/campanha-checklist";

import {
  type Campanha,
  type Oferta,
  type MaterialApoio,
  CATEGORIAS,
  STATUS,
  statusCampanha,
  statusVariant,
  formatFiliais,
  emptyOferta,
} from "./types";
import { OfertaDialog } from "./oferta-dialog";
import { CampanhaDialog } from "./campanha-dialog";
import { BancoOportunidadesSelectDialog } from "./banco-oportunidades-dialog";
import { BulkDeleteDialog, BulkFiliaisDialog } from "./bulk-actions-dialogs";
import { GondolaGrid } from "./gondola-grid";
import { DuplicarCampanhaDialog } from "./duplicar-campanha-dialog";
import { ImportarOfertasDialog } from "./importar-ofertas-dialog";

interface DetalheProps {
  campanha: Campanha;
  ofertas: Oferta[];
  onBack: () => void;
  onSaveOferta: (o: Oferta) => void;
  onDeleteOferta: (id: string) => void;
  onDeleteOfertas?: (ids: string[]) => void;
  onBulkUpdateOfertas?: (ids: string[], patch: Partial<Oferta>) => void;
  onSaveCampanha?: (c: Campanha) => void;
}

export function CampanhaDetalhe({
  campanha,
  ofertas,
  onBack,
  onSaveOferta,
  onDeleteOferta,
  onDeleteOfertas,
  onBulkUpdateOfertas,
  onSaveCampanha,
}: DetalheProps) {
  const { user } = useAuth();
  const readOnly = !user?.isAdmin || !!user?.readOnly;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fStatus, setFStatus] = useState("todos");
  const [fClube, setFClube] = useState("todos");
  const [fSellout, setFSellout] = useState("todos");
  const [visibleLimit, setVisibleLimit] = useState(60);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 180);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setVisibleLimit(60);
  }, [campanha.id, search, fCategoria, fStatus, fClube, fSellout]);

  // Diálogos de oferta
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Oferta | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [oportunidadesOpen, setOportunidadesOpen] = useState(false);

  // Edição rápida da campanha aberta e de seus anexos
  const [campanhaDialogOpen, setCampanhaDialogOpen] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);

  // Exportações
  const [cvOpen, setCvOpen] = useState(false);
  const [dpOpen, setDpOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  // Modo de visualização: Tabela ou Grade de Gôndola
  const [viewMode, setViewMode] = useState<"table" | "gondola">("table");

  // Duplicar campanha
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const handleDuplicate = (
    origem: Campanha,
    novoNome: string,
    novaDataIni: string,
    novaDataFim: string,
    clonarOfertas: boolean,
    clonarMateriais: boolean
  ) => {
    const newCampId = crypto.randomUUID();
    const novaCamp: Campanha = {
      ...origem,
      id: newCampId,
      nome: novoNome,
      dataInicial: novaDataIni,
      dataFinal: novaDataFim,
      status: "Rascunho",
      materiais: clonarMateriais ? [...origem.materiais] : [],
      checklist: (origem.checklist || []).map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        status: "Pendente",
      })),
    };

    campanhasStore.setCampanhas((prev) => [novaCamp, ...prev]);

    if (clonarOfertas) {
      const ofertasOrigem = ofertas.filter((o) => o.campanhaId === origem.id);
      const novasOfertas: Oferta[] = ofertasOrigem.map((o) => ({
        ...o,
        id: crypto.randomUUID(),
        campanhaId: newCampId,
        dataInicial: novaDataIni,
        dataFinal: novaDataFim,
      }));
      campanhasStore.setOfertas((prev) => [...novasOfertas, ...prev]);
    }

    toast.success(`Campanha "${novoNome}" duplicada com sucesso!`);
  };

  // Seleção em lote (Bulk Actions)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkFiliaisDialogOpen, setBulkFiliaisDialogOpen] = useState(false);

  const openEditCampanha = () => {
    setEditingCampanha({ ...campanha });
    setCampanhaDialogOpen(true);
  };

  const handleSaveCampanha = () => {
    if (!editingCampanha) return;
    if (!editingCampanha.nome.trim()) {
      toast.error("Informe o nome da campanha.");
      return;
    }
    if (onSaveCampanha) {
      onSaveCampanha(editingCampanha);
    } else {
      campanhasStore.setCampanhas((prev) =>
        prev.map((c) => (c.id === editingCampanha.id ? editingCampanha : c))
      );
    }
    toast.success("Campanha atualizada.");
    setCampanhaDialogOpen(false);
    setEditingCampanha(null);
  };

  const handleSaveWithMateriais = (m: MaterialApoio[]) => {
    if (!editingCampanha) return;
    const updated = { ...editingCampanha, materiais: m };
    if (onSaveCampanha) {
      onSaveCampanha(updated);
    } else {
      campanhasStore.setCampanhas((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
    }
    setEditingCampanha(updated);
  };

  const COLUMNS: { key: string; label: string }[] = [
    { key: "codigo", label: "Código" },
    { key: "gtin", label: "Código de barras" },
    { key: "descricao", label: "Descrição" },
    { key: "precoNormal", label: "Preço Normal" },
    { key: "precoPromocional", label: "Preço Promo" },
    { key: "desconto", label: "% Desconto" },
    { key: "mecanica", label: "Condição" },
    { key: "clubeSumel", label: "Clube" },
    { key: "sellout", label: "Sell Out" },
    { key: "dataInicial", label: "Início" },
    { key: "dataFinal", label: "Fim" },
    { key: "filiais", label: "Filial" },
    { key: "corredor", label: "Corredor" },
    { key: "estoque", label: "Estoque" },
    { key: "margem", label: "Margem" },
    { key: "status", label: "Status" },
  ];

  const { isVisible, toggle } = useColumnPrefs(
    "campanhas.ofertas",
    COLUMNS.map((c) => c.key),
    { filiais: false }
  );
  const visibleCount = COLUMNS.filter((c) => isVisible(c.key)).length + 2; // +Checkbox +Ações

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ofertas.filter((o) => {
      if (
        q &&
        ![o.codigo, o.descricao, o.fornecedor, o.gtin].some((f) =>
          f?.toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      if (fCategoria !== "todas" && o.categoria !== fCategoria) return false;
      if (fStatus !== "todos" && o.status !== fStatus) return false;
      if (fClube === "sim" && !o.clubeSumel) return false;
      if (fClube === "nao" && o.clubeSumel) return false;
      if (fSellout === "com" && !o.selloutTemVerba) return false;
      if (fSellout === "sem" && o.selloutTemVerba) return false;
      return true;
    });
  }, [ofertas, search, fCategoria, fStatus, fClube, fSellout]);

  const visibleOfertas = useMemo(
    () => filtered.slice(0, visibleLimit),
    [filtered, visibleLimit]
  );

  const selloutStats = useMemo(() => {
    const comVerba = ofertas.filter((o) => o.selloutTemVerba);
    const total = comVerba.reduce((s, o) => s + (Number(o.selloutValor) || 0), 0);
    return { qtd: comVerba.length, total };
  }, [ofertas]);

  const openNew = () => {
    setEditing(emptyOferta(campanha));
    setIsNew(true);
    setDialogOpen(true);
  };

  const openEdit = (o: Oferta) => {
    setEditing({ ...o });
    setIsNew(false);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.codigo.trim() || !editing.descricao.trim()) {
      toast.error("Preencha código e descrição.");
      return;
    }
    if (editing.precoPromocional <= 0) {
      toast.error("Informe um preço promocional válido.");
      return;
    }
    if (
      editing.tipoPromocao !== "simples" &&
      (!editing.quantidadeMinima || editing.quantidadeMinima < 2)
    ) {
      toast.error(
        "Para promoções de atacado ou combo, a quantidade mínima deve ser de pelo menos 2 unidades."
      );
      return;
    }

    if (isNew) {
      const campStatus = statusCampanha(campanha);
      const isPublicada = campStatus === "Ativa" || campStatus === "Programada";
      const { data: op } = await supabase
        .from("oportunidades" as any)
        .select("id")
        .eq("gtin", editing.gtin)
        .eq("status", "Disponível")
        .maybeSingle();
      if (op && (op as any).id) {
        await updateOportunidadeStatus(
          (op as any).id,
          isPublicada ? "Utilizada" : "Reservada",
          campanha.id
        );
      }
    }

    onSaveOferta(editing);
    toast.success("Oferta salva.");
    if (isNew) {
      setEditing(emptyOferta(campanha));
    } else {
      setDialogOpen(false);
      setEditing(null);
    }
  };

  const printPDF = () => {
    printCampanhaPDF(campanha, filtered);
    toast.success("PDF aberto em nova aba.");
  };

  // Funções de Seleção em Lote
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id));
  const someFilteredSelected =
    filtered.some((o) => selectedIds.has(o.id)) && !allFilteredSelected;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      filtered.forEach((o) => next.delete(o.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filtered.forEach((o) => next.add(o.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedIds);
    if (onDeleteOfertas) {
      onDeleteOfertas(ids);
    } else {
      for (const id of ids) {
        onDeleteOferta(id);
      }
    }
    toast.success(`${ids.length} oferta(s) excluída(s).`);
    clearSelection();
    setBulkDeleteDialogOpen(false);
  };

  const handleBulkFiliaisApply = (filiais: string[]) => {
    const ids = Array.from(selectedIds);
    if (onBulkUpdateOfertas) {
      onBulkUpdateOfertas(ids, { filiais });
    } else {
      campanhasStore.setOfertas((prev) =>
        prev.map((o) => (selectedIds.has(o.id) ? { ...o, filiais } : o))
      );
    }
    toast.success(`Filiais atualizadas para ${ids.length} oferta(s).`);
    clearSelection();
  };

  const handleBulkClubeApply = (clubeSumel: boolean) => {
    const ids = Array.from(selectedIds);
    if (onBulkUpdateOfertas) {
      onBulkUpdateOfertas(ids, { clubeSumel });
    } else {
      campanhasStore.setOfertas((prev) =>
        prev.map((o) => (selectedIds.has(o.id) ? { ...o, clubeSumel } : o))
      );
    }
    toast.success(
      `Marcação Clube Sumel ${clubeSumel ? "ativada" : "desativada"} para ${ids.length} oferta(s).`
    );
    clearSelection();
  };

  return (
    <div>
      {/* Breadcrumb de navegação */}
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 hover:text-primary transition-colors font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Campanhas
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-navy font-semibold truncate max-w-[320px]">{campanha.nome}</span>
      </div>

      {/* Header Compacto estilo Fluent Command Bar */}
      <div className="rounded-lg fluent-card p-3.5 sm:p-4 mb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-navy">
                {campanha.nome}
              </h1>
              <Badge
                variant="outline"
                className={`${statusVariant[statusCampanha(campanha)]} text-[11px] font-medium py-0.5 px-2`}
              >
                {statusCampanha(campanha)}
              </Badge>
              {campanha.clubeSumel && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0.5 px-1.5">
                  Clube Sumel
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                {fmtDate(campanha.dataInicial)} → {fmtDate(campanha.dataFinal)}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="flex items-center gap-1" title={formatFiliais(campanha.filiais)}>
                <MapPin className="h-3.5 w-3.5 text-primary/70" />
                <span className="max-w-[350px] truncate">{formatFiliais(campanha.filiais)}</span>
              </span>
              {campanha.descricao && (
                <>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="truncate max-w-[300px]">{campanha.descricao}</span>
                </>
              )}
            </div>
          </div>

          {/* Ações do Header */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 rounded-md text-xs font-medium">
                  <Share2 className="mr-1.5 h-3.5 w-3.5" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs">Exportar campanha</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={printPDF} className="text-xs">
                  <Printer className="mr-2 h-3.5 w-3.5" /> Imprimir PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCvOpen(true)} className="text-xs">
                  <FileDown className="mr-2 h-3.5 w-3.5" /> CresceVendas (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDpOpen(true)} className="text-xs">
                  <ListOrdered className="mr-2 h-3.5 w-3.5" /> Descrição + Preço
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!readOnly && (
              <>
                <div className="hidden sm:block h-5 w-px bg-border/80 mx-0.5" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDuplicateOpen(true)}
                  className="h-8 rounded-md text-xs font-medium border-border/80 hover:bg-muted/50"
                  title="Duplicar esta campanha e ofertas"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5 text-navy" /> Duplicar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openEditCampanha}
                  className="h-8 rounded-md text-xs font-medium border-border/80 hover:bg-muted/50"
                  title="Editar campanha e anexar arquivos"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOportunidadesOpen(true)}
                  className="h-8 rounded-md text-xs font-medium border-primary/20 text-primary hover:bg-primary/5"
                >
                  <Target className="mr-1.5 h-3.5 w-3.5" /> Oportunidades
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportarOpen(true)}
                  className="h-8 rounded-md text-xs font-medium border-border/80 hover:bg-muted/50"
                  title="Importar ofertas colando texto (código interno;preço normal;preço promo)"
                >
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-navy" /> Colar / Importar
                </Button>
                <div className="hidden sm:block h-5 w-px bg-border/80 mx-0.5" />
                <Button
                  size="sm"
                  onClick={openNew}
                  className="h-8 rounded-md text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova Oferta
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Resumo da Campanha e Checklist integrados lado a lado */}
      <div className="grid gap-2.5 lg:grid-cols-12 mb-3">
        {/* KPIs */}
        <div className="lg:col-span-7 xl:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Card 1: Sellout */}
          <div className="rounded-lg fluent-card p-3 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5 text-primary" /> Verba Sell Out
            </div>
            <div className="mt-1.5">
              <div className="text-lg sm:text-xl font-bold tracking-tight tabular-nums text-navy">
                {brl(selloutStats.total)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                A cobrar dos fornecedores
              </div>
            </div>
          </div>

          {/* Card 2: Ofertas */}
          <div className="rounded-lg fluent-card p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-navy" /> Ofertas
              </span>
              {selloutStats.qtd > 0 && (
                <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded font-medium">
                  {selloutStats.qtd} c/ verba
                </span>
              )}
            </div>
            <div className="mt-1.5">
              <div className="text-lg sm:text-xl font-bold tracking-tight tabular-nums text-navy">
                {ofertas.length}{" "}
                <span className="text-xs font-normal text-muted-foreground">produtos</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {selloutStats.qtd === 0 ? "Nenhuma com verba" : `${selloutStats.qtd} com verba`}
              </div>
            </div>
          </div>

          {/* Card 3: Anexos */}
          <div
            onClick={!readOnly ? openEditCampanha : undefined}
            className={`rounded-lg p-3 flex flex-col justify-between ${
              !readOnly ? "fluent-card-interactive cursor-pointer hover:border-primary/40 group" : "fluent-card"
            }`}
            title={!readOnly ? "Clique para gerenciar ou anexar arquivos" : undefined}
          >
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-primary" /> Anexos
              </span>
              {!readOnly && (
                <span className="text-[9px] text-primary group-hover:underline font-normal lowercase flex items-center gap-0.5">
                  <Pencil className="h-2.5 w-2.5" /> gerenciar
                </span>
              )}
            </div>
            <div className="mt-1.5">
              <div className="text-lg sm:text-xl font-bold tracking-tight text-navy">
                {campanha.materiais.length}{" "}
                <span className="text-xs font-normal text-muted-foreground">anexo(s)</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {!readOnly ? "Clique para gerenciar" : "Materiais de apoio"}
              </div>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="lg:col-span-5 xl:col-span-4">
          <CampanhaChecklist campanha={campanha} className="h-full" />
        </div>
      </div>

      {/* Seção de Anexos */}
      {campanha.materiais.length > 0 ? (
        <MateriaisViewer
          materiais={campanha.materiais}
          onGerenciar={!readOnly ? openEditCampanha : undefined}
        />
      ) : !readOnly ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/40 p-2 px-3.5 mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate text-[11px]">
              Nenhum material de apoio anexado nesta campanha.
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openEditCampanha}
            className="h-6 text-[11px] text-primary hover:bg-primary/5 px-2 shrink-0 font-medium"
          >
            <Plus className="h-3 w-3 mr-1" /> Anexar
          </Button>
        </div>
      ) : null}

      {/* Filtros e Busca (Command Bar Fluent) */}
      <div className="mb-3 rounded-lg fluent-toolbar p-2 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, descrição ou fornecedor..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 h-8 text-xs rounded-md border-border/70 bg-background w-full fluent-input"
          />
        </div>
        <Select value={fCategoria} onValueChange={setFCategoria}>
          <SelectTrigger className="h-8 rounded-md border-border/70 bg-background text-xs w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="h-8 rounded-md border-border/70 bg-background text-xs w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fClube} onValueChange={setFClube}>
          <SelectTrigger className="h-8 rounded-md border-border/70 bg-background text-xs w-full sm:w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Clube: Todos</SelectItem>
            <SelectItem value="sim">Somente Clube</SelectItem>
            <SelectItem value="nao">Sem Clube</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fSellout} onValueChange={setFSellout}>
          <SelectTrigger className="h-8 rounded-md border-border/70 bg-background text-xs w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Sell Out: Todos</SelectItem>
            <SelectItem value="com">Com verba</SelectItem>
            <SelectItem value="sem">Sem verba</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-md border-border/70 text-xs w-full sm:w-auto px-2.5"
            >
              <Columns3 className="h-3.5 w-3.5 mr-1.5" /> Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">Colunas visíveis</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNS.map((col) => {
              const on = isVisible(col.key);
              return (
                <DropdownMenuItem
                  key={col.key}
                  onSelect={(e) => {
                    e.preventDefault();
                    toggle(col.key);
                  }}
                  className="flex items-center justify-between cursor-pointer text-xs"
                >
                  <span>{col.label}</span>
                  {on && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Alternador de Modo de Visualização (Segmented Fluent) */}
        <div className="flex items-center rounded-md border border-border/70 bg-muted/40 p-0.5 shrink-0 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={
              viewMode === "table"
                ? "h-7 px-2.5 text-xs gap-1.5 rounded-sm bg-card text-navy shadow-xs hover:bg-card font-semibold"
                : "h-7 px-2.5 text-xs gap-1.5 rounded-sm text-muted-foreground"
            }
            onClick={() => setViewMode("table")}
            title="Visualização em Tabela detalhada"
          >
            <List className="h-3.5 w-3.5" /> Tabela
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={
              viewMode === "gondola"
                ? "h-7 px-2.5 text-xs gap-1.5 rounded-sm bg-card text-navy shadow-xs hover:bg-card font-semibold"
                : "h-7 px-2.5 text-xs gap-1.5 rounded-sm text-muted-foreground"
            }
            onClick={() => setViewMode("gondola")}
            title="Visualização em Grade de Gôndola (Cards promocionais)"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-primary" /> Grade Visual
          </Button>
        </div>
      </div>

      {/* BARRA DE AÇÕES EM LOTE (Fluent InfoBar leve) */}
      {selectedIds.size > 0 && !readOnly && (
        <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold tabular-nums">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-navy">
              {selectedIds.size === 1
                ? "1 oferta selecionada"
                : `${selectedIds.size} ofertas selecionadas`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-1.5"
            >
              <X className="h-3 w-3 mr-1" /> Desmarcar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkFiliaisDialogOpen(true)}
              className="h-7 rounded-md text-xs bg-card hover:bg-muted"
            >
              <Building2 className="mr-1.5 h-3.5 w-3.5 text-primary" /> Filiais em lote
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 rounded-md text-xs bg-card hover:bg-muted">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-500" /> Clube Sumel
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleBulkClubeApply(true)}
                  className="text-xs cursor-pointer"
                >
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-600" /> Marcar como Clube Sumel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleBulkClubeApply(false)}
                  className="text-xs cursor-pointer text-muted-foreground"
                >
                  <X className="mr-2 h-3.5 w-3.5" /> Remover do Clube Sumel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteDialogOpen(true)}
              className="h-7 rounded-md text-xs"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir selecionadas
            </Button>
          </div>
        </div>
      )}

      {/* Visualização de Produtos: Grade de Gôndola OU Tabela */}
      {viewMode === "gondola" ? (
        <GondolaGrid
          ofertas={visibleOfertas}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelectRow}
          onEdit={openEdit}
          onDelete={(id) => setDeleteId(id)}
          readOnly={readOnly}
          onImport={() => setImportarOpen(true)}
        />
      ) : (
        /* Tabela de Produtos (Fluent DataGrid) */
        <div className="overflow-hidden rounded-lg fluent-card">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2 bg-[#F6F8FA]">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-navy uppercase tracking-wider">
                Produtos em oferta
              </h2>
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4">
                  {selectedIds.size} selecionada(s)
                </Badge>
              )}
            </div>
            <span className="rounded-md border border-border/70 bg-card px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {filtered.length} de {ofertas.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/70 bg-[#F6F8FA] hover:bg-[#F6F8FA] [&>th]:h-8 [&>th]:text-[10px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-navy/75">
                  {!readOnly && (
                    <TableHead className="w-9 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someFilteredSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded accent-primary cursor-pointer align-middle"
                        title={allFilteredSelected ? "Desmarcar todas" : "Selecionar todas visíveis"}
                      />
                    </TableHead>
                  )}
                  {isVisible("codigo") && <TableHead>Código</TableHead>}
                  {isVisible("gtin") && <TableHead>Cód. barras</TableHead>}
                  {isVisible("descricao") && <TableHead>Descrição</TableHead>}
                  {isVisible("precoNormal") && <TableHead className="text-right">Normal</TableHead>}
                  {isVisible("precoPromocional") && (
                    <TableHead className="text-right">Promo</TableHead>
                  )}
                  {isVisible("desconto") && <TableHead className="text-center">% Desc.</TableHead>}
                  {isVisible("mecanica") && <TableHead className="text-center">Condição</TableHead>}
                  {isVisible("clubeSumel") && <TableHead className="text-center">Clube</TableHead>}
                  {isVisible("sellout") && <TableHead className="text-right">Sell Out</TableHead>}
                  {isVisible("dataInicial") && <TableHead>Início</TableHead>}
                  {isVisible("dataFinal") && <TableHead>Fim</TableHead>}
                  {isVisible("filiais") && <TableHead>Filial</TableHead>}
                  {isVisible("corredor") && <TableHead>Corredor</TableHead>}
                  {isVisible("estoque") && <TableHead className="text-right">Estoque</TableHead>}
                  {isVisible("margem") && <TableHead className="text-right">Margem</TableHead>}
                  {isVisible("status") && <TableHead>Status</TableHead>}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={visibleCount} className="py-14 text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent">
                        <Tag className="h-5 w-5 text-primary" />
                      </div>
                      <p className="mt-3 text-sm font-medium text-foreground">
                        Nenhuma oferta encontrada
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cadastre produtos nesta campanha ou ajuste os filtros.
                      </p>
                      {!readOnly && (
                        <div className="mt-4 flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setImportarOpen(true)}
                            className="text-xs font-medium rounded-md"
                          >
                            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-navy" /> Colar / Importar Ofertas
                          </Button>
                          <Button
                            size="sm"
                            onClick={openNew}
                            className="text-xs font-medium rounded-md bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova Oferta
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleOfertas.map((o) => {
                    const isSelected = selectedIds.has(o.id);
                    const desconto =
                      o.precoNormal > 0 &&
                      o.precoPromocional > 0 &&
                      o.precoPromocional < o.precoNormal
                        ? Math.round((1 - o.precoPromocional / o.precoNormal) * 100)
                        : 0;

                    return (
                      <TableRow
                        key={o.id}
                        className={`fluent-row-item group border-border/60 transition-colors duration-100 ${
                          isSelected
                            ? "bg-primary/[0.06] hover:bg-primary/[0.09] shadow-[inset_3px_0_0_0_var(--color-primary)]"
                            : "hover:bg-muted/45"
                        }`}
                      >
                        {!readOnly && (
                          <TableCell className="w-9 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(o.id)}
                              className="h-4 w-4 rounded accent-primary cursor-pointer align-middle"
                            />
                          </TableCell>
                        )}
                        {isVisible("codigo") && (
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {o.codigo}
                          </TableCell>
                        )}
                        {isVisible("gtin") && (
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {o.gtin}
                          </TableCell>
                        )}
                        {isVisible("descricao") && (
                          <TableCell className="max-w-[260px] truncate font-medium text-navy">
                            {o.descricao}
                          </TableCell>
                        )}
                        {isVisible("precoNormal") && (
                          <TableCell className="text-right text-muted-foreground line-through tabular-nums text-xs">
                            {brl(o.precoNormal)}
                          </TableCell>
                        )}
                        {isVisible("precoPromocional") && (
                          <TableCell
                            className="text-right font-bold tabular-nums text-primary text-xs"
                            title={
                              o.tipoPromocao === "a_partir_de"
                                ? `A partir de ${o.quantidadeMinima} un: ${brl(o.precoPromocional)} cada`
                                : o.tipoPromocao === "a_cada"
                                ? `A cada ${o.quantidadeMinima} un (${o.quantidadeMinima} por ${brl(o.quantidadeMinima * o.precoPromocional)})`
                                : undefined
                            }
                          >
                            {brl(o.precoPromocional)}
                          </TableCell>
                        )}
                        {isVisible("desconto") && (
                          <TableCell className="text-center">
                            {desconto > 0 ? (
                              <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                                -{desconto}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                        )}
                        {isVisible("mecanica") && (
                          <TableCell className="text-center">
                            {o.tipoPromocao === "a_partir_de" ? (
                              <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap">
                                A partir de {o.quantidadeMinima} un
                              </span>
                            ) : o.tipoPromocao === "a_cada" ? (
                              <span
                                className="inline-flex items-center rounded-full bg-purple-500/10 text-purple-700 border border-purple-500/20 px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                                title={`${o.quantidadeMinima} un por ${brl(o.quantidadeMinima * o.precoPromocional)}`}
                              >
                                A cada {o.quantidadeMinima} un
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap">
                                Preço direto
                              </span>
                            )}
                          </TableCell>
                        )}
                        {isVisible("clubeSumel") && (
                          <TableCell className="text-center">
                            {o.clubeSumel ? (
                              <Badge className="bg-primary/10 text-primary border-primary/20">
                                <Tag className="h-3 w-3 mr-1" /> Sim
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">Não</span>
                            )}
                          </TableCell>
                        )}
                        {isVisible("sellout") && (
                          <TableCell className="text-right">
                            {o.selloutTemVerba ? (
                              <div className="flex flex-col items-end leading-tight">
                                <span className="font-semibold tabular-nums text-navy">
                                  {brl(o.selloutValor)}
                                </span>
                                {o.selloutFornecedor && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {o.selloutFornecedor}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        )}
                        {isVisible("dataInicial") && (
                          <TableCell className="text-xs text-muted-foreground">
                            {fmtDate(o.dataInicial)}
                          </TableCell>
                        )}
                        {isVisible("dataFinal") && (
                          <TableCell className="text-xs text-muted-foreground">
                            {fmtDate(o.dataFinal)}
                          </TableCell>
                        )}
                        {isVisible("filiais") && (
                          <TableCell className="text-xs text-muted-foreground">
                            {o.filiais?.length ? formatFiliais(o.filiais) : "—"}
                          </TableCell>
                        )}
                        {isVisible("corredor") && (
                          <TableCell className="text-xs text-muted-foreground">
                            {o.corredor || "—"}
                          </TableCell>
                        )}
                        {isVisible("estoque") && (
                          <TableCell className="text-right tabular-nums">{o.estoque}</TableCell>
                        )}
                        {isVisible("margem") && (
                          <TableCell className="text-right tabular-nums">
                            {o.margem.toFixed(1)}%
                          </TableCell>
                        )}
                        {isVisible("status") && (
                          <TableCell>
                            <Badge variant="outline" className={statusVariant[o.status]}>
                              {o.status}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-right whitespace-nowrap">
                          {readOnly ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="inline-flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full hover:bg-navy/10"
                                onClick={() => openEdit(o)}
                                title="Editar oferta"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full hover:bg-destructive/10"
                                onClick={() => setDeleteId(o.id)}
                                title="Excluir oferta"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Paginação incremental para manter DOM leve em campanhas grandes */}
      {filtered.length > visibleOfertas.length && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg fluent-toolbar px-3.5 py-2 text-xs">
          <span className="text-muted-foreground">
            Exibindo <strong className="text-navy tabular-nums">{visibleOfertas.length}</strong> de{" "}
            <strong className="text-navy tabular-nums">{filtered.length}</strong> ofertas
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-md text-xs"
              onClick={() => setVisibleLimit((prev) => prev + 60)}
            >
              Carregar mais (+60)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-md text-xs text-primary hover:text-primary"
              onClick={() => setVisibleLimit(filtered.length)}
            >
              Mostrar todas ({filtered.length})
            </Button>
          </div>
        </div>
      )}

      {/* Modais montados sob demanda para economizar memória e renderizações */}
      {dialogOpen && (
        <OfertaDialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setEditing(null);
          }}
          oferta={editing}
          setOferta={setEditing}
          onSave={save}
          filiaisPermitidas={campanha.filiais ?? []}
        />
      )}

      {campanhaDialogOpen && (
        <CampanhaDialog
          open={campanhaDialogOpen}
          onOpenChange={(v) => {
            setCampanhaDialogOpen(v);
            if (!v) setEditingCampanha(null);
          }}
          campanha={editingCampanha}
          setCampanha={setEditingCampanha}
          onSave={handleSaveCampanha}
          onSaveWithMateriais={handleSaveWithMateriais}
        />
      )}

      {cvOpen && (
        <CresceVendasDialog
          campanha={campanha}
          ofertas={filtered}
          open={cvOpen}
          onOpenChange={setCvOpen}
        />
      )}

      {dpOpen && (
        <DescricaoPrecoDialog
          campanha={campanha}
          ofertas={filtered}
          open={dpOpen}
          onOpenChange={setDpOpen}
        />
      )}

      {oportunidadesOpen && (
        <BancoOportunidadesSelectDialog
          open={oportunidadesOpen}
          onOpenChange={setOportunidadesOpen}
          onSelect={(o) => {
            const novaOferta: Oferta = {
              ...emptyOferta(campanha),
              codigo: o.codigo_interno || "",
              gtin: o.gtin || "",
              descricao: o.descricao,
              custo: o.custo,
              precoNormal: o.preco_venda,
              precoPromocional: o.preco_venda,
            };
            setEditing(novaOferta);
            setIsNew(true);
            setDialogOpen(true);
            setOportunidadesOpen(false);
          }}
        />
      )}

      {/* Confirmação de exclusão unitária */}
      {!!deleteId && (
        <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir oferta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não poderá ser desfeita. Se esta oferta tiver sido importada do Banco de
                Oportunidades, ela voltará a ficar disponível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteId) {
                    onDeleteOferta(deleteId);
                    toast.success("Oferta excluída.");
                    setDeleteId(null);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Confirmação de exclusão em lote */}
      {bulkDeleteDialogOpen && (
        <BulkDeleteDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          count={selectedIds.size}
          onConfirm={handleBulkDeleteConfirm}
        />
      )}

      {/* Aplicação de Filiais em lote */}
      {bulkFiliaisDialogOpen && (
        <BulkFiliaisDialog
          open={bulkFiliaisDialogOpen}
          onOpenChange={setBulkFiliaisDialogOpen}
          count={selectedIds.size}
          filiaisPermitidas={campanha.filiais ?? []}
          onApply={handleBulkFiliaisApply}
        />
      )}

      {/* Duplicação de Campanha */}
      {duplicateOpen && (
        <DuplicarCampanhaDialog
          open={duplicateOpen}
          onOpenChange={setDuplicateOpen}
          campanha={campanha}
          ofertasCount={ofertas.length}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* Importação de Ofertas em Lote */}
      {importarOpen && (
        <ImportarOfertasDialog
          campanha={campanha}
          open={importarOpen}
          onOpenChange={setImportarOpen}
        />
      )}
    </div>
  );
}
