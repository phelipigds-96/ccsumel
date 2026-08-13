import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus, Search, Pencil, Trash2, Printer, Tag, ArrowLeft, Calendar, Package, ChevronRight,
  Paperclip, Upload, FileText, Image as ImageIcon, X, DollarSign, Columns3, Check, Eye, FileDown, ListOrdered, Share2, Target, 
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useColumnPrefs } from "@/lib/column-prefs";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
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

export const Route = createFileRoute("/_app/campanhas")({
  head: () => ({
    meta: [
      { title: "Central de Ofertas — SGMC" },
      { name: "description", content: "Gerencie campanhas e suas ofertas comerciais no SGMC." },
      { property: "og:title", content: "Central de Ofertas — SGMC" },
      { property: "og:description", content: "Gerencie campanhas e ofertas no SGMC." },
    ],
  }),
  component: CentralDeOfertas,
});

import {
  type Status,
  type MaterialApoio,
  type Campanha,
  type Oferta,
  useCampanhasStore,
  campanhasStore,
  categoriaCampanha,
  statusCampanha,
} from "@/lib/campanhas-store";

const CATEGORIAS = ["Bebidas", "Mercearia", "Higiene", "Limpeza", "Frios", "Padaria", "Hortifruti"];
const FORNECEDORES = ["Ambev", "Nestlé", "Unilever", "P&G", "Coca-Cola", "BRF", "JBS"];
const FILIAIS = ["Matriz", "Filial 01", "Filial 02", "Filial 03"];
const STATUS: Status[] = ["Ativa", "Programada", "Encerrada", "Rascunho"];

const emptyCampanha = (): Campanha => ({
  id: crypto.randomUUID(), nome: "", descricao: "", dataInicial: "", dataFinal: "", status: "Rascunho", filiais: [], clubeSumel: false, materiais: [],
});

const emptyOferta = (campanha: Campanha): Oferta => ({
  id: crypto.randomUUID(), campanhaId: campanha.id, codigo: "", gtin: "", gtinsCresceVendas: "", descricao: "",
  fornecedor: FORNECEDORES[0], categoria: CATEGORIAS[0],
  precoNormal: 0, custo: 0, precoPromocional: 0, clubeSumel: campanha.clubeSumel ?? false,
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





function CentralDeOfertas() {
  const { campanhas, ofertas } = useCampanhasStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Somente ativas + futuras nesta tela; encerradas ficam no módulo dedicado.
  const visiveis = useMemo(
    () => campanhas.filter((c) => categoriaCampanha(c) !== "encerrada"),
    [campanhas],
  );

  const selected = campanhas.find((c) => c.id === selectedId) ?? null;

  const saveOferta = (o: Oferta) =>
    campanhasStore.setOfertas((prev) => {
      const exists = prev.some((p) => p.id === o.id);
      return exists ? prev.map((p) => (p.id === o.id ? o : p)) : [o, ...prev];
    });

  const deleteOferta = (id: string) =>
    campanhasStore.setOfertas((prev) => prev.filter((p) => p.id !== id));

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campanhas
      .filter(c => {
        if (q && !c.nome.toLowerCase().includes(q) && !c.descricao.toLowerCase().includes(q)) return false;
        if (fStatus !== "todos" && statusCampanha(c) !== fStatus) return false;
        return true;
      })
      .slice()
      .sort((a, b) => (b.dataInicial || "").localeCompare(a.dataInicial || ""));
  }, [campanhas, search, fStatus]);

  const futuras = useMemo(() => filtered.filter((c) => categoriaCampanha(c) === "futura"), [filtered]);
  const ativas = useMemo(() => filtered.filter((c) => categoriaCampanha(c) === "ativa"), [filtered]);
  const rascunhos = useMemo(() => filtered.filter((c) => categoriaCampanha(c) === "rascunho"), [filtered]);

  const openNew = () => { setEditing(emptyCampanha()); setDialogOpen(true); };
  const openEdit = (c: Campanha) => { setEditing({ ...c }); setDialogOpen(true); };

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
        description="Campanhas ativas e programadas. As encerradas ficam em Campanhas Encerradas."
        actions={
          !readOnly ? (
            <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />Nova Campanha
            </Button>
          ) : undefined
        }
      />

      <div className="rounded-xl border bg-card p-4 mb-4 grid gap-3 md:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar campanha..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="Ativa">Ativa</SelectItem>
            <SelectItem value="Programada">Programada</SelectItem>
            <SelectItem value="Rascunho">Rascunho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhuma campanha ativa ou programada.
        </div>
      ) : (
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rascunhos.map((c) => renderCard(c))}
              </div>
            </section>
          )}
        </div>
      )}


      <CampanhaDialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }} campanha={editing} setCampanha={setEditing} onSave={save} />

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
}

