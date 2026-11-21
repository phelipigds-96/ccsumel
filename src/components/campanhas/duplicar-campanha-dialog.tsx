import { useState, useEffect } from "react";
import { Copy, Calendar, Package, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { type Campanha } from "./types";

interface DuplicarCampanhaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanha: Campanha | null;
  ofertasCount: number;
  onDuplicate: (
    origem: Campanha,
    novoNome: string,
    novaDataIni: string,
    novaDataFim: string,
    clonarOfertas: boolean,
    clonarMateriais: boolean
  ) => void;
}

const addDays = (d: Date, days: number) => {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
};

const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function DuplicarCampanhaDialog({
  open,
  onOpenChange,
  campanha,
  ofertasCount,
  onDuplicate,
}: DuplicarCampanhaDialogProps) {
  const [novoNome, setNovoNome] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [clonarOfertas, setClonarOfertas] = useState(true);
  const [clonarMateriais, setClonarMateriais] = useState(true);

  useEffect(() => {
    if (campanha && open) {
      setNovoNome(`${campanha.nome} (Cópia)`);
      const hoje = new Date();
      setDataInicial(toIsoDate(hoje));
      setDataFinal(toIsoDate(addDays(hoje, 7)));
      setClonarOfertas(true);
      setClonarMateriais(true);
    }
  }, [campanha, open]);

  if (!campanha) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    onDuplicate(
      campanha,
      novoNome.trim(),
      dataInicial,
      dataFinal,
      clonarOfertas,
      clonarMateriais
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-navy text-lg">
              <Copy className="h-5 w-5 text-primary" /> Duplicar Campanha
            </DialogTitle>
            <DialogDescription>
              Crie uma nova campanha baseada em <strong>{campanha.nome}</strong> mantendo suas
              configurações e ofertas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Nome da Nova Campanha</Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Quarta do Hortifruti - Semana 48"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data Inicial
                </Label>
                <Input
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data Final
                </Label>
                <Input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/20 p-3 pt-2.5">
              <p className="text-xs font-semibold text-navy">O que deseja clonar?</p>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={clonarOfertas}
                  onChange={(e) => setClonarOfertas(e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <Package className="h-3.5 w-3.5 text-primary" />
                <span>
                  Replicar <strong>{ofertasCount}</strong> produto(s) em oferta
                </span>
              </label>

              {campanha.materiais.length > 0 && (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clonarMateriais}
                    onChange={(e) => setClonarMateriais(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <Paperclip className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Copiar <strong>{campanha.materiais.length}</strong> anexo(s) de apoio
                  </span>
                </label>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-white">
              Duplicar Ação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
