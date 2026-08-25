import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Scale,
  Search,
  Plus,
  Upload,
  Pencil,
  Trash2,
  Loader2,
  PackageSearch,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_app/fracionamento")({
  head: () => ({
    meta: [
      { title: "Fracionamento — Central de Campanhas Sumel" },
      {
        name: "description",
        content:
          "Consulta rápida de códigos de balança dos produtos do setor de Fracionamento.",
      },
    ],
  }),
  component: FracionamentoPage,
});

type FracionamentoProduto = {
  id: string;
  codigo_balanca: string;
  descricao: string;
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

async function listFracionamento(): Promise<FracionamentoProduto[]> {
  const { data, error } = await supabase
    .from("fracionamento_produtos" as any)
    .select("id, codigo_balanca, descricao")
    .order("descricao", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FracionamentoProduto[];
}

function FracionamentoPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [produtos, setProdutos] = useState<FracionamentoProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("consulta");

  const load = async () => {
    try {
      setProdutos(await listFracionamento());
    } catch (e: any) {
      toast.error("Erro ao carregar produtos do fracionamento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy text-navy-foreground shadow-sm">
          <Scale className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold uppercase tracking-tight text-navy sm:text-xl">
            Fracionamento
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Consulte rapidamente o código de balança de um produto
          </p>
        </div>
      </div>

      {isAdmin ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="consulta">Consulta de Códigos</TabsTrigger>
            <TabsTrigger value="gestao">Gestão / Importação</TabsTrigger>
          </TabsList>
          <TabsContent value="consulta">
            <Consulta produtos={produtos} loading={loading} />
          </TabsContent>
          <TabsContent value="gestao">
            <Gestao produtos={produtos} loading={loading} onChanged={load} />
          </TabsContent>
        </Tabs>
      ) : (
        <Consulta produtos={produtos} loading={loading} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Consulta                                                            */
/* ------------------------------------------------------------------ */

function Consulta({
  produtos,
  loading,
}: {
  produtos: FracionamentoProduto[];
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const resultados = useMemo(() => {
    const term = normalize(search);
    if (!term) return produtos;
    return produtos.filter(
      (p) =>
        normalize(p.descricao).includes(term) ||
        normalize(p.codigo_balanca).includes(term),
    );
  }, [produtos, search]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar produto ou código..."
          className="h-14 rounded-2xl border-border/80 bg-card pl-12 text-base shadow-sm focus-visible:ring-primary sm:text-lg"
        />
      </div>

      <div className="mt-3 flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          {loading
            ? "Carregando produtos..."
            : `${resultados.length} produto${resultados.length === 1 ? "" : "s"}`}
        </span>
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="font-medium text-primary hover:underline"
          >
            Limpar busca
          </button>
        )}
      </div>

      {!loading && resultados.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-muted-foreground">
          <PackageSearch className="h-10 w-10 opacity-40" />
          <p className="text-sm">
            Nenhum produto encontrado para <strong>"{search}"</strong>.
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {resultados.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className="text-sm font-semibold leading-snug text-foreground"
              title={p.descricao}
            >
              {p.descricao}
            </div>
            <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Código de balança
            </div>
            <div className="mt-1 text-center text-5xl font-bold tabular-nums tracking-tight text-primary">
              {p.codigo_balanca}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gestão / Importação                                                 */
/* ------------------------------------------------------------------ */

function Gestao({
  produtos,
  loading,
  onChanged,
}: {
  produtos: FracionamentoProduto[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FracionamentoProduto | null>(null);
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<FracionamentoProduto | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const term = normalize(search);
    if (!term) return produtos;
    return produtos.filter(
      (p) =>
        normalize(p.descricao).includes(term) ||
        normalize(p.codigo_balanca).includes(term),
    );
  }, [produtos, search]);

  const openNew = () => {
    setEditing(null);
    setCodigo("");
    setDescricao("");
    setDialogOpen(true);
  };

  const openEdit = (p: FracionamentoProduto) => {
    setEditing(p);
    setCodigo(p.codigo_balanca);
    setDescricao(p.descricao);
    setDialogOpen(true);
  };

  const save = async () => {
    const cod = codigo.trim();
    const desc = descricao.trim();
    if (!cod || !desc) {
      toast.error("Informe o código de balança e a descrição.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("fracionamento_produtos" as any)
          .update({ codigo_balanca: cod, descricao: desc } as any)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Produto atualizado.");
      } else {
        const { error } = await supabase
          .from("fracionamento_produtos" as any)
          .upsert(
            { codigo_balanca: cod, descricao: desc } as any,
            { onConflict: "codigo_balanca" },
          );
        if (error) throw error;
        toast.success("Produto cadastrado.");
      }
      setDialogOpen(false);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase
        .from("fracionamento_produtos" as any)
        .delete()
        .eq("id", deleting.id);
      if (error) throw error;
      toast.success("Produto excluído.");
      setDeleting(null);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir produto.");
    }
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const rows: { codigo_balanca: string; descricao: string }[] = [];

      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const cells = line
          .split(/[;\t,]/)
          .map((c) => c.trim().replace(/^"|"$/g, ""))
          .filter(Boolean);
        if (cells.length < 2) continue;

        const codeIdx = cells.findIndex((c) => /^\d+$/.test(c));
        if (codeIdx === -1) continue; // header or invalid line
        const descIdx = codeIdx === 0 ? 1 : 0;
        if (!cells[descIdx]) continue;

        rows.push({
          codigo_balanca: cells[codeIdx],
          descricao: cells[descIdx].toUpperCase(),
        });
      }

      if (rows.length === 0) {
        toast.error(
          "Nenhum produto válido encontrado. Use o formato: código;descrição (uma linha por produto).",
        );
        return;
      }

      const { error } = await supabase
        .from("fracionamento_produtos" as any)
        .upsert(rows as any, { onConflict: "codigo_balanca" });
      if (error) throw error;

      toast.success(`${rows.length} produto(s) importado(s) com sucesso.`);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao importar arquivo.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar na lista..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportFile(f);
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Importar CSV/TXT
          </Button>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo produto
          </Button>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Formato do arquivo: uma linha por produto, no padrão{" "}
        <code className="rounded bg-muted px-1 py-0.5">
          código;descrição
        </code>{" "}
        (ex.: <code className="rounded bg-muted px-1 py-0.5">255;AÇÚCAR COLORIDO KG</code>).
        Códigos já existentes são atualizados automaticamente.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Código de balança</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum produto cadastrado. Importe um arquivo ou cadastre
                  manualmente.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold tabular-nums text-primary">
                    {p.codigo_balanca}
                  </TableCell>
                  <TableCell className="font-medium">{p.descricao}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(p)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleting(p)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar produto" : "Novo produto"}
            </DialogTitle>
            <DialogDescription>
              Informe o código de balança e a descrição do produto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="frac-codigo">Código de balança</Label>
              <Input
                id="frac-codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex.: 255"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frac-descricao">Descrição do produto</Label>
              <Input
                id="frac-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.toUpperCase())}
                placeholder="Ex.: AÇÚCAR COLORIDO KG"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto <strong>{deleting?.descricao}</strong> (código{" "}
              {deleting?.codigo_balanca}) será removido da consulta de
              fracionamento. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void remove()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
