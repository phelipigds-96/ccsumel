import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Search, Pencil, Trash2, Printer, Tag, ArrowLeft, Calendar, Package, ChevronRight,
  Paperclip, Upload, FileText, Image as ImageIcon, X, DollarSign,
} from "lucide-react";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
} from "@/lib/campanhas-store";

const CATEGORIAS = ["Bebidas", "Mercearia", "Higiene", "Limpeza", "Frios", "Padaria", "Hortifruti"];
const FORNECEDORES = ["Ambev", "Nestlé", "Unilever", "P&G", "Coca-Cola", "BRF", "JBS"];
const FILIAIS = ["Matriz", "Filial 01", "Filial 02", "Filial 03"];
const STATUS: Status[] = ["Ativa", "Programada", "Encerrada", "Rascunho"];

const emptyCampanha = (): Campanha => ({
  id: crypto.randomUUID(), nome: "", descricao: "", dataInicial: "", dataFinal: "", status: "Rascunho", filiais: [], materiais: [],
});

const emptyOferta = (campanha: Campanha): Oferta => ({
  id: crypto.randomUUID(), campanhaId: campanha.id, codigo: "", gtin: "", descricao: "",
  fornecedor: FORNECEDORES[0], categoria: CATEGORIAS[0],
  precoNormal: 0, custo: 0, precoPromocional: 0, clubeSumel: false,
  dataInicial: campanha.dataInicial, dataFinal: campanha.dataFinal,
  filiais: [...(campanha.filiais ?? [])], corredor: "", estoque: 0, margem: 0, status: campanha.status,
  selloutTemVerba: false, selloutFornecedor: "", selloutValor: 0, selloutObs: "",
});


const statusVariant: Record<Status, string> = {
  Ativa: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Programada: "bg-blue-100 text-blue-700 border-blue-200",
  Encerrada: "bg-slate-200 text-slate-700 border-slate-300",
  Rascunho: "bg-amber-100 text-amber-700 border-amber-200",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "-";

function printCampanhaPDF(campanha: Campanha, ofertas: Oferta[]) {
  // Abre a aba SINCRONAMENTE dentro do clique para não ser bloqueada pelo navegador
  const win = window.open("", "_blank");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14); doc.setTextColor(30, 41, 82);
  doc.text(`SGMC — Campanha: ${campanha.nome}`, 40, 40);
  doc.setFontSize(9); doc.setTextColor(90);
  doc.text(
    `Vigência ${fmtDate(campanha.dataInicial)} a ${fmtDate(campanha.dataFinal)}  •  ${ofertas.length} oferta(s)  •  Gerado em ${new Date().toLocaleString("pt-BR")}`,
    40, 56,
  );

  autoTable(doc, {
    startY: 70,
    head: [["Código", "Descrição", "Clube", "Preço Normal", "Preço Promocional", "Período", "Campanha"]],
    body: ofertas.map(o => [
      o.codigo,
      o.descricao,
      o.clubeSumel ? "Sim" : "Não",
      brl(o.precoNormal),
      brl(o.precoPromocional),
      `${fmtDate(o.dataInicial)} a ${fmtDate(o.dataFinal)}`,
      campanha.nome,
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [200, 30, 40], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 250] },
  });

  const url = doc.output("bloburl") as unknown as string;

  if (win && !win.closed) {
    win.location.href = url;
  } else {
    // Pop-up bloqueado: cai para exibição na aba atual
    window.location.href = url;
    toast.warning("Permita pop-ups para abrir o PDF em nova aba.");
  }
}



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
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campanha | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
        if (fStatus !== "todos" && c.status !== fStatus) return false;
        return true;
      })
      .slice()
      .sort((a, b) => (b.dataInicial || "").localeCompare(a.dataInicial || ""));
  }, [campanhas, search, fStatus]);

  const futuras = useMemo(() => filtered.filter((c) => categoriaCampanha(c) === "futura"), [filtered]);
  const ativas = useMemo(() => filtered.filter((c) => categoriaCampanha(c) === "ativa"), [filtered]);

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
          opts.destaque
            ? "group rounded-xl border-2 border-navy/40 bg-gradient-to-br from-navy/5 to-transparent p-5 hover:border-navy hover:shadow-md transition relative"
            : "group rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-md transition"
        }
      >
        {opts.destaque && (
          <span className="absolute -top-2 left-4 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-navy text-white rounded">
            Programada
          </span>
        )}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-navy leading-tight">{c.nome}</h3>
          <Badge variant="outline" className={statusVariant[c.status]}>{c.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">{c.descricao || "Sem descrição."}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmtDate(c.dataInicial)} → {fmtDate(c.dataFinal)}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <Package className="h-4 w-4 text-primary" />
              <strong>{count}</strong> <span className="text-muted-foreground">oferta{count === 1 ? "" : "s"}</span>
            </span>
            {c.materiais.length > 0 && (
              <span className="flex items-center gap-1.5 text-navy" title="Materiais de apoio">
                <Paperclip className="h-4 w-4" />
                <strong>{c.materiais.length}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" title="Imprimir PDF" onClick={() => { printCampanhaPDF(c, ofertas.filter(o => o.campanhaId === c.id)); toast.success("PDF aberto em nova aba."); }}><Printer className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Excluir" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            <Button size="sm" onClick={() => onOpen(c.id)} className="bg-primary hover:bg-primary/90">
              Abrir <ChevronRight className="h-4 w-4 ml-1" />
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
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />Nova Campanha
          </Button>
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
        </div>
      )}


      <CampanhaDialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }} campanha={editing} setCampanha={setEditing} onSave={save} />

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

