import { useState } from "react";
import { Upload, FileText, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { type MaterialApoio } from "./types";

const BUCKET = "campanha-materiais";
const ACCEPT = "image/jpeg,image/jpg,image/png,application/pdf";

function isImage(tipo: string) {
  return tipo.startsWith("image/");
}

interface MateriaisUploaderProps {
  campanhaId: string;
  materiais: MaterialApoio[];
  onChange: (m: MaterialApoio[]) => void;
  onDirectSave?: (m: MaterialApoio[]) => void;
}

export function MateriaisUploader({
  campanhaId,
  materiais,
  onChange,
  onDirectSave,
}: MateriaisUploaderProps) {
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
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) {
        toast.error(`Falha ao enviar ${file.name}: ${error.message}`);
        continue;
      }
      added.push({ path, nome: file.name, tipo: file.type, tamanho: file.size });
    }

    if (added.length) {
      const novo = [...materiais, ...added];
      onChange(novo);
      if (onDirectSave) {
        onDirectSave(novo);
      }
      toast.success(`${added.length} arquivo(s) anexado(s).`);
    }

    setUploading(false);
  };

  const remove = async (m: MaterialApoio) => {
    await supabase.storage.from(BUCKET).remove([m.path]);
    const novo = materiais.filter((x) => x.path !== m.path);
    onChange(novo);
    if (onDirectSave) onDirectSave(novo);
    toast.success("Arquivo removido.");
  };

  const openMaterial = async (m: MaterialApoio) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(m.path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao abrir arquivo. Tentando URL pública...");
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(m.path);
      if (publicData?.publicUrl) {
        window.open(publicData.publicUrl, "_blank", "noopener");
      }
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">
        Materiais de apoio para as lojas (JPG, PNG, PDF — até 20 MB)
      </Label>
      <label
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 cursor-pointer transition ${
          uploading
            ? "opacity-60 pointer-events-none"
            : "hover:border-primary hover:bg-primary/5"
        }`}
      >
        <Upload className="h-6 w-6 text-primary" />
        <span className="text-sm font-medium text-navy">
          {uploading ? "Enviando..." : "Clique para anexar ou arraste arquivos"}
        </span>
        <span className="text-xs text-muted-foreground">
          Cartazes, encartes, imagens de gôndola, PDF de campanha
        </span>
        <input
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {materiais.length > 0 && (
        <ul className="grid gap-1.5">
          {materiais.map((m) => (
            <li
              key={m.path}
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
            >
              {isImage(m.tipo) ? (
                <ImageIcon className="h-4 w-4 text-navy shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-primary shrink-0" />
              )}
              <button
                type="button"
                onClick={() => openMaterial(m)}
                className="flex-1 text-left truncate hover:underline text-navy"
              >
                {m.nome}
              </button>
              <span className="text-xs text-muted-foreground">
                {(m.tamanho / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => remove(m)}
                className="text-muted-foreground hover:text-destructive"
                title="Remover"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
