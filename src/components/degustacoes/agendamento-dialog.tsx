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
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ChevronsUpDown,
  Search,
  X,
  Paperclip,
  Upload,
  ImageIcon,
  FileText,
  Plus,
  Tag,
  Package,
  Trash2,
} from "lucide-react";
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
  listDegustacaoProdutos,
} from "@/lib/degustacoes";
import type { Json } from "@/integrations/supabase/types";
import { OfertaSearch, type SelectedOfertaItem } from "@/components/degustacoes/oferta-search";
import { ProductSearch } from "@/components/product-search";
import type { Produto } from "@/lib/produtos";
import { useCampanhasStore, statusCampanha, type Campanha } from "@/lib/campanhas-store";
import { brl, fmtDate } from "@/components/campanha-quick-view";

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

  // Campanhas ativas / programadas disponíveis para vinculação
  const { campanhas } = useCampanhasStore();
  const campanhasValidas = React.useMemo(() => {
    return campanhas.filter((c) => {
      const st = statusCampanha(c);
      return st === "Ativa" || st === "Programada";
    });
  }, [campanhas]);

  const [selectedCampanhaId, setSelectedCampanhaId] = useState<string | null>(null);
  const [selectedCampanhaNome, setSelectedCampanhaNome] = useState<string | null>(null);

  // Produtos e ofertas selecionados para a degustação
  interface ProdutoAgendamentoItem {
    tempId: string;
    id?: string;
    oferta_id?: string | null;
    produto_id?: string | null;
    codigo?: string | null;
    gtin?: string | null;
    descricao: string;
    preco_base: number;
    preco_praticado: number;
    campanha_nome?: string | null;
    isExisting?: boolean;
  }

  const [produtosIniciais, setProdutosIniciais] = useState<ProdutoAgendamentoItem[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addMode, setAddMode] = useState<"oferta" | "produto">("oferta");
  const [loadingInitialProdutos, setLoadingInitialProdutos] = useState(false);

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
        setSelectedCampanhaId(degustacaoToEdit.campanha_id || null);
        setSelectedCampanhaNome(degustacaoToEdit.campanha_nome || null);
        setShowAddProduct(false);

        // Carregar produtos vinculados se for edição
        setLoadingInitialProdutos(true);
        listDegustacaoProdutos(degustacaoToEdit.id)
          .then((items) => {
            setProdutosIniciais(
              items.map((p) => ({
                tempId: p.id,
                id: p.id,
                oferta_id: p.oferta_id,
                produto_id: p.produto_id,
                codigo: p.codigo,
                gtin: p.gtin,
                descricao: p.descricao,
                preco_base: Number(p.preco_base) || 0,
                preco_praticado: Number(p.preco_praticado) || 0,
                campanha_nome: p.oferta_id ? (degustacaoToEdit.campanha_nome || "Campanha") : null,
                isExisting: true,
              }))
            );
          })
          .catch((err) => {
            console.error("Erro ao carregar produtos vinculados:", err);
          })
          .finally(() => {
            setLoadingInitialProdutos(false);
          });

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
        setSelectedCampanhaId(null);
        setSelectedCampanhaNome(null);
        setProdutosIniciais([]);
        setShowAddProduct(false);
        setAddMode("oferta");
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

  const handleCampanhaSelectChange = (val: string) => {
    if (val === "NENHUMA") {
      setSelectedCampanhaId(null);
      setSelectedCampanhaNome(null);
    } else {
      const found = campanhasValidas.find((c) => c.id === val);
      if (found) {
        setSelectedCampanhaId(found.id);
        setSelectedCampanhaNome(found.nome);
      }
    }
  };

  const handleAddOfertaAgendamento = (item: SelectedOfertaItem) => {
    const { oferta, campanha } = item;
    const exists = produtosIniciais.some(
      (p) =>
        (p.oferta_id && p.oferta_id === oferta.id) ||
        (oferta.codigo && p.codigo === oferta.codigo) ||
        (oferta.gtin && p.gtin === oferta.gtin)
    );
    if (exists) {
      toast.info("Esta oferta já foi adicionada à lista de produtos.");
      return;
    }

    setProdutosIniciais((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        oferta_id: oferta.id,
        codigo: oferta.codigo || null,
        gtin: oferta.gtin || null,
        descricao: oferta.descricao,
        preco_base: oferta.precoNormal || 0,
        preco_praticado: oferta.precoPromocional || 0,
        campanha_nome: campanha.nome,
        isExisting: false,
      },
    ]);

    // Se ainda não vinculou campanha na degustação, vincula automaticamente
    if (!selectedCampanhaId) {
      setSelectedCampanhaId(campanha.id);
      setSelectedCampanhaNome(campanha.nome);
    }

    toast.success(`Oferta "${oferta.descricao}" adicionada!`);
    setShowAddProduct(false);
  };

  const handleAddProdutoAgendamento = (produto: Produto) => {
    const exists = produtosIniciais.some(
      (p) =>
        (p.produto_id && p.produto_id === produto.id) ||
        (produto.codigo && p.codigo === produto.codigo) ||
        (produto.gtin && p.gtin === produto.gtin)
    );
    if (exists) {
      toast.info("Este produto já foi adicionado à lista.");
      return;
    }

    setProdutosIniciais((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        produto_id: produto.id,
        codigo: produto.codigo || null,
        gtin: produto.gtin || null,
        descricao: produto.descricao,
        preco_base: produto.preco_venda || 0,
        preco_praticado: produto.preco_venda || 0,
        campanha_nome: null,
        isExisting: false,
      },
    ]);

    toast.success(`Produto "${produto.descricao}" adicionado!`);
    setShowAddProduct(false);
  };

  const handleRemoveProdutoAgendamento = async (item: ProdutoAgendamentoItem) => {
    if (item.isExisting && item.id) {
      try {
        const { error } = await supabase.from("degustacao_produtos").delete().eq("id", item.id);
        if (error) throw error;
        toast.success("Produto removido.");
      } catch (err) {
        toast.error("Erro ao remover produto: " + (err as Error).message);
        return;
      }
    }
    setProdutosIniciais((prev) => prev.filter((p) => p.tempId !== item.tempId));
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
        campanha_id: selectedCampanhaId || null,
        campanha_nome: selectedCampanhaNome || null,
      };

      if (degustacaoToEdit) {
        const { data, error } = await supabase
          .from("degustacoes")
          .update(payload)
          .eq("id", degustacaoToEdit.id)
          .select()
          .single();

        if (error) throw error;

        // Salvar novos produtos adicionados durante a edição
        const novosItens = produtosIniciais.filter((p) => !p.isExisting);
        if (novosItens.length > 0) {
          const insertRows = novosItens.map((p) => ({
            degustacao_id: degustacaoToEdit.id,
            oferta_id: p.oferta_id || null,
            produto_id: p.produto_id || null,
            codigo: p.codigo || null,
            gtin: p.gtin || null,
            descricao: p.descricao,
            preco_base: p.preco_base,
            preco_praticado: p.preco_praticado,
            quantidade_vendida: 0,
            faturamento_total: 0,
          }));
          const { error: errInsert } = await supabase.from("degustacao_produtos").insert(insertRows);
          if (errInsert) {
            console.error("Erro ao salvar novos produtos:", errInsert);
            toast.error("Degustação salva, mas houve falha ao registrar novos produtos.");
          }
        }

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

        // Inserir itens vinculados na criação
        if (produtosIniciais.length > 0) {
          const insertRows = produtosIniciais.map((p) => ({
            degustacao_id: targetId,
            oferta_id: p.oferta_id || null,
            produto_id: p.produto_id || null,
            codigo: p.codigo || null,
            gtin: p.gtin || null,
            descricao: p.descricao,
            preco_base: p.preco_base,
            preco_praticado: p.preco_praticado,
            quantidade_vendida: 0,
            faturamento_total: 0,
          }));
          const { error: errInsert } = await supabase.from("degustacao_produtos").insert(insertRows);
          if (errInsert) {
            console.error("Erro ao vincular produtos na criação:", errInsert);
            toast.error("Degustação agendada, mas houve falha ao vincular produtos.");
          }
        }

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

            {/* Campanha Promocional Vinculada (Opcional) */}
            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label htmlFor="campanha-select" className="text-xs font-semibold text-navy flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Campanha Promocional Vinculada <span className="text-[11px] font-normal text-muted-foreground">(Opcional)</span>
                </Label>
                {selectedCampanhaId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-muted-foreground hover:text-destructive px-1.5"
                    onClick={() => {
                      setSelectedCampanhaId(null);
                      setSelectedCampanhaNome(null);
                    }}
                  >
                    Desvincular
                  </Button>
                )}
              </div>
              <Select
                value={selectedCampanhaId || "NENHUMA"}
                onValueChange={handleCampanhaSelectChange}
              >
                <SelectTrigger id="campanha-select" className="w-full">
                  <SelectValue placeholder="Selecione uma campanha ativa ou programada..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NENHUMA">
                    <span className="text-muted-foreground">Nenhuma campanha vinculada (Apenas em loja)</span>
                  </SelectItem>
                  {campanhasValidas.map((camp) => {
                    const st = statusCampanha(camp);
                    return (
                      <SelectItem key={camp.id} value={camp.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{camp.nome}</span>
                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.2 rounded uppercase",
                              st === "Ativa"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
                            )}
                          >
                            {st}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({fmtDate(camp.dataInicial)} a {fmtDate(camp.dataFinal)})
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Exibe apenas campanhas com status Ativa ou Programada do módulo de Campanhas.
              </p>
            </div>

            {/* Produtos & Ofertas da Degustação */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-navy flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    Produtos & Ofertas da Degustação
                    {produtosIniciais.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold">
                        {produtosIniciais.length}
                      </Badge>
                    )}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Vincule ofertas específicas em promoção ou adicione produtos regulares do catálogo.
                  </p>
                </div>

                {!showAddProduct && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddProduct(true)}
                    className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar Produto
                  </Button>
                )}
              </div>

              {/* Painel de Inclusão de Produto / Oferta */}
              {showAddProduct && (
                <div className="p-3 rounded-lg border bg-muted/20 space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between border-b pb-2">
                    {/* Toggle entre Oferta em Campanha e Produto Regular */}
                    <div className="flex items-center gap-1.5 p-0.5 bg-muted rounded-md text-xs">
                      <button
                        type="button"
                        onClick={() => setAddMode("oferta")}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition",
                          addMode === "oferta"
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Tag className="h-3.5 w-3.5" />
                        Oferta em Campanha
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddMode("produto")}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition",
                          addMode === "produto"
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Package className="h-3.5 w-3.5" />
                        Produto Regular
                      </button>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddProduct(false)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {addMode === "oferta" ? (
                    <div>
                      <div className="mb-2 text-[11px] text-muted-foreground flex items-center gap-1">
                        <Tag className="h-3 w-3 text-emerald-600" />
                        Selecione a oferta específica da campanha desejada (Ex: Alfajores Odara):
                      </div>
                      <OfertaSearch
                        defaultCampanhaId={selectedCampanhaId || undefined}
                        onSelect={handleAddOfertaAgendamento}
                        placeholder="Buscar oferta específica por produto, código, GTIN ou campanha..."
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 text-[11px] text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3 text-blue-600" />
                        Buscar produto regular cadastrado no catálogo geral:
                      </div>
                      <ProductSearch
                        onSelect={handleAddProdutoAgendamento}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Lista dos produtos adicionados */}
              {loadingInitialProdutos ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Carregando produtos vinculados...
                </div>
              ) : produtosIniciais.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground bg-muted/5">
                  Nenhum produto vinculado ainda. Você pode adicionar produtos agora ou durante a execução do evento.
                </div>
              ) : (
                <ul className="grid gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {produtosIniciais.map((item) => (
                    <li
                      key={item.tempId}
                      className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-xs shadow-2xs hover:border-primary/40 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-navy truncate">
                            {item.descricao}
                          </span>
                          {item.codigo && (
                            <span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
                              Cód: {item.codigo}
                            </span>
                          )}
                          {item.oferta_id ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 gap-1"
                            >
                              <Tag className="h-2.5 w-2.5" />
                              Oferta {item.campanha_nome ? `• ${item.campanha_nome}` : "Campanha"}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1.5 bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 gap-1"
                            >
                              <Package className="h-2.5 w-2.5" />
                              Regular
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          {item.oferta_id ? (
                            <>
                              <span>De: <span className="line-through">{brl(item.preco_base)}</span></span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                Por: {brl(item.preco_praticado)}
                              </span>
                            </>
                          ) : (
                            <span>Preço Base: <strong className="text-foreground">{brl(item.preco_praticado)}</strong></span>
                          )}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProdutoAgendamento(item)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        title="Remover produto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
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
