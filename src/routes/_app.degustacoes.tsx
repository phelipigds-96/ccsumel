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
  Sparkles,
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
      if (d.status === "Ativa" || (d.data === todayStr && d.status !== "Cancelada")) {
        hojeAtivas++;
      }
      if (d.status === "Programada") {
        programadas++;
      }
      if (d.status === "Aguardando Resultados") {
        aguardando++;
      }
      if (d.status === "Concluída") {
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
    <div className="space-y-6">
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
              className="border-border text-navy"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {isMaster ? (
              <Button
                onClick={handleNovoAgendamento}
                className="bg-primary hover:bg-primary/90 text-white shadow-xs font-semibold"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Novo Agendamento
              </Button>
            ) : (
              <div className="text-xs text-muted-foreground bg-secondary/60 px-3 py-1.5 rounded-md border">
                Acesso Global (Somente Leitura)
              </div>
            )}
          </div>
        }
      />

      {/* Grid de Cards de Métricas / KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="bg-emerald-50/40 border-emerald-200/70 shadow-2xs">
          <CardHeader className="p-3 sm:p-4 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-800 flex items-center justify-between">
              <span>Hoje & Ativas</span>
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-emerald-700">{stats.hojeAtivas}</div>
            <p className="text-[10px] sm:text-[11px] text-emerald-600/80 mt-0.5 line-clamp-1 sm:line-clamp-none">
              Em andamento ou hoje
            </p>
          </CardContent>
        </Card>

        <Card className="bg-sky-50/40 border-sky-200/70 shadow-2xs">
          <CardHeader className="p-3 sm:p-4 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-sky-800 flex items-center justify-between">
              <span>Programadas</span>
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-500 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-sky-700">{stats.programadas}</div>
            <p className="text-[10px] sm:text-[11px] text-sky-600/80 mt-0.5 line-clamp-1 sm:line-clamp-none">
              Agendadas futuras
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50/40 border-amber-200/70 shadow-2xs">
          <CardHeader className="p-3 sm:p-4 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center justify-between">
              <span>Aguardando</span>
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1">
            <div className="text-xl sm:text-2xl font-bold text-amber-700">{stats.aguardando}</div>
            <p className="text-[10px] sm:text-[11px] text-amber-600/80 mt-0.5 line-clamp-1 sm:line-clamp-none">
              Pendentes de apuração
            </p>
          </CardContent>
        </Card>

        <Card className="bg-navy/5 border-border shadow-2xs">
          <CardHeader className="p-3 sm:p-4 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-navy flex items-center justify-between">
              <span>Concluídas</span>
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-navy">{stats.concluidas}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">concl.</span>
            </div>
            <p className="text-[10px] sm:text-xs font-semibold text-primary mt-0.5 truncate">
              {brl(stats.faturamentoTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="rounded-xl border bg-card p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
          {/* Busca textual */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por degustação, fornecedor, promotor ou loja..."
              className="pl-9 bg-background h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="grid grid-cols-2 gap-2 flex-1 sm:flex sm:w-auto">
              {/* Seletor de Loja */}
              <Select value={selectedLoja} onValueChange={setSelectedLoja}>
                <SelectTrigger className="w-full sm:w-[170px] bg-background h-9 text-xs sm:text-sm">
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
                <SelectTrigger className="w-full sm:w-[180px] bg-background h-9 text-xs sm:text-sm">
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
            <div className="flex border rounded-md p-0.5 bg-muted/40 shrink-0 h-9 items-center">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("table")}
                title="Visualização em tabela"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("cards")}
                title="Visualização em cards"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros Rápidos de Período */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 sm:mx-0 sm:px-0">
            <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0 text-[11px] sm:text-xs">
              <Filter className="h-3 w-3" /> Período:
            </span>
            <Button
              size="sm"
              variant={periodo === "TODOS" ? "secondary" : "ghost"}
              className="h-7 text-xs shrink-0 px-2.5"
              onClick={() => setPeriodo("TODOS")}
            >
              Todas as Datas
            </Button>
            <Button
              size="sm"
              variant={periodo === "HOJE" ? "secondary" : "ghost"}
              className="h-7 text-xs shrink-0 px-2.5"
              onClick={() => setPeriodo("HOJE")}
            >
              Hoje
            </Button>
            <Button
              size="sm"
              variant={periodo === "SEMANA" ? "secondary" : "ghost"}
              className="h-7 text-xs shrink-0 px-2.5"
              onClick={() => setPeriodo("SEMANA")}
            >
              Esta Semana
            </Button>
            <Button
              size="sm"
              variant={periodo === "MES" ? "secondary" : "ghost"}
              className="h-7 text-xs shrink-0 px-2.5"
              onClick={() => setPeriodo("MES")}
            >
              Este Mês
            </Button>
          </div>

          <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0 text-right">
            Exibindo <strong>{filteredDegustacoes.length}</strong> de{" "}
            <strong>{degustacoes.length}</strong> degustações
          </span>
        </div>
      </div>

      {/* Conteúdo Principal: Tabela ou Cards */}
      {loading ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <RotateCcw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
          Carregando módulo de degustações...
        </div>
      ) : filteredDegustacoes.length === 0 ? (
        <EmptyState
          message="Nenhuma degustação encontrada com os filtros selecionados."
          className="bg-card"
        />
      ) : viewMode === "table" ? (
        /* VISUALIZAÇÃO EM TABELA */
        <div className="rounded-xl border bg-card overflow-x-auto shadow-2xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-36">Data / Horário</TableHead>
                <TableHead className="w-32">Loja</TableHead>
                <TableHead>Degustação & Fornecedor</TableHead>
                <TableHead className="w-40">Responsável</TableHead>
                <TableHead className="w-28 text-center">Itens</TableHead>
                <TableHead className="w-32 text-right">Faturamento</TableHead>
                <TableHead className="w-36 text-center">Status</TableHead>
                <TableHead className="w-24 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDegustacoes.map((item) => (
                <TableRow
                  key={item.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => handleOpenDetalhes(item)}
                >
                  <TableCell className="font-mono text-xs">
                    <div className="font-semibold text-navy">
                      {new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                    {(item.horario_inicio || item.horario_fim) && (
                      <div className="text-[11px] text-muted-foreground">
                        {item.horario_inicio?.slice(0, 5) ?? "--:--"} às{" "}
                        {item.horario_fim?.slice(0, 5) ?? "--:--"}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1 font-medium text-xs text-navy bg-navy/5 px-2 py-0.5 rounded">
                      <Store className="h-3 w-3 text-primary" /> {item.loja}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy text-sm leading-snug">
                        {item.nome}
                      </span>
                      {Array.isArray(item.anexos) && item.anexos.length > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium border border-emerald-200 shrink-0"
                          title={`${item.anexos.length} material(is) de impressão/decoração anexado(s)`}
                        >
                          <Paperclip className="h-2.5 w-2.5" /> {item.anexos.length}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Truck className="h-3 w-3" /> {item.fornecedor_nome}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {item.responsavel_nome}
                  </TableCell>

                  <TableCell className="text-center">
                    <span className="text-xs font-mono font-medium bg-muted px-2 py-0.5 rounded">
                      {item.produtos_count ?? 0} item(s)
                    </span>
                  </TableCell>

                  <TableCell className="text-right font-mono font-bold text-navy text-xs">
                    {brl(item.faturamento_total_calculado)}
                  </TableCell>

                  <TableCell className="text-center">
                    <DegustacaoStatusBadge status={item.status} />
                  </TableCell>

                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs font-semibold text-primary hover:text-primary/80"
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
        /* VISUALIZAÇÃO EM CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredDegustacoes.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border bg-card p-4 sm:p-5 hover:border-primary/50 transition-all hover:shadow-md active:scale-[0.99] cursor-pointer flex flex-col justify-between space-y-3 sm:space-y-4"
              onClick={() => handleOpenDetalhes(item)}
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <DegustacaoStatusBadge status={item.status} />
                  <span className="text-xs font-semibold text-navy bg-navy/5 px-2 py-0.5 rounded flex items-center gap-1">
                    <Store className="h-3 w-3 text-primary" /> {item.loja}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-navy text-base leading-tight">{item.nome}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Truck className="h-3.5 w-3.5" /> {item.fornecedor_nome}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t text-xs space-y-1.5 text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Data:
                  </span>
                  <strong className="text-navy">
                    {new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR")}{" "}
                    {item.horario_inicio && `(${item.horario_inicio.slice(0, 5)})`}
                  </strong>
                </div>

                <div className="flex items-center justify-between">
                  <span>Promotor / Resp.:</span>
                  <span className="text-foreground">{item.responsavel_nome}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Itens Cadastrados:</span>
                  <span className="font-mono">{item.produtos_count ?? 0} item(s)</span>
                </div>

                {Array.isArray(item.anexos) && item.anexos.length > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <Paperclip className="h-3 w-3" /> Materiais & Decoração:
                    </span>
                    <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      {item.anexos.length} anexo(s)
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t font-semibold">
                  <span>Faturamento:</span>
                  <span className="text-primary font-bold text-sm">
                    {brl(item.faturamento_total_calculado)}
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs font-semibold text-navy h-9 sm:h-8 hover:bg-primary/5 active:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDetalhes(item);
                }}
              >
                Gerenciar Degustação
              </Button>
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
