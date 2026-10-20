import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Store,
  Truck,
  TrendingUp,
  LayoutGrid,
  List,
  ChevronRight,
  RotateCcw,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DegustacaoStatusBadge } from "@/components/degustacoes/degustacao-status-badge";
import { AgendamentoDialog } from "@/components/degustacoes/agendamento-dialog";
import { DegustacaoDetalhesSheet } from "@/components/degustacoes/degustacao-detalhes-sheet";
import {
  listDegustacoes,
  LOJAS_DEGUSTACOES,
  getStatusEfetivoDegustacao,
  type Degustacao,
  type DegustacaoWithProdutosCount,
  type DegustacaoStatus,
} from "@/lib/degustacoes";
import { useAuth } from "@/lib/auth";
import { brl } from "@/components/campanha-quick-view";

export const Route = createFileRoute("/_app/degustacoes")({
  head: () => ({
    meta: [
      { title: "Degustações — Central de Campanhas Sumel" },
      {
        name: "description",
        content: "Planejamento, execução e apuração de resultados de degustações nas lojas Sumel.",
      },
    ],
  }),
  component: DegustacoesPage,
});

function DegustacoesPage() {
  const { user } = useAuth();
  const isMaster = !!user?.isAdmin && !user?.readOnly;

  const [degustacoes, setDegustacoes] = useState<DegustacaoWithProdutosCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedLoja, setSelectedLoja] = useState<string>("TODAS");
  const [selectedStatus, setSelectedStatus] = useState<string>("TODOS");
  const [periodo, setPeriodo] = useState<"TODOS" | "HOJE" | "SEMANA" | "MES">("TODOS");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Modais
  const [agendamentoModalOpen, setAgendamentoModalOpen] = useState(false);
  const [editingDegustacao, setEditingDegustacao] = useState<Degustacao | null>(null);

  const [selectedDegustacao, setSelectedDegustacao] = useState<Degustacao | null>(null);
  const [detalhesSheetOpen, setDetalhesSheetOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listDegustacoes({
        loja: selectedLoja !== "TODAS" ? selectedLoja : undefined,
        status: (selectedStatus !== "TODOS" ? selectedStatus : undefined) as DegustacaoStatus | undefined,
        search: search.trim() || undefined,
      });
      setDegustacoes(data);
    } catch (err) {
      toast.error("Erro ao carregar degustações", {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedLoja, selectedStatus]);

  // Aplicar busca com debounce simples e filtro de período em memória
  const filteredDegustacoes = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const today = new Date();

    return degustacoes.filter((item) => {
      // Filtro de texto
      if (search.trim()) {
        const term = search.toLowerCase();
        const matches =
          item.nome.toLowerCase().includes(term) ||
          item.fornecedor_nome.toLowerCase().includes(term) ||
          item.responsavel_nome.toLowerCase().includes(term) ||
          item.loja.toLowerCase().includes(term);
        if (!matches) return false;
      }

      // Filtro de período
      if (periodo === "HOJE") {
        return item.data === todayStr;
      }
      if (periodo === "SEMANA") {
        const itemDate = new Date(item.data + "T00:00:00");
        const diffDays = (itemDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
        return diffDays >= -7 && diffDays <= 7;
      }
      if (periodo === "MES") {
        const itemMonth = item.data.slice(0, 7);
        const currentMonth = todayStr.slice(0, 7);
        return itemMonth === currentMonth;
      }

      return true;
    });
  }, [degustacoes, search, periodo]);

  // Estatísticas para os Cards de KPI
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    let hojeAtivas = 0;
    let programadas = 0;
    let aguardando = 0;
    let concluidas = 0;
    let faturamentoTotal = 0;

    degustacoes.forEach((d) => {
      const statusEfetivo = getStatusEfetivoDegustacao(d);
      if (
        statusEfetivo === "Ativa" ||
        (d.data === todayStr && statusEfetivo !== "Cancelada" && statusEfetivo !== "Concluída")
      ) {
        hojeAtivas++;
      }
      if (statusEfetivo === "Programada") {
        programadas++;
      }
      if (statusEfetivo === "Aguardando Resultados") {
        aguardando++;
      }
      if (statusEfetivo === "Concluída") {
        concluidas++;
        faturamentoTotal += Number(d.faturamento_total_calculado) || 0;
      }
    });

    return { hojeAtivas, programadas, aguardando, concluidas, faturamentoTotal };
  }, [degustacoes]);

  // Abrir detalhes de uma degustação
  const handleOpenDetalhes = (degustacao: Degustacao) => {
    setSelectedDegustacao(degustacao);
    setDetalhesSheetOpen(true);
  };

  // Abrir modal para novo agendamento
  const handleNovoAgendamento = () => {
    setEditingDegustacao(null);
    setAgendamentoModalOpen(true);
  };

  // Abrir modal para editar agendamento
  const handleEditAgendamento = (degustacao: Degustacao) => {
    setEditingDegustacao(degustacao);
    setAgendamentoModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 space-y-6 p-4 sm:p-6">
      {/* Cabeçalho da Página */}
      <PageHeader
        title="Degustações"
        description="Gestão integrada de planejamento, execução e apuração financeira de degustações em todas as lojas."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              title="Atualizar listagem"
              className="border-slate-200 text-slate-700"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {isMaster ? (
              <Button
                onClick={handleNovoAgendamento}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Novo Agendamento
              </Button>
            ) : (
              <div className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded border border-slate-200">
                Acesso Global (Somente Leitura)
              </div>
            )}
          </div>
        }
      />

      {/* Grid de Cards de Métricas / KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card: Hoje & Ativas */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center justify-between">
              <span>Hoje & Ativas</span>
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3">
            <div className="text-2xl sm:text-3xl font-semibold text-slate-900">{stats.hojeAtivas}</div>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
              Em andamento ou hoje
            </p>
          </CardContent>
        </Card>

        {/* Card: Programadas */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center justify-between">
              <span>Programadas</span>
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3">
            <div className="text-2xl sm:text-3xl font-semibold text-slate-900">{stats.programadas}</div>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
              Agendadas futuras
            </p>
          </CardContent>
        </Card>

        {/* Card: Aguardando */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center justify-between">
              <span>Aguardando</span>
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3">
            <div className="text-2xl sm:text-3xl font-semibold text-slate-900">{stats.aguardando}</div>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
              Pendentes de apuração
            </p>
          </CardContent>
        </Card>

        {/* Card: Concluídas */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
            <CardTitle className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center justify-between">
              <span>Concluídas</span>
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-semibold text-slate-900">{stats.concluidas}</span>
              <span className="text-[10px] sm:text-xs text-slate-400">concl.</span>
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-600 mt-0.5">
              {brl(stats.faturamentoTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        {/* Linha 1: Busca + Seletores */}
        <div className="p-3 sm:p-4 space-y-3">
          {/* Busca textual */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por degustação, fornecedor, promotor ou loja..."
              className="pl-10 bg-slate-50 border-slate-200 h-10 w-full text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Seletores + Toggle de Visualização */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="grid grid-cols-2 gap-2 flex-1">
              {/* Seletor de Loja */}
              <Select value={selectedLoja} onValueChange={setSelectedLoja}>
                <SelectTrigger className="w-full bg-slate-50 border-slate-200 h-10 text-sm">
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas as Lojas</SelectItem>
                  {LOJAS_DEGUSTACOES.map((loja) => (
                    <SelectItem key={loja} value={loja}>
                      {loja}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Seletor de Status */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full bg-slate-50 border-slate-200 h-10 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos os Status</SelectItem>
                  <SelectItem value="Programada">Programada</SelectItem>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Aguardando Resultados">Aguardando Resultados</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toggle de Visualização (Tabela / Cards) */}
            <div className="flex border border-slate-200 rounded-md p-0.5 bg-slate-50 shrink-0 h-10 items-center">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className={`h-8 px-3 text-xs font-medium ${viewMode === "table" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-600"}`}
                onClick={() => setViewMode("table")}
                title="Visualização em tabela"
              >
                <List className="h-4 w-4 mr-1.5" /> Tabela
              </Button>
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                className={`h-8 px-3 text-xs font-medium ${viewMode === "cards" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-600"}`}
                onClick={() => setViewMode("cards")}
                title="Visualização em cards"
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" /> Cards
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros Rápidos de Período */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-4 pb-3 sm:pb-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 sm:mx-0 sm:px-0">
            <span className="text-slate-400 font-medium flex items-center gap-1 shrink-0 text-[11px] sm:text-xs">
              <Filter className="h-3 w-3" /> Período:
            </span>
            <Button
              size="sm"
              variant={periodo === "TODOS" ? "default" : "ghost"}
              className={`h-7 text-xs shrink-0 px-2.5 font-medium ${periodo === "TODOS" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-600 hover:text-slate-900"}`}
              onClick={() => setPeriodo("TODOS")}
            >
              Todas as Datas
            </Button>
            <Button
              size="sm"
              variant={periodo === "HOJE" ? "default" : "ghost"}
              className={`h-7 text-xs shrink-0 px-2.5 font-medium ${periodo === "HOJE" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-600 hover:text-slate-900"}`}
              onClick={() => setPeriodo("HOJE")}
            >
              Hoje
            </Button>
            <Button
              size="sm"
              variant={periodo === "SEMANA" ? "default" : "ghost"}
              className={`h-7 text-xs shrink-0 px-2.5 font-medium ${periodo === "SEMANA" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-600 hover:text-slate-900"}`}
              onClick={() => setPeriodo("SEMANA")}
            >
              Esta Semana
            </Button>
            <Button
              size="sm"
              variant={periodo === "MES" ? "default" : "ghost"}
              className={`h-7 text-xs shrink-0 px-2.5 font-medium ${periodo === "MES" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-600 hover:text-slate-900"}`}
              onClick={() => setPeriodo("MES")}
            >
              Este Mês
            </Button>
          </div>

          <span className="text-[11px] sm:text-xs text-slate-400 shrink-0 text-right">
            Exibindo <strong className="text-slate-600">{filteredDegustacoes.length}</strong> de{" "}
            <strong className="text-slate-600">{degustacoes.length}</strong> degustações
          </span>
        </div>
      </div>

      {/* Conteúdo Principal: Tabela ou Cards */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <RotateCcw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
          <p className="text-slate-500 text-sm">Carregando módulo de degustações...</p>
        </div>
      ) : filteredDegustacoes.length === 0 ? (
        <EmptyState
          message="Nenhuma degustação encontrada com os filtros selecionados."
          className="bg-white border border-slate-200"
        />
      ) : viewMode === "table" ? (
        /* VISUALIZAÇÃO EM TABELA */
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-200">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-36 text-slate-600 font-medium text-xs">Data / Horário</TableHead>
                <TableHead className="w-32 text-slate-600 font-medium text-xs">Loja</TableHead>
                <TableHead className="text-slate-600 font-medium text-xs">Degustação & Fornecedor</TableHead>
                <TableHead className="w-40 text-slate-600 font-medium text-xs">Responsável</TableHead>
                <TableHead className="w-28 text-center text-slate-600 font-medium text-xs">Itens</TableHead>
                <TableHead className="w-32 text-right text-slate-600 font-medium text-xs">Faturamento</TableHead>
                <TableHead className="w-36 text-center text-slate-600 font-medium text-xs">Status</TableHead>
                <TableHead className="w-24 text-right text-slate-600 font-medium text-xs">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDegustacoes.map((item) => (
                <TableRow
                  key={item.id}
                  className="hover:bg-slate-50/50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                  onClick={() => handleOpenDetalhes(item)}
                >
                  <TableCell className="py-3">
                    <div className="font-semibold text-slate-900 text-sm">
                      {new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                    {(item.horario_inicio || item.horario_fim) && (
                      <div className="text-xs text-slate-500">
                        {item.horario_inicio?.slice(0, 5) ?? "--:--"} às{" "}
                        {item.horario_fim?.slice(0, 5) ?? "--:--"}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="py-3">
                    <span className="inline-flex items-center gap-1.5 font-medium text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded">
                      <Store className="h-3 w-3 text-slate-500" /> {item.loja}
                    </span>
                  </TableCell>

                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 text-sm">
                        {item.nome}
                      </span>
                      {Array.isArray(item.anexos) && item.anexos.length > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium border border-emerald-100 shrink-0"
                          title={`${item.anexos.length} material(is) de impressão/decoração anexado(s)`}
                        >
                          <Paperclip className="h-2.5 w-2.5" /> {item.anexos.length}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Truck className="h-3 w-3" /> {item.fornecedor_nome}
                    </div>
                  </TableCell>

                  <TableCell className="py-3">
                    <span className="text-xs text-slate-600">{item.responsavel_nome}</span>
                  </TableCell>

                  <TableCell className="py-3 text-center">
                    <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      {item.produtos_count ?? 0} item(s)
                    </span>
                  </TableCell>

                  <TableCell className="py-3 text-right">
                    <span className="font-semibold text-slate-900 text-sm">
                      {brl(item.faturamento_total_calculado)}
                    </span>
                  </TableCell>

                  <TableCell className="py-3 text-center">
                    <DegustacaoStatusBadge status={item.status} />
                  </TableCell>

                  <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      onClick={() => handleOpenDetalhes(item)}
                    >
                      Gerenciar <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* VISUALIZAÇÃO EM CARDS - MOBILE FRIENDLY */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredDegustacoes.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
              onClick={() => handleOpenDetalhes(item)}
            >
              {/* Header do Card */}
              <div className="p-3 sm:p-4 border-b border-slate-100">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <DegustacaoStatusBadge status={item.status} />
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded flex items-center gap-1.5">
                    <Store className="h-3 w-3 text-slate-500" /> {item.loja}
                  </span>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 text-sm leading-snug">{item.nome}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <Truck className="h-3 w-3" /> {item.fornecedor_nome}
                  </p>
                </div>
              </div>

              {/* Grid de Informações - Mobile Optimized */}
              <div className="p-3 sm:p-4 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  {/* Data */}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-500">Data:</span>
                    <span className="font-medium text-slate-700 ml-auto">
                      {new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>

                  {/* Horário */}
                  {(item.horario_inicio || item.horario_fim) && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-500">Horário:</span>
                      <span className="font-medium text-slate-700 ml-auto">
                        {item.horario_inicio?.slice(0, 5) ?? "--:--"}
                      </span>
                    </div>
                  )}

                  {/* Responsável */}
                  <div className="flex items-center gap-1.5 col-span-2">
                    <span className="text-slate-400 shrink-0 w-3.5 h-3.5 flex items-center justify-center text-xs font-medium">R</span>
                    <span className="text-slate-500">Responsável:</span>
                    <span className="font-medium text-slate-700 ml-auto truncate max-w-[120px]">
                      {item.responsavel_nome}
                    </span>
                  </div>

                  {/* Itens */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 shrink-0 w-3.5 h-3.5 flex items-center justify-center text-xs font-medium">I</span>
                    <span className="text-slate-500">Itens:</span>
                    <span className="font-medium text-slate-700 ml-auto">
                      {item.produtos_count ?? 0}
                    </span>
                  </div>

                  {/* Anexos (se houver) */}
                  {Array.isArray(item.anexos) && item.anexos.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-emerald-600">Anexos:</span>
                      <span className="font-medium text-emerald-700 ml-auto">
                        {item.anexos.length}
                      </span>
                    </div>
                  )}

                  {/* Faturamento - DESTAQUE */}
                  <div className="col-span-2 flex items-center justify-between pt-2 mt-1 border-t border-slate-200">
                    <span className="text-slate-500 font-medium">Faturamento:</span>
                    <span className="font-semibold text-slate-900 text-sm">
                      {brl(item.faturamento_total_calculado)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer do Card */}
              <div className="p-3 sm:p-4 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 h-10 sm:h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDetalhes(item);
                  }}
                >
                  Gerenciar Degustação
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Agendamento (Criação e Edição) */}
      <AgendamentoDialog
        open={agendamentoModalOpen}
        onOpenChange={setAgendamentoModalOpen}
        degustacaoToEdit={editingDegustacao}
        onSuccess={() => loadData()}
        userDefaultName={user?.name || user?.username}
      />

      {/* Drawer de Detalhes, Produtos e Auditoria */}
      <DegustacaoDetalhesSheet
        open={detalhesSheetOpen}
        onOpenChange={setDetalhesSheetOpen}
        degustacao={selectedDegustacao}
        isMaster={isMaster}
        currentUser={user ?? undefined}
        onRefreshList={loadData}
        onEditAgendamento={(deg) => {
          setDetalhesSheetOpen(false);
          handleEditAgendamento(deg);
        }}
      />
    </div>
  );
}
