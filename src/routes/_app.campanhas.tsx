import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus, Search, Pencil, Trash2, Printer, Tag, ArrowLeft, Calendar, Package, ChevronRight,
  Paperclip, Upload, FileText, Image as ImageIcon, X, DollarSign, Columns3, Check, Eye, FileDown, ListOrdered, Share2, Target, Camera,
  LayoutGrid, List, ArrowUpDown, MapPin, Boxes, Repeat, Sparkles
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useColumnPrefs } from "@/lib/column-prefs";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { GeradorCartazesDialog } from "@/components/gerador-cartazes-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ProductSearch } from "@/components/product-search";
import { type Produto } from "@/lib/produtos";


export const Route = createFileRoute("/_app/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — Central de Campanhas Sumel" },
      { name: "description", content: "Gerencie campanhas e suas ofertas comerciais na Central de Campanhas Sumel." },
      { property: "og:title", content: "Campanhas — Central de Campanhas Sumel" },
      { property: "og:description", content: "Gerencie campanhas e ofertas na Central de Campanhas Sumel." },
    ],
  }),
  component: CampanhasModulo,
});

import {
  type Status,
  type MaterialApoio,
  type Campanha,
  type Oferta,
  type TipoPromocaoOferta,
  getMecanicaLabel,
  fmtCondicaoOferta,
  useCampanhasStore,
  campanhasStore,
  categoriaCampanha,
  statusCampanha,
  formatFiliais,
} from "@/lib/campanhas-store";

const CATEGORIAS = ["Bebidas", "Mercearia", "Higiene", "Limpeza", "Frios", "Padaria", "Hortifruti"];
const FORNECEDORES = ["Ambev", "Nestlé", "Unilever", "P&G", "Coca-Cola", "BRF", "JBS"];
const FILIAIS = ["Matriz", "Filial Esteio", "Filial Sapucaia", "Filial São Leopoldo"];
const STATUS: Status[] = ["Ativa", "Programada", "Encerrada", "Rascunho"];

const emptyCampanha = (): Campanha => ({
  id: crypto.randomUUID(), nome: "", descricao: "", dataInicial: "", dataFinal: "", status: "Rascunho", filiais: [], clubeSumel: false, materiais: [],
  checklist: [
    { id: "c1", task: "Coletar produtos", status: "Pendente" },
    { id: "c2", task: "Precificar ofertas", status: "Pendente" },
    { id: "c3", task: "Cadastrar no Sistema", status: "Pendente" },
    { id: "c4", task: "Fazer cartazes para impressão", status: "Pendente" },
    { id: "c5", task: "Criar encarte digital", status: "Pendente" },
  ],
});

const emptyOferta = (campanha: Campanha): Oferta => ({
  id: crypto.randomUUID(), campanhaId: campanha.id, codigo: "", gtin: "", gtinsCresceVendas: "", descricao: "",
  fornecedor: FORNECEDORES[0], categoria: CATEGORIAS[0],
  precoNormal: 0, custo: 0, precoPromocional: 0,
  tipoPromocao: "simples", quantidadeMinima: 1,
  clubeSumel: campanha.clubeSumel ?? false,
  dataInicial: campanha.dataInicial, dataFinal: campanha.dataFinal,
  filiais: [...(campanha.filiais ?? [])], corredor: "", estoque: 0, margem: 0, status: statusCampanha(campanha),
  selloutTemVerba: false, selloutFornecedor: "", selloutValor: 0, selloutObs: "",
});


const statusVariant: Record<Status, string> = {
  Ativa: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Programada: "bg-blue-100 text-blue-700 border-blue-200",
  Encerrada: "bg-slate-200 text-slate-700 border-slate-300",
  Rascunho: "bg-amber-100 text-amber-700 border-amber-200",
};

import {
  brl, fmtDate, printCampanhaPDF, MateriaisViewer, CampanhaQuickView,
} from "@/components/campanha-quick-view";
import { CresceVendasDialog } from "@/components/crescevendas-export";
import { DescricaoPrecoDialog } from "@/components/descricao-preco-export";
import { 
  listOportunidades, updateOportunidadeStatus, 
  type Oportunidade, type OportunidadePrioridade, type OportunidadeStatus 
} from "@/lib/oportunidades";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { CampanhaChecklist } from "@/components/campanha-checklist";






function CampanhasModulo() {
  const { campanhas, ofertas } = useCampanhasStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // As campanhas são filtradas e ordenadas em CampanhasList
  const visiveis = campanhas;

  const selected = campanhas.find((c) => c.id === selectedId) ?? null;

  const saveOferta = (o: Oferta) =>
    campanhasStore.setOfertas((prev) => {
      const exists = prev.some((p) => p.id === o.id);
      return exists ? prev.map((p) => (p.id === o.id ? o : p)) : [o, ...prev];
    });

  const deleteOferta = async (id: string) => {
    const o = ofertas.find(off => off.id === id);
    if (o) {
      // Se era de uma oportunidade, volta para Disponível
      const { data } = await supabase.from('oportunidades' as any).select('id').eq('gtin', o.gtin).eq('campanha_id', o.campanhaId).maybeSingle();
      if (data && (data as any).id) {
        await updateOportunidadeStatus((data as any).id, 'Disponível', null);
      }
    }
    campanhasStore.setOfertas((prev) => prev.filter((p) => p.id !== id));
  };

  const saveCampanha = (c: Campanha) =>
    campanhasStore.setCampanhas((prev) => {
      const exists = prev.some((p) => p.id === c.id);
      return exists ? prev.map((p) => (p.id === c.id ? c : p)) : [c, ...prev];
    });

  const deleteCampanha = (id: string) => {
    campanhasStore.setCampanhas((prev) => prev.filter((p) => p.id !== id));
    campanhasStore.setOfertas((prev) => prev.filter((o) => o.campanhaId !== id));
  };

  return selected ? (
    <CampanhaDetalhe
      campanha={selected}
      ofertas={ofertas.filter((o) => o.campanhaId === selected.id)}
      onBack={() => setSelectedId(null)}
      onSaveOferta={saveOferta}
      onDeleteOferta={deleteOferta}
      onSaveCampanha={saveCampanha}
    />
  ) : (
    <CampanhasList
      campanhas={visiveis}
      ofertas={ofertas}
      onOpen={setSelectedId}
      onSave={saveCampanha}
      onDelete={deleteCampanha}
    />
  );
}


// ============ CAMPANHAS LIST ============

interface ListProps {
  campanhas: Campanha[];
  ofertas: Oferta[];
  onOpen: (id: string) => void;
  onSave: (c: Campanha) => void;
  onDelete: (id: string) => void;
}