// ============ CAMPANHA DETALHE (ofertas) ============

interface DetalheProps {
  campanha: Campanha;
  ofertas: Oferta[];
  onBack: () => void;
  onSaveOferta: (o: Oferta) => void;
  onDeleteOferta: (id: string) => void;
}

function CampanhaDetalhe({ campanha, ofertas, onBack, onSaveOferta, onDeleteOferta }: DetalheProps) {
  const [search, setSearch] = useState("");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fStatus, setFStatus] = useState("todos");
  const [fClube, setFClube] = useState("todos");
  const [fSellout, setFSellout] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Oferta | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
            <Badge variant="outline" className={`${statusVariant[campanha.status]} mr-1`}>{campanha.status}</Badge>
            <Button variant="outline" onClick={printPDF}><Printer className="mr-2 h-4 w-4" />Imprimir PDF</Button>
            <Button onClick={openNew} className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Nova Oferta</Button>
          </>
        }
      />

      {/* Resumo Sell Out da campanha */}
      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-4 w-4 text-primary" /> Verba Sell Out — Total</div>
          <div className="text-2xl font-bold text-navy mt-1">{brl(selloutStats.total)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">A cobrar dos fornecedores</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Ofertas com verba</div>
          <div className="text-2xl font-bold text-navy mt-1">{selloutStats.qtd}</div>
          <div className="text-xs text-muted-foreground mt-0.5">de {ofertas.length} oferta(s)</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Anexos da campanha</div>
          <div className="text-2xl font-bold text-navy mt-1 flex items-center gap-2"><Paperclip className="h-5 w-5 text-primary" />{campanha.materiais.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Materiais de apoio para as lojas</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 mb-4 grid gap-3 md:grid-cols-[1fr_170px_170px_150px_170px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código, descrição ou fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={fCategoria} onValueChange={setFCategoria}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fClube} onValueChange={setFClube}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Clube: Todos</SelectItem>
            <SelectItem value="sim">Somente Clube</SelectItem>
            <SelectItem value="nao">Sem Clube</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fSellout} onValueChange={setFSellout}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Sell Out: Todos</SelectItem>
            <SelectItem value="com">Com verba</SelectItem>
            <SelectItem value="sem">Sem verba</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-navy/5">
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Normal</TableHead>
                <TableHead className="text-right">Promo</TableHead>
                <TableHead className="text-center">Clube</TableHead>
                <TableHead className="text-right">Sell Out</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Corredor</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-10 text-muted-foreground">
                    Nenhuma oferta cadastrada nesta campanha ainda.
                  </TableCell>
                </TableRow>
              ) : filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.codigo}</TableCell>
                  <TableCell className="font-medium max-w-[240px] truncate">{o.descricao}</TableCell>
                  <TableCell>{o.fornecedor}</TableCell>
                  <TableCell>{o.categoria}</TableCell>
                  <TableCell className="text-right line-through text-muted-foreground">{brl(o.precoNormal)}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{brl(o.precoPromocional)}</TableCell>
                  <TableCell className="text-center">
                    {o.clubeSumel ? <Badge className="bg-primary/10 text-primary border-primary/20"><Tag className="h-3 w-3 mr-1" />Sim</Badge> : <span className="text-muted-foreground text-xs">Não</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {o.selloutTemVerba ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="font-semibold text-navy">{brl(o.selloutValor)}</span>
                        {o.selloutFornecedor && <span className="text-[10px] text-muted-foreground">{o.selloutFornecedor}</span>}
                      </div>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">{fmtDate(o.dataInicial)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(o.dataFinal)}</TableCell>
                  <TableCell className="text-xs">{o.filiais?.length ? o.filiais.join(", ") : "-"}</TableCell>
                  <TableCell className="text-xs">{o.corredor}</TableCell>
                  <TableCell className="text-right">{o.estoque}</TableCell>
                  <TableCell className="text-right">{o.margem.toFixed(1)}%</TableCell>
                  <TableCell><Badge variant="outline" className={statusVariant[o.status]}>{o.status}</Badge></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
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
            <Select value={campanha.status} onValueChange={(v) => upd("status", v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
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
      toast.success("Produto carregado. Escolha uma sugestão de desconto.");
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

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <Field label="Código interno"><Input value={oferta.codigo} onChange={(e) => upd("codigo", e.target.value)} /></Field>
          <Field label="Código de barras (GTIN)"><Input value={oferta.gtin} onChange={(e) => upd("gtin", e.target.value)} /></Field>
          <Field label="Descrição" className="md:col-span-2"><Input value={oferta.descricao} onChange={(e) => upd("descricao", e.target.value)} /></Field>
          <Field label="Fornecedor">
            <Select value={oferta.fornecedor} onValueChange={(v) => upd("fornecedor", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FORNECEDORES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={oferta.categoria} onValueChange={(v) => upd("categoria", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
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
                type="number" step="0.01"
                value={oferta.precoPromocional}
                onChange={(e) => upd("precoPromocional", parseFloat(e.target.value) || 0)}
              />
            </Field>
          </div>

          <Field label="Data Inicial"><Input type="date" value={oferta.dataInicial} onChange={(e) => upd("dataInicial", e.target.value)} /></Field>
          <Field label="Data Final"><Input type="date" value={oferta.dataFinal} onChange={(e) => upd("dataFinal", e.target.value)} /></Field>
          <Field label="Filiais (selecione uma ou mais)" className="md:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-md border p-3">
              {FILIAIS.map((f) => {
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
          </Field>
          <Field label="Corredor"><Input value={oferta.corredor} onChange={(e) => upd("corredor", e.target.value)} placeholder="A1" /></Field>
          <Field label="Estoque"><Input type="number" value={oferta.estoque} onChange={(e) => upd("estoque", parseInt(e.target.value) || 0)} /></Field>
          <Field label="Margem (%)"><Input type="number" step="0.1" value={oferta.margem} onChange={(e) => upd("margem", parseFloat(e.target.value) || 0)} /></Field>
          <Field label="Status">
            <Select value={oferta.status} onValueChange={(v) => upd("status", v as Status)}>
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
