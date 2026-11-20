import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { FILIAIS } from "./types";

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => void;
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: BulkDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {count} oferta(s) selecionada(s)?</AlertDialogTitle>
          <AlertDialogDescription>
            Todas as {count} ofertas selecionadas serão removidas desta campanha. Caso algum
            produto tenha vindo do Banco de Oportunidades, ele voltará a ficar Disponível. Esta
            ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Excluir {count} ofertas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface BulkFiliaisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  filiaisPermitidas: string[];
  onApply: (filiais: string[]) => void;
}

export function BulkFiliaisDialog({
  open,
  onOpenChange,
  count,
  filiaisPermitidas,
  onApply,
}: BulkFiliaisDialogProps) {
  const allowed = filiaisPermitidas.length > 0 ? filiaisPermitidas : FILIAIS;
  const [selected, setSelected] = useState<string[]>(allowed);

  const handleApply = () => {
    onApply(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Filiais em Lote</DialogTitle>
          <DialogDescription>
            Defina as filiais participantes para as <strong>{count}</strong> oferta(s)
            selecionada(s).
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          <Label className="text-xs text-muted-foreground mb-2 block">
            Filiais que receberão as ofertas selecionadas:
          </Label>
          <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
            {allowed.map((f) => {
              const checked = selected.includes(f);
              return (
                <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected([...selected, f]);
                      } else {
                        setSelected(selected.filter((x) => x !== f));
                      }
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{f}</span>
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApply} className="bg-primary hover:bg-primary/90">
            Aplicar às {count} ofertas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
