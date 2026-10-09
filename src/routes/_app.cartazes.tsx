import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CartazTemplate, defaultLayoutConfig } from "@/lib/pdf-cartazes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/cartazes")({
  head: () => ({
    meta: [{ title: "Gestão de Modelos de Cartazes" }],
  }),
  component: CartazesPage,
});

function CartazesPage() {
  const [templates, setTemplates] = useState<CartazTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CartazTemplate> | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("cartaz_templates" as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      setTemplates((data as any) || []);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar modelos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleOpenNew = () => {
    setEditing({
      nome: "",
      bg_url: null,
      config: JSON.parse(JSON.stringify(defaultLayoutConfig)),
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (t: CartazTemplate) => {
    setEditing(JSON.parse(JSON.stringify(t)));
    setDialogOpen(true);
  };

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `templates/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("campanha-materiais")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("campanha-materiais")
        .getPublicUrl(path);
      
      setEditing({ ...editing, bg_url: data.publicUrl });
      toast.success("Fundo enviado com sucesso");
    } catch (err: any) {
      toast.error(err.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!editing?.nome) {
      toast.error("O modelo precisa de um nome");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        nome: editing.nome,
        bg_url: editing.bg_url,
        config: editing.config,
      };

      if (editing.id) {
        const { error } = await supabase
          .from("cartaz_templates" as any)
          .update(payload as any)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cartaz_templates" as any)
          .insert(payload as any);
        if (error) throw error;
      }
      toast.success("Modelo salvo!");
      setDialogOpen(false);
      void load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este modelo?")) return;
    try {
      const { error } = await supabase
        .from("cartaz_templates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Modelo apagado");
      void load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao apagar");
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-navy">
            Modelos de Cartazes
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure as artes de fundo e posições de impressão
          </p>
        </div>
        <Button onClick={handleOpenNew}>
          <Plus className="mr-2 h-4 w-4" /> Novo Modelo
        </Button>
      </div>

      {loading && templates.length === 0 ? (
        <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <div className="aspect-[210/148] w-full bg-muted/50 p-2">
                {t.bg_url ? (
                  <img
                    src={t.bg_url}
                    alt={t.nome}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Sem Fundo
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-4">
                <strong className="text-sm">{t.nome}</strong>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(t)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remover(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Modelo" : "Novo Modelo"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>Nome do Modelo (ex: Oferta Findi)</Label>
                <Input
                  value={editing.nome || ""}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Imagem de Fundo (Proporção 210x148.5 - Meia A4)</Label>
                <div className="flex items-center gap-4">
                  {editing.bg_url && (
                    <img src={editing.bg_url} alt="Fundo" className="h-16 w-auto rounded border" />
                  )}
                  <Button variant="secondary" asChild disabled={uploading}>
                    <label className="cursor-pointer">
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                      Upload de Fundo
                      <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleUploadBg} />
                    </label>
                  </Button>
                </div>
              </div>

              {/* SIMPLES EDITOR DE COORDENADAS PARA V1 */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <h3 className="mb-2 text-sm font-semibold">Configurações Avançadas (Coordenadas X/Y)</h3>
                <p className="mb-4 text-xs text-muted-foreground">Largura da folha = 210, Altura = 148.5. O eixo X é da esquerda para direita, Y é de cima para baixo.</p>
                
                <div className="grid grid-cols-2 gap-4">
                  {(["produto", "precoPromo"] as const).map((key) => {
                    const cfg = editing.config?.[key];
                    if (!cfg) return null;
                    return (
                      <div key={key} className="space-y-2 rounded border bg-card p-3">
                        <Label className="uppercase text-primary">{key}</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Posição X</Label>
                            <Input
                              type="number"
                              value={cfg.x}
                              onChange={(e) => {
                                const newConfig = { ...editing.config };
                                newConfig[key].x = Number(e.target.value);
                                setEditing({ ...editing, config: newConfig });
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Posição Y</Label>
                            <Input
                              type="number"
                              value={cfg.y}
                              onChange={(e) => {
                                const newConfig = { ...editing.config };
                                newConfig[key].y = Number(e.target.value);
                                setEditing({ ...editing, config: newConfig });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
