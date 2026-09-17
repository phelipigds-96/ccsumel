import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOJAS } from "@/lib/produtos-em-falta";
import {
  createSolicitacao,
  SOLICITACAO_URGENCIAS,
  type SolicitacaoUrgencia,
} from "@/lib/solicitacoes-produtos";

interface SolicitacaoNovoProdutoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loja?: string | null;
  nomePadrao?: string;
  termoBusca?: string;
  onCreated?: () => void;
}

interface FormState {
  nome: string;
  marca: string;
  categoria: string;
  gramagem_volume: string;
  gtin: string;
  observacao: string;
  motivo: string;
  quantidade: string;
  urgencia: SolicitacaoUrgencia;
}

const FORM_VAZIO: FormState = {
  nome: "",
  marca: "",
  categoria: "",
  gramagem_volume: "",
  gtin: "",
  observacao: "",
  motivo: "",
  quantidade: "1",
  urgencia: "Normal",
};

export function SolicitacaoNovoProdutoDialog({
  open,
  onOpenChange,
  loja,
  nomePadrao,
  termoBusca,
  onCreated,
}: SolicitacaoNovoProdutoDialogProps) {
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [solicitante, setSolicitante] = useState("");
  const [lojaSel, setLojaSel] = useState<string>(loja ?? LOJAS[0] ?? "Matriz");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...FORM_VAZIO, nome: (termoBusca ?? "").trim() });
    setSolicitante(nomePadrao ?? "");
    setLojaSel(loja ?? LOJAS[0] ?? "Matriz");
  }, [open, termoBusca, nomePadrao, loja]);

  const salvar = async () => {
    if (!solicitante.trim()) {
      toast.error("Informe o nome de quem está solicitando.");
      return;
    }
    if (!form.nome.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    if (!form.marca.trim()) {
      toast.error("Informe a marca do produto.");
      return;
    }
    if (!form.gramagem_volume.trim()) {
      toast.error("Informe a gramagem ou o volume.");
      return;
    }
    if (!form.categoria.trim()) {
      toast.error("Informe a categoria do produto.");
      return;
    }

    setSalvando(true);
    try {
      await createSolicitacao({
        store_id: lojaSel,
        reported_by_name: solicitante,
        nome: form.nome,
        marca: form.marca,
        categoria: form.categoria,
        gramagem_volume: form.gramagem_volume,
        gtin: form.gtin,
        observacao: form.observacao,
        motivo: form.motivo,
        quantidade_solicitada: Number(form.quantidade) || 1,
        urgencia: form.urgencia,
      });
      toast.success("Solicitação enviada!", {
        description: "A equipe de Compras vai analisar o cadastro deste produto.",
      });
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível enviar a solicitação", {
        description: (e as Error).message,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-left">Solicitar novo produto</DialogTitle>
          <DialogDescription className="text-left">
            O produto não está no catálogo? Preencha os dados abaixo e envie para a equipe de Compras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Quem está solicitando? *</Label>
            <Input
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              placeholder="Digite seu nome"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Loja</Label>
            {loja ? (
              <p className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-semibold">
                {loja}
              </p>
            ) : (
              <Select value={lojaSel} onValueChange={setLojaSel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOJAS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Nome do produto *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Refrigerante Cola 2L"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Marca *</Label>
              <Input
                value={form.marca}
                onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                placeholder="Ex.: Marca X"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Gramagem / Volume *</Label>
              <Input
                value={form.gramagem_volume}
                onChange={(e) => setForm((f) => ({ ...f, gramagem_volume: e.target.value }))}
                placeholder="Ex.: 2 L, 500 g, 1 kg"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Categoria *</Label>
              <Input
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                placeholder="Ex.: Bebidas, Mercearia, Limpeza"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Código de barras (EAN)</Label>
              <Input
                value={form.gtin}
                onChange={(e) => setForm((f) => ({ ...f, gtin: e.target.value }))}
                placeholder="Opcional"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Quantidade estimada</Label>
              <Input
                value={form.quantidade}
                onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
                inputMode="decimal"
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Urgência</Label>
              <Select
                value={form.urgencia}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, urgencia: v as SolicitacaoUrgencia }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOLICITACAO_URGENCIAS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Motivo da solicitação</Label>
            <Textarea
              rows={2}
              value={form.motivo}
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
              placeholder="Ex.: clientes pedem o produto e não temos no mix"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Observação</Label>
            <Textarea
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              placeholder="Informações extras para a equipe de Compras"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
