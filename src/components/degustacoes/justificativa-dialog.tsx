import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface JustificativaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive" | "secondary";
  onConfirm: (justificativa: string) => Promise<void> | void;
}

export function JustificativaDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  confirmVariant = "default",
  onConfirm,
}: JustificativaDialogProps) {
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = justificativa.trim();
    if (!clean) {
      setError("A justificativa é obrigatória para prosseguir.");
      return;
    }
    if (clean.length < 5) {
      setError("A justificativa deve conter pelo menos 5 caracteres.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await onConfirm(clean);
      setJustificativa("");
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message || "Falha ao registrar justificativa.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setJustificativa("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-navy">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-muted-foreground">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Esta ação será auditada e vinculada ao seu usuário no histórico permanente do
                banco de dados.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="justificativa-input" className="text-xs font-semibold">
                Motivo / Justificativa <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="justificativa-input"
                autoFocus
                placeholder="Descreva detalhadamente o motivo da alteração..."
                value={justificativa}
                onChange={(e) => {
                  setJustificativa(e.target.value);
                  if (error) setError(null);
                }}
                className="min-h-[90px] resize-none"
              />
              {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={confirmVariant}
              disabled={loading || !justificativa.trim()}
            >
              {loading ? "Processando..." : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