function CampanhasList({ campanhas, ofertas, onOpen, onSave, onDelete }: ListProps) {
  const { user } = useAuth();
  // Somente administradores podem criar/editar/excluir campanhas e ofertas.
  const readOnly = !user?.isAdmin || !!user?.readOnly;
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("todos");

  // Visualização e Ordenação
  const [viewMode, setViewModeLocal] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("campanhas.viewMode") as "grid" | "list") || "grid";
    }
    return "grid";
  });
  const setViewMode = (mode: "grid" | "list") => {
    setViewModeLocal(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("campanhas.viewMode", mode);
    }
  };

  const [sortField, setSortField] = useState<"dataInicial" | "dataFinal" | "nome" | "status">("dataInicial");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campanha | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [quickView, setQuickView] = useState<Campanha | null>(null);
  const [cvCampanha, setCvCampanha] = useState<Campanha | null>(null);
  const [dpCampanha, setDpCampanha] = useState<Campanha | null>(null);

  const countByCampanha = useMemo(() => {
    const m = new Map<string, number>();
    ofertas.forEach(o => m.set(o.campanhaId, (m.get(o.campanhaId) ?? 0) + 1));
    return m;
  }, [ofertas]);

  const sortedVisiveis = useMemo(() => {
    return campanhas
      .filter((c) => categoriaCampanha(c) !== "encerrada")
      .filter((c) => user?.isAdmin || user?.canSeeDrafts || statusCampanha(c) !== "Rascunho")
      .slice()
      .sort((a, b) => {
        let valA: string = "";
        let valB: string = "";

        if (sortField === "status") {
          valA = statusCampanha(a);
          valB = statusCampanha(b);
        } else {
          valA = (a[sortField] || "").toString();
          valB = (b[sortField] || "").toString();
        }

        const cmp = valA.localeCompare(valB);
        return sortOrder === "asc" ? cmp : -cmp;
      });
  }, [campanhas, sortField, sortOrder]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedVisiveis
      .filter(c => {
        if (q && !c.nome.toLowerCase().includes(q) && !c.descricao.toLowerCase().includes(q)) return false;
        if (fStatus !== "todos" && statusCampanha(c) !== fStatus) return false;
        return true;
      });
  }, [sortedVisiveis, search, fStatus]);

  const futuras = useMemo(() => filtered.filter((c) => categoriaCampanha(c) === "futura"), [filtered]);
  const ativas = useMemo(() => filtered.filter((c) => categoriaCampanha(c) === "ativa"), [filtered]);
  const rascunhos = useMemo(() => filtered.filter((c) => categoriaCampanha(c) === "rascunho"), [filtered]);

  const openNew = () => { setEditing(emptyCampanha()); setDialogOpen(true); };
  const openEdit = (c: Campanha) => { setEditing({ ...c }); setDialogOpen(true); };

  const saveWithMateriais = (c: Campanha, m: MaterialApoio[]) => {
    const updated = { ...c, materiais: m };
    console.log("[CampanhasList] saveWithMateriais triggered for:", c.id, "with:", m);
    onSave(updated);
    setEditing(updated);
  };


  const save = () => {
    if (!editing) return;
    if (!editing.nome.trim()) { toast.error("Informe o nome da campanha."); return; }
    onSave(editing);
    toast.success("Campanha salva.");
    setDialogOpen(false); setEditing(null);
  };

  const renderCard = (c: Campanha, opts: { destaque?: boolean } = {}) => {
    const count = countByCampanha.get(c.id) ?? 0;
    return (
      <div
        key={c.id}
        className={
          "group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition " +
          (opts.destaque
            ? "border-navy/30 shadow-[0_1px_2px_rgba(11,31,58,0.06)] hover:border-navy/60 hover:shadow-lg"
            : "hover:border-primary/30 hover:shadow-lg")
        }
      >
        <span
          className={
            "absolute inset-x-0 top-0 h-0.5 " + (opts.destaque ? "bg-navy" : "bg-primary/70")
          }
        />
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate font-semibold leading-tight text-navy">{c.nome}</h3>
            <Badge variant="outline" className={`${statusVariant[statusCampanha(c)]} shrink-0`}>
              {statusCampanha(c)}
            </Badge>
          </div>

          <p className="mb-4 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
            {c.descricao || "Sem descrição."}
          </p>

          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {fmtDate(c.dataInicial)} → {fmtDate(c.dataFinal)}
            </span>
            <span className="flex items-center gap-1.5" title={formatFiliais(c.filiais)}>
              <MapPin className="h-3.5 w-3.5 text-red-500" />
              <strong className="text-foreground max-w-[200px] truncate">
                {formatFiliais(c.filiais)}
              </strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-primary" />
              <strong className="text-foreground">{count}</strong> produto{count === 1 ? "" : "s"} em oferta
            </span>
            {c.materiais.length > 0 && (
              <span className="flex items-center gap-1.5" title="Materiais de apoio">
                <Paperclip className="h-3.5 w-3.5" />
                <strong className="text-foreground">{c.materiais.length}</strong> anexo{c.materiais.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-0.5">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Ver produtos e anexos" onClick={() => setQuickView(c)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Imprimir listagem de produtos"
                onClick={() => { printCampanhaPDF(c, ofertas.filter((o) => o.campanhaId === c.id)); toast.success("PDF aberto em nova aba."); }}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Compartilhar / exportar">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Exportar</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCvCampanha(c)}>
                    <FileDown className="mr-2 h-4 w-4" />CresceVendas (.txt)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDpCampanha(c)}>
                    <ListOrdered className="mr-2 h-4 w-4" />Descrição + Preço
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {!readOnly && (
                <>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Editar" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Excluir" onClick={() => setDeleteId(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            <Button size="sm" variant="outline" onClick={() => onOpen(c.id)} className="h-8 shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
              Abrir <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Gerencie as campanhas e ofertas da Central Sumel."
        actions={
          !readOnly ? (
            <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />Nova Campanha
            </Button>
          ) : undefined
        }
      />

      <div className="rounded-xl border bg-card p-4 mb-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar campanha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-full md:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="Ativa">Ativa</SelectItem>
              <SelectItem value="Programada">Programada</SelectItem>
              {(user?.isAdmin || user?.canSeeDrafts) && <SelectItem value="Rascunho">Rascunho</SelectItem>}
            </SelectContent>
          </Select>
          
          <div className="flex items-center rounded-lg border bg-background p-1 shadow-sm">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-3 rounded-md text-xs"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="mr-2 h-3.5 w-3.5" />
              Blocos
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-3 rounded-md text-xs"
              onClick={() => setViewMode("list")}
            >
              <List className="mr-2 h-3.5 w-3.5" />
              Lista
            </Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhuma campanha ativa ou programada.
        </div>
      ) : viewMode === "grid" ? (
        <div className="space-y-6">
          {futuras.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-navy" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-navy">
                  Próximas campanhas
                </h2>
                <span className="text-xs text-muted-foreground">({futuras.length})</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {futuras.map((c) => renderCard(c, { destaque: true }))}
              </div>
            </section>
          )}

          {ativas.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-navy">
                  Campanhas ativas
                </h2>
                <span className="text-xs text-muted-foreground">({ativas.length})</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ativas.map((c) => renderCard(c))}
              </div>
            </section>
          )}

          {rascunhos.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-navy">
                  Rascunhos
                </h2>
                <span className="text-xs text-muted-foreground">({rascunhos.length})</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rascunhos.map((c) => renderCard(c))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/70 bg-navy/[0.04] hover:bg-navy/[0.04] [&>th]:h-10 [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-navy/70">
                  <TableHead className="w-[100px] cursor-pointer" onClick={() => { 
                    if (sortField === 'status') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortField('status'); setSortOrder('asc'); }
                  }}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => { 
                    if (sortField === 'nome') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortField('nome'); setSortOrder('asc'); }
                  }}>
                    <div className="flex items-center gap-1">Nome da campanha <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => { 
                    if (sortField === 'dataInicial') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortField('dataInicial'); setSortOrder('asc'); }
                  }}>
                    <div className="flex items-center gap-1">Início <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => { 
                    if (sortField === 'dataFinal') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortField('dataFinal'); setSortOrder('asc'); }
                  }}>
                    <div className="flex items-center gap-1">Término <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead className="text-center">Filiais</TableHead>
                  <TableHead className="text-center">Produtos</TableHead>
                  <TableHead className="text-center">Anexos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const count = countByCampanha.get(c.id) ?? 0;
                  const status = statusCampanha(c);
                  return (
                    <TableRow key={c.id} className="group border-border/60 transition-colors hover:bg-accent/60">
                      <TableCell>
                        <Badge variant="outline" className={`${statusVariant[status]} shrink-0 text-[10px] py-0 h-5`}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-navy truncate max-w-[200px]">{c.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(c.dataInicial)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(c.dataFinal)}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-[11px] text-muted-foreground truncate max-w-[150px] inline-block align-bottom" title={formatFiliais(c.filiais)}>
                          {formatFiliais(c.filiais)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {count}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-muted-foreground">{c.materiais.length}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Ver produtos e anexos" onClick={() => setQuickView(c)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Imprimir listagem de produtos"
                            onClick={() => { printCampanhaPDF(c, ofertas.filter((o) => o.campanhaId === c.id)); toast.success("PDF aberto em nova aba."); }}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Compartilhar / exportar">
                                <Share2 className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Exportar</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setCvCampanha(c)}>
                                <FileDown className="mr-2 h-4 w-4" />CresceVendas (.txt)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDpCampanha(c)}>
                                <ListOrdered className="mr-2 h-4 w-4" />Descrição + Preço
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {!readOnly && (
                            <>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Editar" onClick={() => openEdit(c)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Excluir" onClick={() => setDeleteId(c.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline" onClick={() => onOpen(c.id)} className="ml-2 h-8 px-2 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground text-xs">
                            Abrir <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}


      <CampanhaDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        campanha={editing}
        setCampanha={setEditing}
        onSave={save}
        onSaveWithMateriais={(m) => editing && saveWithMateriais(editing, m)}
      />


      <CampanhaQuickView
        campanha={quickView}
        ofertas={quickView ? ofertas.filter((o) => o.campanhaId === quickView.id) : []}
        onOpenChange={(v) => { if (!v) setQuickView(null); }}
        onAbrir={(id) => { setQuickView(null); onOpen(id); }}
      />

      {cvCampanha && (
        <CresceVendasDialog
          campanha={cvCampanha}
          ofertas={ofertas.filter((o) => o.campanhaId === cvCampanha.id)}
          open={!!cvCampanha}
          onOpenChange={(v) => { if (!v) setCvCampanha(null); }}
        />
      )}

      {dpCampanha && (
        <DescricaoPrecoDialog
          campanha={dpCampanha}
          ofertas={ofertas.filter((o) => o.campanhaId === dpCampanha.id)}
          open={!!dpCampanha}
          onOpenChange={(v) => { if (!v) setDpCampanha(null); }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>Todas as ofertas vinculadas a esta campanha também serão excluídas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { onDelete(deleteId); toast.success("Campanha excluída."); setDeleteId(null); } }} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// QuickView e geração de PDF vivem em @/components/campanha-quick-view


// ============ CAMPANHA DETALHE (ofertas) ============

interface DetalheProps {
  campanha: Campanha;
  ofertas: Oferta[];
  onBack: () => void;
  onSaveOferta: (o: Oferta) => void;
  onDeleteOferta: (id: string) => void;
  onAddFromOportunidades?: (oferta: Oferta, oportunidadeId: string) => void;
  onSaveCampanha?: (c: Campanha) => void;
}

function CampanhaDetalhe({ campanha, ofertas, onBack, onSaveOferta, onDeleteOferta, onSaveCampanha }: DetalheProps) {
  const { user } = useAuth();
  const readOnly = !user?.isAdmin || !!user?.readOnly;
  const [search, setSearch] = useState("");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fStatus, setFStatus] = useState("todos");
  const [fClube, setFClube] = useState("todos");
  const [fSellout, setFSellout] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Oferta | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [oportunidadesOpen, setOportunidadesOpen] = useState(false);

  // Edição rápida da campanha aberta e de seus anexos
  const [campanhaDialogOpen, setCampanhaDialogOpen] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);

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
    { filiais: false },
  );
  const visibleCount = COLUMNS.filter((c) => isVisible(c.key)).length + 1; // +Ações

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ofertas.filter(o => {
      if (q && ![o.codigo, o.descricao, o.fornecedor].some(f => f.toLowerCase().includes(q))) return false;
      if (fCategoria !== "todas" && o.categoria !== fCategoria) return false;
      if (fStatus !== "todos" && o.status !== fStatus) return false;
      if (fClube === "sim" && !o.clubeSumel) return false;
      if (fClube === "nao" && o.clubeSumel) return false;
      if (fSellout === "com" && !o.selloutTemVerba) return false;
      if (fSellout === "sem" && o.selloutTemVerba) return false;
      return true;
    });
  }, [ofertas, search, fCategoria, fStatus, fClube, fSellout]);

  const selloutStats = useMemo(() => {
    const comVerba = ofertas.filter(o => o.selloutTemVerba);
    const total = comVerba.reduce((s, o) => s + (Number(o.selloutValor) || 0), 0);
    return { qtd: comVerba.length, total };
  }, [ofertas]);

  const openNew = () => { setEditing(emptyOferta(campanha)); setIsNew(true); setDialogOpen(true); };
  const openEdit = (o: Oferta) => { setEditing({ ...o }); setIsNew(false); setDialogOpen(true); };

  const save = async () => {
    if (!editing) return;
    if (!editing.codigo.trim() || !editing.descricao.trim()) { toast.error("Preencha código e descrição."); return; }
    if (editing.precoPromocional <= 0) {
      toast.error("Informe um preço promocional válido.");
      return;
    }
    if (editing.tipoPromocao !== "simples" && (!editing.quantidadeMinima || editing.quantidadeMinima < 2)) {
      toast.error("Para promoções de atacado ou combo, a quantidade mínima deve ser de pelo menos 2 unidades.");
      return;
    }
    
    // Se a campanha for Rascunho, e a oferta vier de uma oportunidade, o status da oportunidade deve ser Reservada.
    // Se a campanha não for Rascunho (Ativa/Programada), o status deve ser Utilizada.
    // Mas a lógica do sistema diz que "ao finalizar/publicar" vira Utilizada.
    // Na prática, vamos marcar como Utilizada se o status da campanha for Ativa ou Programada.
    if (isNew) {
      const campStatus = statusCampanha(campanha);
      const isPublicada = campStatus === 'Ativa' || campStatus === 'Programada';
      const { data: op } = await supabase.from('oportunidades' as any).select('id').eq('gtin', editing.gtin).eq('status', 'Disponível').maybeSingle();
      if (op && (op as any).id) {
        await updateOportunidadeStatus((op as any).id, isPublicada ? 'Utilizada' : 'Reservada', campanha.id);
      }
    }

    onSaveOferta(editing);
    toast.success("Oferta salva.");
    if (isNew) {
      // Reabre com nova oferta em branco para cadastro contínuo
      setEditing(emptyOferta(campanha));
    } else {
      setDialogOpen(false);
      setEditing(null);
    }
  };

  const [cvOpen, setCvOpen] = useState(false);
  const [dpOpen, setDpOpen] = useState(false);
  const [cartazOpen, setCartazOpen] = useState(false);

  const printPDF = () => {
    printCampanhaPDF(campanha, filtered);
    toast.success("PDF aberto em nova aba.");
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

      {/* Header Compacto e Moderno */}
      <div className="rounded-xl border border-border/60 bg-card p-3.5 sm:p-4 mb-3 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-navy">{campanha.nome}</h1>
              <Badge variant="outline" className={`${statusVariant[statusCampanha(campanha)]} text-[11px] font-medium py-0.5 px-2`}>
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
                <span className="max-w-[260px] truncate">{formatFiliais(campanha.filiais)}</span>
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
                <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
                  <Share2 className="mr-1.5 h-3.5 w-3.5" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs">Exportar campanha</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={printPDF} className="text-xs"><Printer className="mr-2 h-3.5 w-3.5" />Imprimir PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCartazOpen(true)} className="text-xs"><ImageIcon className="mr-2 h-3.5 w-3.5" />Gerar Cartazes</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCvOpen(true)} className="text-xs"><FileDown className="mr-2 h-3.5 w-3.5" />CresceVendas (.txt)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDpOpen(true)} className="text-xs"><ListOrdered className="mr-2 h-3.5 w-3.5" />Descrição + Preço</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!readOnly && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openEditCampanha}
                  className="h-8 text-xs font-medium border-border/80 hover:bg-muted/50"
                  title="Editar campanha e anexar arquivos"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOportunidadesOpen(true)}
                  className="h-8 text-xs font-medium border-primary/20 text-primary hover:bg-primary/5"
                >
                  <Target className="mr-1.5 h-3.5 w-3.5" /> Oportunidades
                </Button>
                <Button
                  size="sm"
                  onClick={openNew}
                  className="h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova Oferta
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <CresceVendasDialog campanha={campanha} ofertas={filtered} open={cvOpen} onOpenChange={setCvOpen} />
      <DescricaoPrecoDialog campanha={campanha} ofertas={filtered} open={dpOpen} onOpenChange={setDpOpen} />
      <GeradorCartazesDialog campanha={campanha} ofertas={filtered} open={cartazOpen} onOpenChange={setCartazOpen} />
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

      {/* Resumo da Campanha e Checklist integrados lado a lado */}
      <div className="grid gap-2.5 lg:grid-cols-12 mb-3">
        {/* KPIs (8 colunas em telas médias/grandes) */}
        <div className="lg:col-span-7 xl:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Card 1: Sellout */}
          <div className="rounded-xl border border-border/60 bg-card p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5 text-primary" /> Verba Sell Out
            </div>
            <div className="mt-1.5">
              <div className="text-lg sm:text-xl font-bold tracking-tight text-navy">{brl(selloutStats.total)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">A cobrar dos fornecedores</div>
            </div>
          </div>

          {/* Card 2: Ofertas */}
          <div className="rounded-xl border border-border/60 bg-card p-3 shadow-xs flex flex-col justify-between">
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
              <div className="text-lg sm:text-xl font-bold tracking-tight text-navy">
                {ofertas.length} <span className="text-xs font-normal text-muted-foreground">produtos</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {selloutStats.qtd === 0 ? "Nenhuma com verba" : `${selloutStats.qtd} com verba`}
              </div>
            </div>
          </div>

          {/* Card 3: Anexos */}
          <div
            onClick={!readOnly ? openEditCampanha : undefined}
            className={`rounded-xl border border-border/60 bg-card p-3 shadow-xs flex flex-col justify-between transition-colors ${!readOnly ? "cursor-pointer hover:border-primary/40 group" : ""}`}
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
                {campanha.materiais.length} <span className="text-xs font-normal text-muted-foreground">anexo(s)</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {!readOnly ? "Clique para gerenciar" : "Materiais de apoio"}
              </div>
            </div>
          </div>
        </div>

        {/* Checklist (4 colunas em telas grandes, perfeitamente alinhado) */}
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
            <span className="truncate text-[11px]">Nenhum material de apoio anexado nesta campanha.</span>
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

      {/* Filtros e Busca Compactos */}
      <div className="mb-3 rounded-xl border border-border/60 bg-card p-2 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, descrição ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs rounded-lg border-border/60 bg-background w-full"
          />
        </div>
        <Select value={fCategoria} onValueChange={setFCategoria}>
          <SelectTrigger className="h-8 rounded-lg border-border/60 bg-background text-xs w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="h-8 rounded-lg border-border/60 bg-background text-xs w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fClube} onValueChange={setFClube}>
          <SelectTrigger className="h-8 rounded-lg border-border/60 bg-background text-xs w-full sm:w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Clube: Todos</SelectItem>
            <SelectItem value="sim">Somente Clube</SelectItem>
            <SelectItem value="nao">Sem Clube</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fSellout} onValueChange={setFSellout}>
          <SelectTrigger className="h-8 rounded-lg border-border/60 bg-background text-xs w-full sm:w-[140px]">
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
            <Button variant="outline" size="sm" className="h-8 rounded-lg border-border/60 text-xs w-full sm:w-auto px-2.5">
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
                  onSelect={(e) => { e.preventDefault(); toggle(col.key); }}
                  className="flex items-center justify-between cursor-pointer text-xs"
                >
                  <span>{col.label}</span>
                  {on && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabela de Produtos */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2.5 bg-muted/20">
          <h2 className="text-xs font-semibold tracking-tight text-navy uppercase tracking-wider">Produtos em oferta</h2>
          <span className="rounded-full bg-accent px-2 py-0.2 text-[10px] font-semibold text-muted-foreground">
            {filtered.length} de {ofertas.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30 [&>th]:h-8 [&>th]:text-[10px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-navy/70">
                {isVisible("codigo") && <TableHead>Código</TableHead>}
                {isVisible("gtin") && <TableHead>Cód. barras</TableHead>}
                {isVisible("descricao") && <TableHead>Descrição</TableHead>}
                {isVisible("precoNormal") && <TableHead className="text-right">Normal</TableHead>}
                {isVisible("precoPromocional") && <TableHead className="text-right">Promo</TableHead>}
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
                    <p className="mt-3 text-sm font-medium text-foreground">Nenhuma oferta encontrada</p>
                    <p className="mt-1 text-xs text-muted-foreground">Cadastre produtos nesta campanha ou ajuste os filtros.</p>
                  </TableCell>
                </TableRow>
              ) : filtered.map((o) => {
                const desconto = o.precoNormal > 0 && o.precoPromocional > 0 && o.precoPromocional < o.precoNormal
                  ? Math.round((1 - o.precoPromocional / o.precoNormal) * 100)
                  : 0;
                return (
                <TableRow key={o.id} className="group border-border/60 transition-colors hover:bg-accent/60">
                  {isVisible("codigo") && <TableCell className="font-mono text-xs text-muted-foreground">{o.codigo}</TableCell>}
                  {isVisible("gtin") && <TableCell className="font-mono text-xs text-muted-foreground">{o.gtin}</TableCell>}
                  {isVisible("descricao") && <TableCell className="max-w-[260px] truncate font-medium text-navy">{o.descricao}</TableCell>}
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
                      {o.clubeSumel ? <Badge className="bg-primary/10 text-primary border-primary/20"><Tag className="h-3 w-3 mr-1" />Sim</Badge> : <span className="text-muted-foreground text-xs">Não</span>}
                    </TableCell>
                  )}
                  {isVisible("sellout") && (
                    <TableCell className="text-right">
                      {o.selloutTemVerba ? (
                        <div className="flex flex-col items-end leading-tight">
                          <span className="font-semibold tabular-nums text-navy">{brl(o.selloutValor)}</span>
                          {o.selloutFornecedor && <span className="text-[10px] text-muted-foreground">{o.selloutFornecedor}</span>}
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                  )}
                  {isVisible("dataInicial") && <TableCell className="text-xs text-muted-foreground">{fmtDate(o.dataInicial)}</TableCell>}
                  {isVisible("dataFinal") && <TableCell className="text-xs text-muted-foreground">{fmtDate(o.dataFinal)}</TableCell>}
                  {isVisible("filiais") && <TableCell className="text-xs text-muted-foreground">{o.filiais?.length ? o.filiais.join(", ") : "-"}</TableCell>}
                  {isVisible("corredor") && <TableCell className="text-xs text-muted-foreground">{o.corredor}</TableCell>}
                  {isVisible("estoque") && <TableCell className="text-right tabular-nums">{o.estoque}</TableCell>}
                  {isVisible("margem") && <TableCell className="text-right tabular-nums">{o.margem.toFixed(1)}%</TableCell>}
                  {isVisible("status") && <TableCell><Badge variant="outline" className={statusVariant[o.status]}>{o.status}</Badge></TableCell>}
                  <TableCell className="text-right whitespace-nowrap">
                    {readOnly ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="inline-flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-navy/10" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-destructive/10" onClick={() => setDeleteId(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

      </div>



      <OfertaDialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }} oferta={editing} setOferta={setEditing} onSave={save} filiaisPermitidas={campanha.filiais ?? []} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oferta?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não poderá ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { onDeleteOferta(deleteId); toast.success("Oferta excluída."); setDeleteId(null); } }} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </div>
  );
}

// ============ DIALOGS ============

function CampanhaDialog({ open, onOpenChange, campanha, setCampanha, onSave, onSaveWithMateriais }: {
  open: boolean; onOpenChange: (v: boolean) => void; campanha: Campanha | null;
  setCampanha: (c: Campanha | null) => void; onSave: () => void;
  onSaveWithMateriais: (m: MaterialApoio[]) => void;
}) {


  if (!campanha) return null;
  const upd = <K extends keyof Campanha>(k: K, v: Campanha[K]) => setCampanha({ ...campanha, [k]: v });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0">
        <div className="p-6">
        <DialogHeader>
          <DialogTitle>{campanha.nome ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
          <DialogDescription>Defina o período, o status e os materiais de apoio da campanha.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Nome"><Input value={campanha.nome} onChange={(e) => upd("nome", e.target.value)} placeholder="Ex: Ofertas da Semana" /></Field>
          <Field label="Descrição"><Textarea value={campanha.descricao} onChange={(e) => upd("descricao", e.target.value)} rows={3} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data Inicial"><Input type="date" value={campanha.dataInicial} onChange={(e) => upd("dataInicial", e.target.value)} /></Field>
            <Field label="Data Final"><Input type="date" value={campanha.dataFinal} onChange={(e) => upd("dataFinal", e.target.value)} /></Field>
          </div>
          <Field label="Status">
            <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={campanha.status === "Rascunho"}
                  onChange={(e) => upd("status", (e.target.checked ? "Rascunho" : statusCampanha({ ...campanha, status: "Ativa" })) as Status)}
                />
                Manter como rascunho
              </label>
              <Badge variant="outline" className={statusVariant[statusCampanha(campanha)]}>
                {statusCampanha(campanha)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                O status é definido automaticamente pelas datas da campanha.
              </span>
            </div>
          </Field>

          <Field label="Filiais participantes (selecione uma ou mais)">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-md border p-3">
              {FILIAIS.map((f) => {
                const checked = campanha.filiais?.includes(f) ?? false;
                return (
                  <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const atuais = campanha.filiais ?? [];
                        upd("filiais", e.target.checked ? [...atuais, f] : atuais.filter((x) => x !== f));
                      }}
                      className="h-4 w-4 accent-primary"
                    />
                    {f}
                  </label>
                );
              })}
            </div>
          </Field>

          <div className="flex items-center gap-3 rounded-md border p-3">
            <Switch checked={campanha.clubeSumel ?? false} onCheckedChange={(v) => upd("clubeSumel", v)} id="camp-clube" />
            <Label htmlFor="camp-clube" className="cursor-pointer">Campanha Clube Sumel (as ofertas herdam essa marcação)</Label>
          </div>

          <MateriaisUploader
            campanhaId={campanha.id}
            materiais={campanha.materiais}
            onChange={(m) => upd("materiais", m)}
            onDirectSave={campanha.nome ? (m) => onSaveWithMateriais(m) : undefined}
          />

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} className="bg-primary hover:bg-primary/90">Salvar</Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ MATERIAIS DE APOIO ============

const BUCKET = "campanha-materiais";

const ACCEPT = "image/jpeg,image/jpg,image/png,application/pdf";

function isImage(tipo: string) { return tipo.startsWith("image/"); }

function MateriaisUploader({
  campanhaId, materiais, onChange, onDirectSave,
}: { campanhaId: string; materiais: MaterialApoio[]; onChange: (m: MaterialApoio[]) => void; onDirectSave?: (m: MaterialApoio[]) => void }) {

  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const added: MaterialApoio[] = [];
    for (const file of Array.from(files)) {
      if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
        toast.error(`Formato não suportado: ${file.name}`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} excede 20 MB.`);
        continue;
      }
      const ext = file.name.split(".").pop() || "bin";
      const path = `${campanhaId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) { toast.error(`Falha ao enviar ${file.name}: ${error.message}`); continue; }
      added.push({ path, nome: file.name, tipo: file.type, tamanho: file.size });
    }
    if (added.length) {
      const novo = [...materiais, ...added];
      console.log("[MateriaisUploader] Adding new materials:", added);
      onChange(novo);
      if (onDirectSave) {
        console.log("[MateriaisUploader] Calling onDirectSave with:", novo);
        onDirectSave(novo);
      }
      toast.success(`${added.length} arquivo(s) anexado(s).`);
    }

    setUploading(false);
  };

  const remove = async (m: MaterialApoio) => {
    await supabase.storage.from(BUCKET).remove([m.path]);
    const novo = materiais.filter(x => x.path !== m.path);
    onChange(novo);
    if (onDirectSave) onDirectSave(novo);
    toast.success("Arquivo removido.");

  };

  const openMaterial = async (m: MaterialApoio) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(m.path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao abrir arquivo. Tentando URL pública...");
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(m.path);
      if (publicData?.publicUrl) {
        window.open(publicData.publicUrl, "_blank", "noopener");
      }
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">Materiais de apoio para as lojas (JPG, PNG, PDF — até 20 MB)</Label>
      <label className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 cursor-pointer transition ${uploading ? "opacity-60 pointer-events-none" : "hover:border-primary hover:bg-primary/5"}`}>
        <Upload className="h-6 w-6 text-primary" />
        <span className="text-sm font-medium text-navy">{uploading ? "Enviando..." : "Clique para anexar ou arraste arquivos"}</span>
        <span className="text-xs text-muted-foreground">Cartazes, encartes, imagens de gôndola, PDF de campanha</span>
        <input type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </label>

      {materiais.length > 0 && (
        <ul className="grid gap-1.5">
          {materiais.map((m) => (
            <li key={m.path} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              {isImage(m.tipo) ? <ImageIcon className="h-4 w-4 text-navy shrink-0" /> : <FileText className="h-4 w-4 text-primary shrink-0" />}
              <button type="button" onClick={() => openMaterial(m)} className="flex-1 text-left truncate hover:underline text-navy">
                {m.nome}
              </button>
              <span className="text-xs text-muted-foreground">{(m.tamanho / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => remove(m)} className="text-muted-foreground hover:text-destructive" title="Remover">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OfertaDialog({ open, onOpenChange, oferta, setOferta, onSave, filiaisPermitidas }: {
  open: boolean; onOpenChange: (v: boolean) => void; oferta: Oferta | null;
  setOferta: (o: Oferta) => void; onSave: () => void; filiaisPermitidas: string[];
}) {
  const [lookingUp, setLookingUp] = useState(false);
  const promoRef = useRef<HTMLInputElement>(null);
  const { campanhas: todasCampanhas, ofertas: todasOfertas } = useCampanhasStore();

  const handleProductSelect = (p: Produto) => {
    if (!oferta) return;
    const preco = Number(p.preco_venda) || 0;
    const custo = Number(p.custo) || 0;
    setOferta({
      ...oferta,
      codigo: p.codigo || "",
      gtin: p.gtin || "",
      descricao: p.descricao,
      precoNormal: preco,
      custo,
      precoPromocional: preco,
    });
    setTimeout(() => { promoRef.current?.focus(); promoRef.current?.select(); }, 60);
    toast.success("Produto carregado. Informe o preço promocional ou clique num desconto.");
  };


  const historico = useMemo(() => {
    if (!oferta) return [];
    const cod = (oferta.codigo || "").trim().toLowerCase();
    const gtin = (oferta.gtin || "").trim();
    if (!cod && !gtin) return [];
    const mapa = new Map(todasCampanhas.map(c => [c.id, c]));
    return todasOfertas
      .filter(o => o.id !== oferta.id
        && ((cod && (o.codigo || "").trim().toLowerCase() === cod) || (gtin && (o.gtin || "").trim() === gtin)))
      .map(o => ({ o, c: mapa.get(o.campanhaId) }))
      .filter((x): x is { o: Oferta; c: Campanha } => !!x.c)
      .sort((a, b) => (b.c.dataInicial || "").localeCompare(a.c.dataInicial || ""));
  }, [oferta?.id, oferta?.codigo, oferta?.gtin, todasOfertas, todasCampanhas]);


  if (!oferta) return null;
  const upd = <K extends keyof Oferta>(k: K, v: Oferta[K]) => setOferta({ ...oferta, [k]: v });


  const descontoPct = oferta.precoNormal > 0
    ? ((oferta.precoNormal - oferta.precoPromocional) / oferta.precoNormal) * 100
    : 0;
  const economia = Math.max(oferta.precoNormal - oferta.precoPromocional, 0);
  const priceAt = (pct: number) => +(oferta.precoNormal * (1 - pct / 100)).toFixed(2);
  const setPromoByPct = (pct: number) => upd("precoPromocional", Math.max(priceAt(pct), 0));

  const descontoTone =
    descontoPct <= 0 ? "text-muted-foreground"
    : descontoPct < 5 ? "text-amber-600"
    : descontoPct < 20 ? "text-emerald-600"
    : "text-primary";

  const tipoPromocao: TipoPromocaoOferta = oferta.tipoPromocao || "simples";
  const qtdMinima = Math.max(Number(oferta.quantidadeMinima) || 1, 1);
  const precoTotalCombo = Number((qtdMinima * (oferta.precoPromocional || 0)).toFixed(2));

  const handleTipoChange = (novoTipo: TipoPromocaoOferta) => {
    let novaQtd = oferta.quantidadeMinima;
    if (novoTipo === "simples") {
      novaQtd = 1;
    } else if (novoTipo === "a_partir_de") {
      novaQtd = oferta.quantidadeMinima >= 2 ? oferta.quantidadeMinima : 6;
    } else if (novoTipo === "a_cada") {
      novaQtd = oferta.quantidadeMinima >= 2 ? oferta.quantidadeMinima : 3;
    }
    setOferta({
      ...oferta,
      tipoPromocao: novoTipo,
      quantidadeMinima: novaQtd,
    });
  };

  const handlePrecoTotalComboChange = (valTotal: number) => {
    const qtd = Math.max(Number(oferta.quantidadeMinima) || 1, 1);
    const unitario = +(valTotal / qtd).toFixed(2);
    upd("precoPromocional", unitario);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0">
        <div className="p-6">
        <DialogHeader>
          <DialogTitle>{oferta.codigo ? "Editar Oferta" : "Nova Oferta"}</DialogTitle>
          <DialogDescription>Localize o produto pelo código ou descrição para preencher automaticamente.</DialogDescription>
        </DialogHeader>

        <ProductSearch onSelect={handleProductSelect} />


        {historico.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 mb-1">
            <div className="text-sm font-semibold text-amber-900">
              Este produto já participou de {historico.length} campanha{historico.length > 1 ? "s" : ""}
            </div>
            <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
              {historico.map(({ o, c }) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card px-2.5 py-1.5 text-xs">
                  <span className="font-medium text-navy">{c!.nome}</span>
                  <span className="text-muted-foreground">{fmtDate(c!.dataInicial)} → {fmtDate(c!.dataFinal)}</span>
                  <span className="text-muted-foreground">
                    De <span className="line-through">{brl(o.precoNormal)}</span>{" "}
                    por <span className="font-semibold text-primary">{brl(o.precoPromocional)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}



        <div className="grid gap-4 py-2 grid-cols-1 md:grid-cols-2">
          <Field label="Código interno"><Input value={oferta.codigo} onChange={(e) => upd("codigo", e.target.value)} /></Field>
          <Field label="Código de barras (GTIN)"><Input value={oferta.gtin} onChange={(e) => upd("gtin", e.target.value)} /></Field>
          <Field label="Descrição" className="md:col-span-2"><Input value={oferta.descricao} onChange={(e) => upd("descricao", e.target.value)} /></Field>
          <Field label="Preço Atual (R$)"><Input type="number" step="0.01" value={oferta.precoNormal} onChange={(e) => upd("precoNormal", parseFloat(e.target.value) || 0)} /></Field>
          <Field label="Custo (R$)"><Input type="number" step="0.01" value={oferta.custo} readOnly disabled className="bg-muted cursor-not-allowed" /></Field>

          {/* Seletor de Formato da Promoção */}
          <div className="md:col-span-2 rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="mb-3">
              <Label className="text-xs font-semibold text-navy uppercase tracking-wider">
                Formato da Promoção
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escolha a mecânica promocional aplicada no caixa (PDV):
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleTipoChange("simples")}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all ${
                  tipoPromocao === "simples"
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm text-navy">
                  <span>🏷️</span>
                  <span>Preço Direto (tradicional)</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Desconto unitário De / Por. Válido a partir de 1 unidade.
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange("a_partir_de")}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all ${
                  tipoPromocao === "a_partir_de"
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm text-navy">
                  <span>📦</span>
                  <span>A partir de X un (Atacado)</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Ex: A partir de 6 un sai por R$ 3,99 cada.
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange("a_cada")}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all ${
                  tipoPromocao === "a_cada"
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm text-navy">
                  <span>🔁</span>
                  <span>A cada X un (Combo)</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Ex: A cada 3 un sai por R$ 3,99 cada (3 por R$ 11,97).
                </div>
              </button>
            </div>
          </div>

          {/* Configurações específicas do formato */}
          <div className="md:col-span-2 rounded-lg border p-4 bg-card space-y-4">
            {/* Comparativo de preço unitário e desconto */}
            <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b">
              <div>
                <div className="text-xs text-muted-foreground">Preço atual unitário</div>
                <div className="text-xl font-semibold text-navy">{brl(oferta.precoNormal)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Desconto unitário</div>
                <div className={`text-2xl font-bold ${descontoTone}`}>{descontoPct.toFixed(1)}%</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Economia por un</div>
                <div className="text-lg font-semibold text-navy">{brl(economia)}</div>
              </div>
            </div>

            {/* SE FORMATO TRADICIONAL */}
            {tipoPromocao === "simples" && (
              <>
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Sugestões automáticas — clique para aplicar</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 10, 15].map(pct => {
                      const preco = priceAt(pct);
                      const ativo = Math.abs(preco - oferta.precoPromocional) < 0.005;
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setPromoByPct(pct)}
                          disabled={oferta.precoNormal <= 0}
                          className={`rounded-lg border p-3 text-left transition hover:border-primary hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${ativo ? "border-primary bg-primary/5" : "bg-card"}`}
                        >
                          <div className="text-xs font-semibold text-primary">−{pct}%</div>
                          <div className="text-lg font-bold text-navy leading-tight">{brl(preco)}</div>
                          <div className="text-[11px] text-muted-foreground">Economia {brl(oferta.precoNormal - preco)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field label="Preço Promocional (R$) — unitário">
                  <Input
                    ref={promoRef}
                    type="number" step="0.01"
                    value={oferta.precoPromocional}
                    onChange={(e) => upd("precoPromocional", parseFloat(e.target.value) || 0)}
                  />
                </Field>
              </>
            )}

            {/* SE FORMATO ATACADO (A PARTIR DE X UNIDADES) */}
            {tipoPromocao === "a_partir_de" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Quantidade mínima para ativar preço de atacado (X)">
                    <div className="space-y-1.5">
                      <Input
                        type="number"
                        min="2"
                        step="1"
                        value={oferta.quantidadeMinima}
                        onChange={(e) => upd("quantidadeMinima", Math.max(parseInt(e.target.value) || 2, 2))}
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {[3, 6, 10, 12].map((qtd) => (
                          <Button
                            key={qtd}
                            type="button"
                            size="sm"
                            variant={oferta.quantidadeMinima === qtd ? "secondary" : "outline"}
                            className="h-7 text-xs px-2"
                            onClick={() => upd("quantidadeMinima", qtd)}
                          >
                            {qtd} un
                          </Button>
                        ))}
                      </div>
                    </div>
                  </Field>

                  <Field label="Preço Promocional por Unidade no Atacado (R$)">
                    <Input
                      ref={promoRef}
                      type="number" step="0.01"
                      value={oferta.precoPromocional}
                      onChange={(e) => upd("precoPromocional", parseFloat(e.target.value) || 0)}
                    />
                  </Field>
                </div>

                <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-950">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <span>📦</span> Como funciona no caixa (PDV):
                  </div>
                  <div>
                    A partir de <strong>{qtdMinima} unidades</strong>, cada uma sai por <strong>{brl(oferta.precoPromocional)}</strong> (total mínimo no atacado: <strong>{brl(qtdMinima * oferta.precoPromocional)}</strong>).
                    <br />
                    Abaixo de {qtdMinima} unidades, o cliente paga o preço normal de <strong>{brl(oferta.precoNormal)}</strong> cada.
                  </div>
                </div>
              </div>
            )}

            {/* SE FORMATO COMBO (A CADA X UNIDADES) */}
            {tipoPromocao === "a_cada" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="A cada quantas unidades? (X)">
                    <div className="space-y-1.5">
                      <Input
                        type="number"
                        min="2"
                        step="1"
                        value={oferta.quantidadeMinima}
                        onChange={(e) => upd("quantidadeMinima", Math.max(parseInt(e.target.value) || 2, 2))}
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {[2, 3, 4, 6].map((qtd) => (
                          <Button
                            key={qtd}
                            type="button"
                            size="sm"
                            variant={oferta.quantidadeMinima === qtd ? "secondary" : "outline"}
                            className="h-7 text-xs px-2"
                            onClick={() => upd("quantidadeMinima", qtd)}
                          >
                            {qtd} un
                          </Button>
                        ))}
                      </div>
                    </div>
                  </Field>

                  <Field label="Preço por Unidade no Combo (R$)">
                    <Input
                      ref={promoRef}
                      type="number" step="0.01"
                      value={oferta.precoPromocional}
                      onChange={(e) => upd("precoPromocional", parseFloat(e.target.value) || 0)}
                    />
                  </Field>

                  <Field label={`Valor Total do Pacote (${qtdMinima} un) (R$)`}>
                    <Input
                      type="number" step="0.01"
                      value={precoTotalCombo}
                      onChange={(e) => handlePrecoTotalComboChange(parseFloat(e.target.value) || 0)}
                    />
                  </Field>
                </div>

                <div className="rounded-lg border border-purple-300 bg-purple-50/70 p-3 text-xs text-purple-950">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <span>🔁</span> Como funciona no caixa (PDV):
                  </div>
                  <div>
                    A cada <strong>{qtdMinima} unidades</strong>, o cliente paga um total de <strong>{brl(precoTotalCombo)}</strong> (ou seja, <strong>{brl(oferta.precoPromocional)} cada</strong>).
                    {oferta.precoNormal > 0 && (
                      <span className="block mt-1 text-purple-800">
                        {qtdMinima} unidades no preço normal custariam <strong>{brl(oferta.precoNormal * qtdMinima)}</strong>.
                        Economia no combo: <strong>{brl(Math.max((oferta.precoNormal * qtdMinima) - precoTotalCombo, 0))}</strong>.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Field label="Códigos de barras cresce vendas">
                <Textarea
                  value={oferta.gtinsCresceVendas}
                  onChange={(e) => upd("gtinsCresceVendas", e.target.value)}
                  placeholder="Informe um código de barras por linha (ou separados por vírgula) para variações do produto"
                  rows={3}
                />
              </Field>
            </div>
          </div>


          <Field label="Data Inicial"><Input type="date" value={oferta.dataInicial} onChange={(e) => upd("dataInicial", e.target.value)} className="w-full" /></Field>
          <Field label="Data Final"><Input type="date" value={oferta.dataFinal} onChange={(e) => upd("dataFinal", e.target.value)} className="w-full" /></Field>
          <Field label="Filiais (herdadas da campanha — desmarque para excluir alguma)" className="md:col-span-2">
            {filiaisPermitidas.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Nenhuma filial foi selecionada na campanha. Edite a campanha e escolha as filiais participantes.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-md border p-3">
                {filiaisPermitidas.map((f) => {
                  const checked = oferta.filiais?.includes(f) ?? false;
                  return (
                    <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const atuais = oferta.filiais ?? [];
                          upd("filiais", e.target.checked ? [...atuais, f] : atuais.filter((x) => x !== f));
                        }}
                        className="h-4 w-4 accent-primary"
                      />
                      {f}
                    </label>
                  );
                })}
              </div>
            )}
          </Field>
          <Field label="Status (definido pela campanha)">
            <Select value={oferta.status} disabled onValueChange={(v) => upd("status", v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-3 rounded-md border p-3 md:col-span-2">
            <Switch checked={oferta.clubeSumel} onCheckedChange={(v) => upd("clubeSumel", v)} id="clube" />
            <Label htmlFor="clube" className="cursor-pointer">Oferta Clube Sumel</Label>
          </div>

          {/* Sell Out — verba do fornecedor */}
          <div className="md:col-span-2 rounded-lg border p-4 bg-navy/5">
            <div className="flex items-center gap-3 mb-3">
              <Switch checked={oferta.selloutTemVerba} onCheckedChange={(v) => upd("selloutTemVerba", v)} id="sellout" />
              <Label htmlFor="sellout" className="cursor-pointer flex items-center gap-1.5 font-semibold text-navy">
                <DollarSign className="h-4 w-4 text-primary" /> Possui verba de Sell Out do fornecedor
              </Label>
            </div>
            {oferta.selloutTemVerba && (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Fornecedor da verba">
                  <Input
                    value={oferta.selloutFornecedor}
                    onChange={(e) => upd("selloutFornecedor", e.target.value)}
                    placeholder="Ex: Ambev"
                  />
                </Field>
                <Field label="Valor da verba (R$)">
                  <Input
                    type="number" step="0.01"
                    value={oferta.selloutValor}
                    onChange={(e) => upd("selloutValor", parseFloat(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Observações / condições de cobrança" className="md:col-span-2">
                  <Textarea
                    rows={2}
                    value={oferta.selloutObs}
                    onChange={(e) => upd("selloutObs", e.target.value)}
                    placeholder="Ex: NF emitida ao final da campanha, referência do contrato, contato do comprador..."
                  />
                </Field>
              </div>
            )}
            {!oferta.selloutTemVerba && (
              <p className="text-xs text-muted-foreground">Ative quando o fornecedor pagar uma verba específica por esta oferta (para lembrar de cobrar depois).</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} className="bg-primary hover:bg-primary/90">Salvar</Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-1.5 w-full ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function BancoOportunidadesSelectDialog({ 
  open, 
  onOpenChange, 
  onSelect 
}: { 
  open: boolean; 
  onOpenChange: (v: boolean) => void; 
  onSelect: (o: Oportunidade) => void; 
}) {
  const [opts, setOpts] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setLoading(true);
      listOportunidades().then(data => {
        setOpts(data.filter(o => o.status === 'Disponível'));
        setLoading(false);
      });
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return opts.filter(o => 
      o.descricao.toLowerCase().includes(q) || 
      o.gtin?.includes(q) || 
      o.codigo_interno?.includes(q)
    );
  }, [opts, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl text-navy">
            <Target className="h-5 w-5 text-primary" /> Selecionar do Banco de Oportunidades
          </DialogTitle>
          <DialogDescription>
            Escolha um item disponível para adicionar a esta campanha.
          </DialogDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por descrição, código ou barras..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-full border-border/70"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm">Carregando oportunidades...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
              <Package className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm font-medium">Nenhuma oportunidade disponível</p>
              <p className="text-xs">Ajuste os filtros ou cadastre novas oportunidades.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map(o => (
                <button
                  key={o.id}
                  onClick={() => onSelect(o)}
                  className="flex items-center justify-between rounded-xl border border-border/70 p-4 text-left transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-navy">{o.descricao}</span>
                      <Badge variant="outline" className={`text-[10px] h-4 ${
                        o.prioridade === 'Alta' ? 'bg-red-50 text-red-600 border-red-200' :
                        o.prioridade === 'Média' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                        'bg-blue-50 text-blue-600 border-blue-200'
                      }`}>
                        {o.prioridade}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{o.gtin || o.codigo_interno}</span>
                      <span>•</span>
                      <span>{o.motivo}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-bold text-navy">{brl(o.preco_venda)}</div>
                    <div className="text-[10px] text-muted-foreground">Custo {brl(o.custo)}</div>
                    <Button size="sm" variant="ghost" className="mt-2 h-7 rounded-full text-[10px] px-2">
                      Selecionar <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
