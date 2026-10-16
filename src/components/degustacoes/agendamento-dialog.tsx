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
  LOJAS_DEGUSTACOES,
  type Degustacao,
  type DegustacaoInsert,
} from "@/lib/degustacoes";

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

  // Carregar lista de fornecedores
  useEffect(() => {
    async function loadFornecedores() {
      setLoadingFornecedores(true);
      try {
        const { data, error } = await supabase
          .from("fornecedores")
          .select("id, nome, codigo_interno, razao_social")
          .order("razao_social", { ascending: true });

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
          .insert(payload)
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
              <Select
                value={selectedFornecedorId}
                onValueChange={handleFornecedorChange}
                disabled={loadingFornecedores}
              >
                <SelectTrigger id="fornecedor-select">
                  <SelectValue
                    placeholder={
                      loadingFornecedores
                        ? "Carregando fornecedores..."
                        : "Selecione o fornecedor..."
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {fornecedores.map((f) => {
                    const label = f.codigo_interno
                      ? `[${f.codigo_interno}] ${f.razao_social || f.nome}`
                      : (f.razao_social || f.nome);
                    return (
                      <SelectItem key={f.id} value={f.id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
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
                className="resize-none min-h-[70px]"
                {...register("observacoes")}
              />
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
