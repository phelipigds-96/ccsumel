import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Search, X, Paperclip, Upload, ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LOJAS_DEGUSTACOES,
  type Degustacao,
  type DegustacaoInsert,
  type AnexoDegustacao,
  uploadDegustacaoArquivo,
  removeDegustacaoArquivo,
  getDegustacaoArquivoUrl,
  parseDegustacaoAnexos,
  isDegustacaoImage,
  DEGUSTACOES_FILE_ACCEPT,
} from "@/lib/degustacoes";
import type { Json } from "@/integrations/supabase/types";

const agendamentoSchema = z
  .object({
    loja: z.string().min(1, "Selecione a loja"),
    fornecedor_id: z.string().min(1, "Selecione o fornecedor"),
    fornecedor_nome: z.string().min(1, "Fornecedor inválido"),
    nome: z.string().min(3, "Informe um nome/tema para a degustação"),
    data: z.string().min(10, "Data inválida (formato AAAA-MM-DD)"),
    horario_inicio: z.string().optional(),
    horario_fim: z.string().optional(),
    responsavel_nome: z.string().min(2, "Informe o promotor ou responsável"),
    observacoes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.horario_inicio && data.horario_fim) {
        return data.horario_fim > data.horario_inicio;
      }
      return true;
    },
    {
      message: "O horário de término deve ser posterior ao horário de início",
      path: ["horario_fim"],
    },
  );

type AgendamentoFormData = z.infer<typeof agendamentoSchema>;

interface FornecedorOption {
  id: string;
  nome: string;
  codigo_interno?: string;
  razao_social?: string;
}

interface AgendamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  degustacaoToEdit?: Degustacao | null;
  onSuccess: (saved: Degustacao) => void;
  userDefaultName?: string;
}

