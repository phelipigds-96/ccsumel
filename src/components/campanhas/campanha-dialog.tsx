import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MateriaisUploader } from "./materiais-uploader";
import {
  type Campanha,
  type MaterialApoio,
  type Status,
  FILIAIS,
  statusCampanha,
  statusVariant,
} from "./types";

interface CampanhaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanha: Campanha | null;
  setCampanha: (c: Campanha | null) => void;
  onSave: () => void;
  onSaveWithMateriais: (m: MaterialApoio[]) => void;
}

export function CampanhaDialog({
  open,
  onOpenChange,
  campanha,
  setCampanha,
  onSave,
  onSaveWithMateriais,
}: CampanhaDialogProps) {
  if (!campanha) return null;

  const upd = <K extends keyof Campanha>(k: K, v: Campanha[K]) =>
    setCampanha({ ...campanha, [k]: v });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>{campanha.nome ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
            <DialogDescription>
              Defina o período, o status e os materiais de apoio da campanha.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5 w-full">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input
                value={campanha.nome}
                onChange={(e) => upd("nome", e.target.value)}
                placeholder="Ex: Ofertas da Semana"
              />
            </div>

            <div className="grid gap-1.5 w-full">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea
                value={campanha.descricao}
                onChange={(e) => upd("descricao", e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5 w-full">
                <Label className="text-xs text-muted-foreground">Data Inicial</Label>
                <Input
                  type="date"
                  value={campanha.dataInicial}
                  onChange={(e) => upd("dataInicial", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5 w-full">
                <Label className="text-xs text-muted-foreground">Data Final</Label>
                <Input
                  type="date"
                  value={campanha.dataFinal}
                  onChange={(e) => upd("dataFinal", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5 w-full">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={campanha.status === "Rascunho"}
                    onChange={(e) =>
                      upd(
                        "status",
                        (e.target.checked
                          ? "Rascunho"
                          : statusCampanha({ ...campanha, status: "Ativa" })) as Status
                      )
                    }
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
            </div>

            <div className="grid gap-1.5 w-full">
              <Label className="text-xs text-muted-foreground">
                Filiais participantes (selecione uma ou mais)
              </Label>
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
                          upd(
                            "filiais",
                            e.target.checked
                              ? [...atuais, f]
                              : atuais.filter((x) => x !== f)
                          );
                        }}
                        className="h-4 w-4 accent-primary"
                      />
                      {f}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md border p-3">
              <Switch
                checked={campanha.clubeSumel ?? false}
                onCheckedChange={(v) => upd("clubeSumel", v)}
                id="camp-clube"
              />
              <Label htmlFor="camp-clube" className="cursor-pointer">
                Campanha Clube Sumel (as novas ofertas herdam essa marcação)
              </Label>
            </div>

            <MateriaisUploader
              campanhaId={campanha.id}
              materiais={campanha.materiais}
              onChange={(m) => upd("materiais", m)}
              onDirectSave={campanha.nome ? (m) => onSaveWithMateriais(m) : undefined}
            />
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={onSave} className="bg-primary hover:bg-primary/90">
              Salvar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
