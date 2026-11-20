import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  Package,
  Paperclip,
  Eye,
  Printer,
  Share2,
  FileDown,
  ListOrdered,
  Pencil,
  Trash2,
  ChevronRight,
  LayoutGrid,
  List,
  Archive,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
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
  fmtDate,
  printCampanhaPDF,
  CampanhaQuickView,
} from "@/components/campanha-quick-view";
import { CresceVendasDialog } from "@/components/crescevendas-export";
import { DescricaoPrecoDialog } from "@/components/descricao-preco-export";

import {
  type Campanha,
  type Oferta,
  type MaterialApoio,
  categoriaCampanha,
  statusCampanha,
  statusVariant,
  formatFiliais,
  emptyCampanha,
} from "./types";
import { CampanhaDialog } from "./campanha-dialog";

interface ListProps {
  campanhas: Campanha[];
  ofertas: Oferta[];
  onOpen: (id: string) => void;
  onSave: (c: Campanha) => void;
  onDelete: (id: string) => void;
}

export function CampanhasList({
  campanhas,
  ofertas,
  onOpen,
  onSave,
  onDelete,
}: ListProps) {
  const { user } = useAuth();
  const readOnly = !user?.isAdmin || !!user?.readOnly;

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("todos");

  // Visualização e ordenação
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

  const [sortField] = useState<"dataInicial" | "dataFinal" | "nome" | "status">("dataInicial");
  const [sortOrder] = useState<"asc" | "desc">("desc");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campanha | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const quickView = useMemo(
    () => (quickViewId ? campanhas.find((c) => c.id === quickViewId) ?? null : null),
    [quickViewId, campanhas]
  );
  const [cvCampanha, setCvCampanha] = useState<Campanha | null>(null);
  const [dpCampanha, setDpCampanha] = useState<Campanha | null>(null);

  const countByCampanha = useMemo(() => {
    const m = new Map<string, number>();
    ofertas.forEach((o) => m.set(o.campanhaId, (m.get(o.campanhaId) ?? 0) + 1));
    return m;
  }, [ofertas]);

  const countEncerradas = useMemo(() => {
    return campanhas.filter((c) => categoriaCampanha(c) === "encerrada").length;
  }, [campanhas]);

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
  }, [campanhas, sortField, sortOrder, user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedVisiveis.filter((c) => {
      if (
        q &&
        !c.nome.toLowerCase().includes(q) &&
        !c.descricao.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (fStatus !== "todos" && statusCampanha(c) !== fStatus) return false;
      return true;
    });
  }, [sortedVisiveis, search, fStatus]);

  const futuras = useMemo(
    () => filtered.filter((c) => categoriaCampanha(c) === "futura"),
    [filtered]
  );
  const ativas = useMemo(
    () => filtered.filter((c) => categoriaCampanha(c) === "ativa"),
    [filtered]
  );
  const rascunhos = useMemo(
    () => filtered.filter((c) => categoriaCampanha(c) === "rascunho"),
    [filtered]
  );

  const openNew = () => {
    setEditing(emptyCampanha());
    setDialogOpen(true);
  };

  const openEdit = (c: Campanha) => {
    setEditing({ ...c });
    setDialogOpen(true);
  };

  const saveWithMateriais = (c: Campanha, m: MaterialApoio[]) => {
    const updated = { ...c, materiais: m };
    onSave(updated);
    setEditing(updated);
  };

  const save = () => {
    if (!editing) return;
    if (!editing.nome.trim()) {
      toast.error("Informe o nome da campanha.");
      return;
    }
    onSave(editing);
    toast.success("Campanha salva.");
    setDialogOpen(false);
    setEditing(null);
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
            "absolute inset-x-0 top-0 h-0.5 " +
            (opts.destaque ? "bg-navy" : "bg-primary/70")
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
              <strong className="text-foreground max-w-[300px] truncate">
                {formatFiliais(c.filiais)}
              </strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-primary" />
              <strong className="text-foreground">{count}</strong> produto
              {count === 1 ? "" : "s"} em oferta
            </span>
            {c.materiais.length > 0 && (
              <span className="flex items-center gap-1.5" title="Materiais de apoio">
                <Paperclip className="h-3.5 w-3.5" />
                <strong className="text-foreground">{c.materiais.length}</strong> anexo
                {c.materiais.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Ver produtos e anexos"
                onClick={() => setQuickViewId(c.id)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Imprimir listagem de produtos"
                onClick={() => {
                  printCampanhaPDF(c, ofertas.filter((o) => o.campanhaId === c.id));
                  toast.success("PDF aberto em nova aba.");
                }}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Compartilhar / exportar"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Exportar</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCvCampanha(c)}>
                    <FileDown className="mr-2 h-4 w-4" />
                    CresceVendas (.txt)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDpCampanha(c)}>
                    <ListOrdered className="mr-2 h-4 w-4" />
                    Descrição + Preço
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {!readOnly && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Editar"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Excluir"
                    onClick={() => setDeleteId(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpen(c.id)}
              className="h-8 shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Abrir <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const isFiltering = search.trim().length > 0 || fStatus !== "todos";

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Gerencie as campanhas e ofertas da Central Sumel."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/campanhas-encerradas">
              <Button
                variant="outline"
                className="border-border/80 text-muted-foreground hover:text-navy hover:bg-muted/50"
              >
                <Archive className="mr-2 h-4 w-4 text-primary" />
                Encerradas
                {countEncerradas > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                    {countEncerradas}
                  </Badge>
                )}
              </Button>
            </Link>

            {!readOnly && (
              <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Nova Campanha
              </Button>
            )}
          </div>
        }
      />

      {/* Barra de Filtros e Busca */}
      <div className="rounded-xl border bg-card p-4 mb-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanha por nome ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="Ativa">Ativa</SelectItem>
              <SelectItem value="Programada">Programada</SelectItem>
              {(user?.isAdmin || user?.canSeeDrafts) && (
                <SelectItem value="Rascunho">Rascunho</SelectItem>
              )}
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

      {/* ESTADO VAZIO INTELIGENTE */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent mb-3">
            <Package className="h-6 w-6 text-muted-foreground/60" />
          </div>
          {isFiltering ? (
            <div>
              <p className="text-base font-semibold text-navy">
                Nenhuma campanha encontrada com os filtros atuais.
              </p>
              {search.trim() && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nenhum resultado corresponde à busca &quot;{search}&quot;.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFStatus("todos");
                }}
                className="mt-4 gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Limpar filtros de busca
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-base font-semibold text-navy">
                Nenhuma campanha ativa ou programada no momento.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crie uma nova campanha ou consulte o arquivo de campanhas encerradas.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                {!readOnly && (
                  <Button size="sm" onClick={openNew} className="gap-1.5 text-xs bg-primary">
                    <Plus className="h-3.5 w-3.5" /> Criar primeira campanha
                  </Button>
                )}
                <Link to="/campanhas-encerradas">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Archive className="h-3.5 w-3.5 text-primary" /> Ver campanhas encerradas
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="space-y-6">
          {futuras.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Campanhas Programadas ({futuras.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {futuras.map((c) => renderCard(c))}
              </div>
            </div>
          )}

          {ativas.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Campanhas Ativas ({ativas.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ativas.map((c) => renderCard(c, { destaque: true }))}
              </div>
            </div>
          )}

          {rascunhos.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Rascunhos ({rascunhos.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rascunhos.map((c) => renderCard(c))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Visualização em Lista / Tabela */
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="w-[110px]">Início</TableHead>
                  <TableHead className="w-[110px]">Fim</TableHead>
                  <TableHead className="text-center">Filiais</TableHead>
                  <TableHead className="text-center w-[90px]">Produtos</TableHead>
                  <TableHead className="text-center w-[80px]">Anexos</TableHead>
                  <TableHead className="text-right w-[160px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const count = countByCampanha.get(c.id) ?? 0;
                  const status = statusCampanha(c);
                  return (
                    <TableRow
                      key={c.id}
                      className="group border-border/60 transition-colors hover:bg-accent/60"
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${statusVariant[status]} shrink-0 text-[10px] py-0 h-5`}
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-navy truncate max-w-[200px]">
                        {c.nome}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(c.dataInicial)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(c.dataFinal)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className="text-[11px] text-muted-foreground truncate max-w-[220px] inline-block align-bottom"
                          title={formatFiliais(c.filiais)}
                        >
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
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Ver produtos e anexos"
                            onClick={() => setQuickViewId(c.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Imprimir listagem de produtos"
                            onClick={() => {
                              printCampanhaPDF(
                                c,
                                ofertas.filter((o) => o.campanhaId === c.id)
                              );
                              toast.success("PDF aberto em nova aba.");
                            }}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="Compartilhar / exportar"
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Exportar</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setCvCampanha(c)}>
                                <FileDown className="mr-2 h-4 w-4" />
                                CresceVendas (.txt)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDpCampanha(c)}>
                                <ListOrdered className="mr-2 h-4 w-4" />
                                Descrição + Preço
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {!readOnly && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="Editar"
                                onClick={() => openEdit(c)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                title="Excluir"
                                onClick={() => setDeleteId(c.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpen(c.id)}
                            className="ml-2 h-8 px-2 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground text-xs"
                          >
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
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        campanha={editing}
        setCampanha={setEditing}
        onSave={save}
        onSaveWithMateriais={(m) => editing && saveWithMateriais(editing, m)}
      />

      <CampanhaQuickView
        campanha={quickView}
        ofertas={quickView ? ofertas.filter((o) => o.campanhaId === quickView.id) : []}
        onOpenChange={(v) => {
          if (!v) setQuickViewId(null);
        }}
        onAbrir={(id) => {
          setQuickViewId(null);
          onOpen(id);
        }}
      />

      {cvCampanha && (
        <CresceVendasDialog
          campanha={cvCampanha}
          ofertas={ofertas.filter((o) => o.campanhaId === cvCampanha.id)}
          open={!!cvCampanha}
          onOpenChange={(v) => {
            if (!v) setCvCampanha(null);
          }}
        />
      )}

      {dpCampanha && (
        <DescricaoPrecoDialog
          campanha={dpCampanha}
          ofertas={ofertas.filter((o) => o.campanhaId === dpCampanha.id)}
          open={!!dpCampanha}
          onOpenChange={(v) => {
            if (!v) setDpCampanha(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as ofertas vinculadas a esta campanha também serão excluídas, e eventuais
              oportunidades vinculadas serão liberadas para o Banco de Oportunidades.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  onDelete(deleteId);
                  toast.success("Campanha excluída.");
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
    </div>
  );
}