export function AgendamentoDialog({
  open,
  onOpenChange,
  degustacaoToEdit,
  onSuccess,
  userDefaultName = "",
}: AgendamentoDialogProps) {
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [loadingFornecedores, setLoadingFornecedores] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [anexos, setAnexos] = useState<AnexoDegustacao[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // ID persistente para vinculação dos anexos (mesmo para novo registro criado)
  const targetId = React.useMemo(() => {
    return degustacaoToEdit?.id || crypto.randomUUID();
  }, [degustacaoToEdit, open]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AgendamentoFormData>({
    resolver: zodResolver(agendamentoSchema),
    defaultValues: {
      loja: LOJAS_DEGUSTACOES[0],
      fornecedor_id: "",
      fornecedor_nome: "",
      nome: "",
      data: new Date().toISOString().split("T")[0],
      horario_inicio: "10:00",
      horario_fim: "16:00",
      responsavel_nome: userDefaultName,
      observacoes: "",
    },
  });

  const selectedFornecedorId = watch("fornecedor_id");
  const selectedLoja = watch("loja");

  // Estados para busca do fornecedor no Combobox
  const [openFornecedorPopover, setOpenFornecedorPopover] = useState(false);
  const [fornecedorSearch, setFornecedorSearch] = useState("");

  // Carregar lista de fornecedores
  useEffect(() => {
    async function loadFornecedores() {
      setLoadingFornecedores(true);
      try {
        const { data, error } = await supabase
          .from("fornecedores")
          .select("id, nome, codigo_interno, razao_social")
          .order("razao_social", { ascending: true })
          .limit(5000);

        if (!error && data) {
          setFornecedores(data as any);
        }
      } catch (err) {
        console.error("Erro ao carregar fornecedores:", err);
      } finally {
        setLoadingFornecedores(false);
      }
    }

    if (open) {
      loadFornecedores();
    }
  }, [open]);

  // Preencher formulário ao abrir para edição ou novo
  useEffect(() => {
    if (open) {
      if (degustacaoToEdit) {
        setAnexos(parseDegustacaoAnexos(degustacaoToEdit));
        reset({
          loja: degustacaoToEdit.loja,
          fornecedor_id: degustacaoToEdit.fornecedor_id,
          fornecedor_nome: degustacaoToEdit.fornecedor_nome,
          nome: degustacaoToEdit.nome,
          data: degustacaoToEdit.data,
          horario_inicio: degustacaoToEdit.horario_inicio
            ? degustacaoToEdit.horario_inicio.slice(0, 5)
            : "",
          horario_fim: degustacaoToEdit.horario_fim
            ? degustacaoToEdit.horario_fim.slice(0, 5)
            : "",
          responsavel_nome: degustacaoToEdit.responsavel_nome,
          observacoes: degustacaoToEdit.observacoes ?? "",
        });
      } else {
        setAnexos([]);
        reset({
          loja: LOJAS_DEGUSTACOES[0],
          fornecedor_id: "",
          fornecedor_nome: "",
          nome: "",
          data: new Date().toISOString().split("T")[0],
          horario_inicio: "10:00",
          horario_fim: "16:00",
          responsavel_nome: userDefaultName,
          observacoes: "",
        });
      }
    }
  }, [open, degustacaoToEdit, reset, userDefaultName]);

  // Normalização e busca de fornecedores em tempo real (sem lentidão com 1.700+ itens)
  const filteredFornecedores = React.useMemo(() => {
    const query = fornecedorSearch.trim();
    if (!query) {
      return fornecedores.slice(0, 50);
    }

    const normalize = (str: string) =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const normQuery = normalize(query);

    const matches: FornecedorOption[] = [];
    for (const f of fornecedores) {
      const nome = f.razao_social || f.nome || "";
      const cod = f.codigo_interno || "";
      if (normalize(nome).includes(normQuery) || cod.toLowerCase().includes(normQuery)) {
        matches.push(f);
        if (matches.length >= 60) break;
      }
    }
    return matches;
  }, [fornecedores, fornecedorSearch]);

  const selectedFornecedor = React.useMemo(() => {
    if (!selectedFornecedorId) return null;
    const found = fornecedores.find((f) => f.id === selectedFornecedorId);
    if (found) return found;
    const nomeForm = watch("fornecedor_nome");
    if (nomeForm) {
      return { id: selectedFornecedorId, nome: nomeForm, razao_social: nomeForm };
    }
    return null;
  }, [fornecedores, selectedFornecedorId, watch]);

  const handleSelectFornecedor = (fornecedor: FornecedorOption) => {
    handleFornecedorChange(fornecedor.id);
    setOpenFornecedorPopover(false);
    setFornecedorSearch("");
  };

  const handleFornecedorChange = (fornecedorId: string) => {
    const found = fornecedores.find((f) => f.id === fornecedorId);
    if (found) {
      const nomeFinal = found.razao_social || found.nome;
      setValue("fornecedor_id", found.id, { shouldValidate: true });
      setValue("fornecedor_nome", nomeFinal, { shouldValidate: true });

      // Se o campo de nome estiver vazio ou for o padrão, sugere um nome amigável
      const currentNome = watch("nome");
      if (!currentNome || currentNome.startsWith("Degustação")) {
        setValue("nome", `Degustação ${nomeFinal}`);
      }
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingFiles(true);
    const added: AnexoDegustacao[] = [];
    for (const file of Array.from(files)) {
      try {
        const anexo = await uploadDegustacaoArquivo(targetId, file);
        added.push(anexo);
      } catch (err) {
        toast.error((err as Error).message);
      }
    }
    if (added.length > 0) {
      setAnexos((prev) => [...prev, ...added]);
      toast.success(`${added.length} arquivo(s) anexado(s).`);
    }
    setUploadingFiles(false);
  };

  const handleRemoveAnexo = async (anexo: AnexoDegustacao) => {
    try {
      await removeDegustacaoArquivo(anexo);
      setAnexos((prev) => prev.filter((item) => item.path !== anexo.path));
      toast.success("Arquivo removido.");
    } catch (err) {
      toast.error("Erro ao remover arquivo.");
    }
  };

  const handleOpenAnexo = async (anexo: AnexoDegustacao) => {
    try {
      const url = await getDegustacaoArquivoUrl(anexo);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error("Erro ao abrir anexo.");
    }
  };

  const onSubmit = async (values: AgendamentoFormData) => {
    setSubmitting(true);
    try {
      const payload: DegustacaoInsert = {
        loja: values.loja,
        fornecedor_id: values.fornecedor_id,
        fornecedor_nome: values.fornecedor_nome,
        nome: values.nome.trim(),
        data: values.data,
        horario_inicio: values.horario_inicio ? `${values.horario_inicio}:00` : null,
        horario_fim: values.horario_fim ? `${values.horario_fim}:00` : null,
        responsavel_nome: values.responsavel_nome.trim(),
        observacoes: values.observacoes?.trim() ?? "",
        status: degustacaoToEdit ? degustacaoToEdit.status : "Programada",
        anexos: anexos as unknown as Json,
      };

      if (degustacaoToEdit) {
        const { data, error } = await supabase
          .from("degustacoes")
          .update(payload)
          .eq("id", degustacaoToEdit.id)
          .select()
          .single();

        if (error) throw error;
        toast.success("Agendamento atualizado com sucesso!");
        onSuccess(data);
      } else {
        const { data, error } = await supabase
          .from("degustacoes")
          .insert({
            ...payload,
            id: targetId,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success("Degustação agendada com sucesso!");
        onSuccess(data);
      }

      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao salvar agendamento", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="text-navy text-xl">
              {degustacaoToEdit ? "Editar Degustação" : "Novo Agendamento de Degustação"}
            </DialogTitle>
            <DialogDescription>
              {degustacaoToEdit
                ? "Atualize os dados e horários previstos da degustação."
                : "Cadastre uma nova sessão de degustação vinculando a loja, fornecedor e promotor."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Loja */}
            <div className="space-y-1.5">
              <Label htmlFor="loja-select" className="text-xs font-semibold">
                Loja <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedLoja}
                onValueChange={(val) => setValue("loja", val, { shouldValidate: true })}
              >
                <SelectTrigger id="loja-select">
                  <SelectValue placeholder="Selecione a loja..." />
                </SelectTrigger>
                <SelectContent>
                  {LOJAS_DEGUSTACOES.map((loja) => (
                    <SelectItem key={loja} value={loja}>
                      {loja}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.loja && (
                <p className="text-xs text-red-600 font-medium">{errors.loja.message}</p>
              )}
            </div>

            {/* Fornecedor */}
            <div className="space-y-1.5">
              <Label htmlFor="fornecedor-select" className="text-xs font-semibold">
                Fornecedor Parceiro <span className="text-red-500">*</span>
              </Label>
              <Popover open={openFornecedorPopover} onOpenChange={setOpenFornecedorPopover}>
                <PopoverTrigger asChild>
                  <Button
                    id="fornecedor-select"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={openFornecedorPopover}
                    disabled={loadingFornecedores}
                    className={cn(
                      "w-full justify-between font-normal text-left h-10 px-3 border-input bg-background",
                      !selectedFornecedor && "text-muted-foreground",
                      errors.fornecedor_id && "border-red-500 ring-1 ring-red-500",
                    )}
                  >
                    {selectedFornecedor ? (
                      <span className="truncate flex items-center gap-2">
                        {selectedFornecedor.codigo_interno && (
                          <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-muted text-foreground">
                            [{selectedFornecedor.codigo_interno}]
                          </span>
                        )}
                        <span className="truncate font-medium text-foreground">
                          {selectedFornecedor.razao_social || selectedFornecedor.nome}
                        </span>
                      </span>
                    ) : (
                      <span>
                        {loadingFornecedores
                          ? "Carregando fornecedores..."
                          : "Clique para buscar ou digitar o fornecedor..."}
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0 shadow-lg" align="start">
                  <Command shouldFilter={false} className="w-full">
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <input
                        value={fornecedorSearch}
                        onChange={(e) => setFornecedorSearch(e.target.value)}
                        placeholder="Digite o nome ou código..."
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        autoFocus
                      />
                      {fornecedorSearch && (
                        <button
                          type="button"
                          onClick={() => setFornecedorSearch("")}
                          className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <CommandList className="max-h-60 overflow-y-auto p-1">
                      {filteredFornecedores.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          Nenhum fornecedor encontrado para "{fornecedorSearch}".
                        </div>
                      ) : (
                        filteredFornecedores.map((f) => {
                          const isSelected = f.id === selectedFornecedorId;
                          return (
                            <div
                              key={f.id}
                              onClick={() => handleSelectFornecedor(f)}
                              className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                                isSelected && "bg-accent font-semibold",
                              )}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 text-primary shrink-0",
                                  isSelected ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div className="flex-1 truncate">
                                {f.codigo_interno && (
                                  <span className="font-mono text-xs font-semibold mr-1.5 px-1 py-0.5 rounded bg-muted">
                                    [{f.codigo_interno}]
                                  </span>
                                )}
                                <span>{f.razao_social || f.nome}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CommandList>
                    <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/30 flex justify-between items-center">
                      <span>{fornecedores.length.toLocaleString("pt-BR")} cadastrados</span>
                      {fornecedorSearch && (
                        <span>Exibindo até 60 resultados</span>
                      )}
                    </div>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.fornecedor_id && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.fornecedor_id.message}
                </p>
              )}
            </div>

            {/* Nome / Tema da Degustação */}
            <div className="space-y-1.5">
              <Label htmlFor="nome-input" className="text-xs font-semibold">
                Título / Tema da Degustação <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nome-input"
                placeholder="Ex: Degustação Queijos Tirolez e Vinhos"
                {...register("nome")}
              />
              {errors.nome && (
                <p className="text-xs text-red-600 font-medium">{errors.nome.message}</p>
              )}
            </div>

            {/* Data e Horários */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="data-input" className="text-xs font-semibold">
                  Data do Evento <span className="text-red-500">*</span>
                </Label>
                <Input id="data-input" type="date" {...register("data")} />
                {errors.data && (
                  <p className="text-xs text-red-600 font-medium">{errors.data.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="horario-inicio" className="text-xs font-semibold">
                  Início
                </Label>
                <Input id="horario-inicio" type="time" {...register("horario_inicio")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="horario-fim" className="text-xs font-semibold">
                  Término
                </Label>
                <Input id="horario-fim" type="time" {...register("horario_fim")} />
              </div>
            </div>
            {errors.horario_fim && (
              <p className="text-xs text-red-600 font-medium">
                {errors.horario_fim.message}
              </p>
            )}

            {/* Promotor / Responsável */}
            <div className="space-y-1.5">
              <Label htmlFor="responsavel-input" className="text-xs font-semibold">
                Promotor / Responsável em Loja <span className="text-red-500">*</span>
              </Label>
              <Input
                id="responsavel-input"
                placeholder="Nome do promotor da marca ou colaborador"
                {...register("responsavel_nome")}
              />
              {errors.responsavel_nome && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.responsavel_nome.message}
                </p>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="obs-input" className="text-xs font-semibold">
                Observações e Diretrizes
              </Label>
              <Textarea
                id="obs-input"
                placeholder="Orientações sobre balcão, ponto de venda, fita térmica, uniformes, etc."
                className="resize-none min-h-[65px]"
                {...register("observacoes")}
              />
            </div>

            {/* Materiais para Impressão e Decoração do Espaço */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-navy flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-primary" />
                  Materiais para Impressão e Decoração
                </Label>
                <span className="text-[11px] text-muted-foreground">PDF, JPG, PNG (até 20 MB)</span>
              </div>

              <label
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 cursor-pointer transition text-center",
                  uploadingFiles
                    ? "opacity-60 pointer-events-none bg-muted/40"
                    : "hover:border-primary hover:bg-primary/5 border-muted-foreground/25 bg-muted/10"
                )}
              >
                <Upload className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-navy">
                  {uploadingFiles ? "Enviando arquivo(s)..." : "Clique para anexar ou arraste arquivos"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Cartazes, artes de testeira, encartes e fotos do ponto de degustação
                </span>
                <input
                  type="file"
                  accept={DEGUSTACOES_FILE_ACCEPT}
                  multiple
                  className="hidden"
                  disabled={uploadingFiles}
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>

              {anexos.length > 0 && (
                <ul className="grid gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {anexos.map((m) => (
                    <li
                      key={m.path}
                      className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs shadow-2xs group hover:border-primary/40 transition"
                    >
                      {isDegustacaoImage(m.tipo) ? (
                        <ImageIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenAnexo(m)}
                        className="flex-1 text-left truncate font-medium hover:underline text-navy"
                        title="Clique para visualizar ou baixar"
                      >
                        {m.nome}
                      </button>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {(m.tamanho / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAnexo(m)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded-sm transition"
                        title="Remover anexo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90">
              {submitting ? "Salvando..." : degustacaoToEdit ? "Salvar Alterações" : "Criar Agendamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