function CampanhaDetalhe({ campanha, ofertas, onBack, onSaveOferta, onDeleteOferta }: DetalheProps) {
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

  const COLUMNS: { key: string; label: string }[] = [
    { key: "codigo", label: "Código" },
    { key: "gtin", label: "Código de barras" },
    { key: "descricao", label: "Descrição" },
    { key: "precoNormal", label: "Preço Normal" },
    { key: "precoPromocional", label: "Preço Promo" },
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

  const save = () => {
    if (!editing) return;
    if (!editing.codigo.trim() || !editing.descricao.trim()) { toast.error("Preencha código e descrição."); return; }
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

  const printPDF = () => {
    printCampanhaPDF(campanha, filtered);
    toast.success("PDF aberto em nova aba.");
  };


  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar para campanhas
      </button>

      <PageHeader
        title={campanha.nome}
        description={`Vigência ${fmtDate(campanha.dataInicial)} → ${fmtDate(campanha.dataFinal)}  •  ${campanha.descricao || "Ofertas desta campanha."}`}
        actions={
          <>
            <Badge variant="outline" className={`${statusVariant[statusCampanha(campanha)]} mr-1`}>{statusCampanha(campanha)}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><Share2 className="mr-2 h-4 w-4" />Exportar</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Exportar campanha</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={printPDF}><Printer className="mr-2 h-4 w-4" />Imprimir PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCvOpen(true)}><FileDown className="mr-2 h-4 w-4" />CresceVendas (.txt)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDpOpen(true)}><ListOrdered className="mr-2 h-4 w-4" />Descrição + Preço</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!readOnly && (
              <Button onClick={openNew} className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Nova Oferta</Button>
            )}
          </>
        }
      />

      <CresceVendasDialog campanha={campanha} ofertas={filtered} open={cvOpen} onOpenChange={setCvOpen} />
      <DescricaoPrecoDialog campanha={campanha} ofertas={filtered} open={dpOpen} onOpenChange={setDpOpen} />




      {/* Resumo Sell Out da campanha */}
      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
          <span className="absolute inset-y-0 left-0 w-1 bg-primary" />
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <DollarSign className="h-4 w-4 text-primary" /> Verba Sell Out
          </div>
          <div className="mt-2 font-display text-3xl font-bold tracking-tight text-navy">{brl(selloutStats.total)}</div>
          <div className="mt-1 text-xs text-muted-foreground">A cobrar dos fornecedores</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
          <span className="absolute inset-y-0 left-0 w-1 bg-navy/30" />
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Tag className="h-4 w-4 text-navy" /> Ofertas com verba
          </div>
          <div className="mt-2 font-display text-3xl font-bold tracking-tight text-navy">{selloutStats.qtd}</div>
          <div className="mt-1 text-xs text-muted-foreground">de {ofertas.length} oferta(s) na campanha</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
          <span className="absolute inset-y-0 left-0 w-1 bg-navy/30" />
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Paperclip className="h-4 w-4 text-primary" /> Anexos da campanha
          </div>
          <div className="mt-2 font-display text-3xl font-bold tracking-tight text-navy">{campanha.materiais.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">Materiais de apoio para as lojas</div>
        </div>
      </div>

      {campanha.materiais.length > 0 && (
        <MateriaisViewer materiais={campanha.materiais} />
      )}

      <div className="mb-4 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur grid gap-2 md:grid-cols-[1fr_170px_170px_150px_170px_140px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código, descrição ou fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-full border-border/70 bg-background" />
        </div>
        <Select value={fCategoria} onValueChange={setFCategoria}>
          <SelectTrigger className="rounded-full border-border/70 bg-background text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="rounded-full border-border/70 bg-background text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fClube} onValueChange={setFClube}>
          <SelectTrigger className="rounded-full border-border/70 bg-background text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Clube: Todos</SelectItem>
            <SelectItem value="sim">Somente Clube</SelectItem>
            <SelectItem value="nao">Sem Clube</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fSellout} onValueChange={setFSellout}>
          <SelectTrigger className="rounded-full border-border/70 bg-background text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Sell Out: Todos</SelectItem>
            <SelectItem value="com">Com verba</SelectItem>
            <SelectItem value="sem">Sem verba</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-start rounded-full border-border/70 text-xs">
              <Columns3 className="h-4 w-4 mr-2" /> Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNS.map((col) => {
              const on = isVisible(col.key);
              return (
                <DropdownMenuItem
                  key={col.key}
                  onSelect={(e) => { e.preventDefault(); toggle(col.key); }}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span>{col.label}</span>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-navy">Produtos em oferta</h2>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {filtered.length} de {ofertas.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/70 bg-navy/[0.04] hover:bg-navy/[0.04] [&>th]:h-10 [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-navy/70">
                {isVisible("codigo") && <TableHead>Código</TableHead>}
                {isVisible("gtin") && <TableHead>Cód. barras</TableHead>}
                {isVisible("descricao") && <TableHead>Descrição</TableHead>}
                {isVisible("precoNormal") && <TableHead className="text-right">Normal</TableHead>}
                {isVisible("precoPromocional") && <TableHead className="text-right">Promo</TableHead>}
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
                const desconto = o.precoNormal > 0 && o.precoPromocional > 0
                  ? Math.round((1 - o.precoPromocional / o.precoNormal) * 100)
                  : 0;
                return (
                <TableRow key={o.id} className="group border-border/60 transition-colors hover:bg-accent/60">
                  {isVisible("codigo") && <TableCell className="font-mono text-xs text-muted-foreground">{o.codigo}</TableCell>}
                  {isVisible("gtin") && <TableCell className="font-mono text-xs text-muted-foreground">{o.gtin}</TableCell>}
                  {isVisible("descricao") && <TableCell className="max-w-[260px] truncate font-medium text-navy">{o.descricao}</TableCell>}
                  {isVisible("precoNormal") && <TableCell className="text-right text-muted-foreground line-through tabular-nums">{brl(o.precoNormal)}</TableCell>}
                  {isVisible("precoPromocional") && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {desconto > 0 && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">-{desconto}%</span>
                        )}
                        <span className="font-semibold tabular-nums text-primary">{brl(o.precoPromocional)}</span>
                      </div>
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
    </div>
  );
}

// ============ DIALOGS ============

function CampanhaDialog({ open, onOpenChange, campanha, setCampanha, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; campanha: Campanha | null;
  setCampanha: (c: Campanha) => void; onSave: () => void;
}) {
  if (!campanha) return null;
  const upd = <K extends keyof Campanha>(k: K, v: Campanha[K]) => setCampanha({ ...campanha, [k]: v });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} className="bg-primary hover:bg-primary/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ MATERIAIS DE APOIO ============

const BUCKET = "campanha-materiais";

const ACCEPT = "image/jpeg,image/jpg,image/png,application/pdf";

function isImage(tipo: string) { return tipo.startsWith("image/"); }

function MateriaisUploader({
  campanhaId, materiais, onChange,
}: { campanhaId: string; materiais: MaterialApoio[]; onChange: (m: MaterialApoio[]) => void }) {
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
      onChange([...materiais, ...added]);
      toast.success(`${added.length} arquivo(s) anexado(s).`);
    }
    setUploading(false);
  };

  const remove = async (m: MaterialApoio) => {
    await supabase.storage.from(BUCKET).remove([m.path]);
    onChange(materiais.filter(x => x.path !== m.path));
    toast.success("Arquivo removido.");
  };

  const openMaterial = async (m: MaterialApoio) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(m.path, 60 * 10);
    if (error || !data) { toast.error("Não foi possível abrir o arquivo."); return; }
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
  const [busca, setBusca] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const promoRef = useRef<HTMLInputElement>(null);
  const { campanhas: todasCampanhas, ofertas: todasOfertas } = useCampanhasStore();

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
      .filter(x => !!x.c)
      .sort((a, b) => (b.c!.dataInicial || "").localeCompare(a.c!.dataInicial || ""));
  }, [oferta?.id, oferta?.codigo, oferta?.gtin, todasOfertas, todasCampanhas]);


  // Reset campo de busca e foca quando abre uma nova oferta (id muda)
  useEffect(() => {
    if (!open || !oferta) return;
    setBusca("");
    const t = setTimeout(() => buscaRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, oferta?.id]);

  if (!oferta) return null;
  const upd = <K extends keyof Oferta>(k: K, v: Oferta[K]) => setOferta({ ...oferta, [k]: v });

  const lookupProduto = async (code?: string) => {
    const term = (code ?? busca).trim();
    if (!term) { toast.error("Informe o código interno ou de barras."); return; }
    setLookingUp(true);
    try {
      const { findByCodigoOrGtin } = await import("@/lib/produtos");
      const p = await findByCodigoOrGtin(term);
      if (!p) { toast.error("Produto não encontrado no catálogo."); return; }
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
    } catch (e) { toast.error("Erro na consulta: " + (e as Error).message); }
    finally { setLookingUp(false); }
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{oferta.codigo ? "Editar Oferta" : "Nova Oferta"}</DialogTitle>
          <DialogDescription>Informe o código interno ou de barras para preencher automaticamente.</DialogDescription>
        </DialogHeader>

        {/* Busca por Código interno OU GTIN */}
        <div className="rounded-lg border bg-navy/5 p-3 mb-1">
          <Label className="text-xs text-muted-foreground">Código interno ou código de barras</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              ref={buscaRef}
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupProduto(); } }}
              placeholder="Bipe o código de barras ou digite o código interno e pressione Enter"
              inputMode="numeric"
            />
            <Button type="button" onClick={() => lookupProduto()} disabled={lookingUp} className="bg-primary hover:bg-primary/90">
              {lookingUp ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </div>

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



        <div className="grid gap-4 py-2 md:grid-cols-2">
          <Field label="Código interno"><Input value={oferta.codigo} onChange={(e) => upd("codigo", e.target.value)} /></Field>
          <Field label="Código de barras (GTIN)"><Input value={oferta.gtin} onChange={(e) => upd("gtin", e.target.value)} /></Field>
          <Field label="Descrição" className="md:col-span-2"><Input value={oferta.descricao} onChange={(e) => upd("descricao", e.target.value)} /></Field>
          <Field label="Preço Atual (R$)"><Input type="number" step="0.01" value={oferta.precoNormal} onChange={(e) => upd("precoNormal", parseFloat(e.target.value) || 0)} /></Field>
          <Field label="Custo (R$)"><Input type="number" step="0.01" value={oferta.custo} readOnly disabled className="bg-muted cursor-not-allowed" /></Field>

          {/* Sugestões de desconto */}
          <div className="md:col-span-2 rounded-lg border p-4 bg-card">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div>
                <div className="text-xs text-muted-foreground">Preço atual</div>
                <div className="text-xl font-semibold text-navy">{brl(oferta.precoNormal)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Desconto aplicado</div>
                <div className={`text-2xl font-bold ${descontoTone}`}>{descontoPct.toFixed(1)}%</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Economia</div>
                <div className="text-lg font-semibold text-navy">{brl(economia)}</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground mb-2">Sugestões automáticas — clique para aplicar</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
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

            <Field label="Preço Promocional (R$) — ou informe manualmente">
              <Input
                ref={promoRef}
                type="number" step="0.01"
                value={oferta.precoPromocional}
                onChange={(e) => upd("precoPromocional", parseFloat(e.target.value) || 0)}
              />
            </Field>

            <div className="mt-4">
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


          <Field label="Data Inicial"><Input type="date" value={oferta.dataInicial} onChange={(e) => upd("dataInicial", e.target.value)} /></Field>
          <Field label="Data Final"><Input type="date" value={oferta.dataFinal} onChange={(e) => upd("dataFinal", e.target.value)} /></Field>
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
      </DialogContent>
    </Dialog>
  );
}


function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
