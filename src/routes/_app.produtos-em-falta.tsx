import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingCart, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ProductSearch } from "@/components/product-search";
import type { Produto } from "@/lib/produtos";
import { toast } from "sonner";
import {
  listFaltas, createFalta, FALTA_STATUS, LOJAS,
  type ProdutoEmFalta, type FaltaStatus,
} from "@/lib/produtos-em-falta";

export const Route = createFileRoute("/_app/produtos-em-falta")({
  head: () => ({
    meta: [
      { title: "Produtos em Falta — Central de Campanhas Sumel" },
      { name: "description", content: "Registro de produtos não encontrados na loja pelos colaboradores, com acompanhamento pela equipe de Compras." },
      { property: "og:title", content: "Produtos em Falta — Central de Campanhas Sumel" },
      { property: "og:description", content: "Aponte produtos que não foram encontrados na loja e acompanhe a situação de cada ocorrência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProdutosEmFaltaPage,
});

const statusTone = (s: FaltaStatus) => {
  if (s === "Pendente") return "bg-amber-100 text-amber-800";
  if (s === "Resolvido" || s === "Não é ruptura") return "bg-emerald-100 text-emerald-800";
  if (s === "Falta no fornecedor" || s === "Produto descontinuado") return "bg-destructive/10 text-destructive";
  return "bg-navy/10 text-navy";
};

function ProdutosEmFaltaPage() {
  const [rows, setRows] = useState<ProdutoEmFalta[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FaltaStatus | "todos">("todos");
  const [filtroLoja, setFiltroLoja] = useState<string>("todas");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [produto, setProduto] = useState<Produto | null>(null);
  const [loja, setLoja] = useState(LOJAS[0]);
  const [nome, setNome] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listFaltas({ status: filtroStatus, loja: filtroLoja, busca }));
    } catch (e) {
      toast.error("Falha ao carregar os apontamentos", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, filtroStatus, filtroLoja]);

  const resetForm = () => {
    setProduto(null);
    setObs("");
  };

  const submit = async () => {
    if (!produto) return toast.error("Selecione o produto que está em falta.");
    if (!nome.trim()) return toast.error("Informe o seu nome.");
    setSaving(true);
    try {
      await createFalta({
        product_id: produto.id,
        store_id: loja,
        reported_by_name: nome,
        observation: obs,
      });
      toast.success("Falta registrada", { description: produto.descricao });
      resetForm();
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error("Não foi possível registrar", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Produtos em Falta"
        description="Aponte produtos que não foram encontrados na loja. A equipe de Compras analisa cada registro."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Registrar falta
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Input
          placeholder="Buscar por produto, código ou quem apontou"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as FaltaStatus | "todos")}>
          <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {FALTA_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroLoja} onValueChange={setFiltroLoja}>
          <SelectTrigger><SelectValue placeholder="Loja" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as lojas</SelectItem>
            {LOJAS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-primary">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Nenhum apontamento registrado.</p>
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-navy">{r.produto?.descricao ?? "Produto"}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.produto?.codigo, r.produto?.gtin].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge className={`${statusTone(r.status)} border-0`}>{r.status}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {r.store_id} · apontado por <span className="font-medium text-foreground">{r.reported_by_name}</span> em{" "}
              {new Date(r.reported_at).toLocaleString("pt-BR")}
            </p>
            {r.observation && <p className="mt-1 text-sm">{r.observation}</p>}
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar produto em falta</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produto</Label>
              {produto ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-accent/40 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{produto.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {[produto.codigo, produto.gtin].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setProduto(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <ProductSearch
                  onSelect={setProduto}
                  placeholder="Buscar por código, código de barras ou descrição"
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Loja</Label>
                <Select value={loja} onValueChange={setLoja}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOJAS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Seu nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Quem está apontando" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Opcional" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Registrar falta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
