import { useState, useRef, useMemo } from "react";
import { DollarSign, Tag, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProductSearch } from "@/components/product-search";
import { type Produto } from "@/lib/produtos";
import { useCampanhasStore } from "@/lib/campanhas-store";
import {
  type Oferta,
  type Campanha,
  type TipoPromocaoOferta,
  type Status,
  STATUS,
  categoriaCampanha,
} from "./types";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s: string) =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "-";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-1.5 w-full ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

interface OfertaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oferta: Oferta | null;
  setOferta: (o: Oferta) => void;
  onSave: () => void;
  filiaisPermitidas: string[];
}

export function OfertaDialog({
  open,
  onOpenChange,
  oferta,
  setOferta,
  onSave,
  filiaisPermitidas,
}: OfertaDialogProps) {
  const promoRef = useRef<HTMLInputElement>(null);
  const { campanhas: todasCampanhas, ofertas: todasOfertas } = useCampanhasStore();

  const handleProductSelect = (p: Produto) => {
    if (!oferta) return;
    const preco = Number(p.preco_venda) || 0;
    const custo = Number(p.custo) || 0;
    setOferta({
      ...oferta,
      codigo: p.codigo || "",
      gtin: p.gtin || "",
      descricao: p.descricao,
      precoNormal: preco,
      custo,
      precoPromocional: preco,
    });
    setTimeout(() => {
      promoRef.current?.focus();
      promoRef.current?.select();
    }, 60);
    toast.success("Produto carregado. Informe o preço promocional ou clique num desconto.");
  };

  const historico = useMemo(() => {
    if (!oferta) return [];
    const cod = (oferta.codigo || "").trim().toLowerCase();
    const gtin = (oferta.gtin || "").trim();
    if (!cod && !gtin) return [];
    const mapa = new Map(todasCampanhas.map((c) => [c.id, c]));
    return todasOfertas
      .filter(
        (o) =>
          o.id !== oferta.id &&
          ((cod && (o.codigo || "").trim().toLowerCase() === cod) ||
            (gtin && (o.gtin || "").trim() === gtin))
      )
      .map((o) => ({ o, c: mapa.get(o.campanhaId) }))
      .filter((x): x is { o: Oferta; c: Campanha } => !!x.c)
      .sort((a, b) => (b.c.dataInicial || "").localeCompare(a.c.dataInicial || ""));
  }, [oferta?.id, oferta?.codigo, oferta?.gtin, todasOfertas, todasCampanhas]);

  const conflitoPDV = useMemo(() => {
    if (!oferta) return null;
    const cod = (oferta.codigo || "").trim().toLowerCase();
    const gtin = (oferta.gtin || "").trim();
    if (!cod && !gtin) return null;

    const dataIni = oferta.dataInicial;
    const dataFim = oferta.dataFinal;
    const mapa = new Map(todasCampanhas.map((c) => [c.id, c]));

    for (const o of todasOfertas) {
      if (o.id === oferta.id || o.campanhaId === oferta.campanhaId) continue;
      const c = mapa.get(o.campanhaId);
      if (!c) continue;
      if (categoriaCampanha(c) === "encerrada") continue;

      const matchCod = cod && (o.codigo || "").trim().toLowerCase() === cod;
      const matchGtin = gtin && (o.gtin || "").trim() === gtin;

      if (matchCod || matchGtin) {
        const cIni = o.dataInicial || c.dataInicial;
        const cFim = o.dataFinal || c.dataFinal;

        const overlap =
          (!dataFim || !cIni || dataFim >= cIni) &&
          (!dataIni || !cFim || dataIni <= cFim);

        if (overlap) {
          return {
            campanhaNome: c.nome,
            dataInicial: cIni,
            dataFinal: cFim,
            precoPromocional: o.precoPromocional,
          };
        }
      }
    }
    return null;
  }, [
    oferta?.id,
    oferta?.campanhaId,
    oferta?.codigo,
    oferta?.gtin,
    oferta?.dataInicial,
    oferta?.dataFinal,
    todasCampanhas,
    todasOfertas,
  ]);

  if (!oferta) return null;

  const upd = <K extends keyof Oferta>(k: K, v: Oferta[K]) =>
    setOferta({ ...oferta, [k]: v });

  const descontoPct =
    oferta.precoNormal > 0
      ? ((oferta.precoNormal - oferta.precoPromocional) / oferta.precoNormal) * 100
      : 0;
  const economia = Math.max(oferta.precoNormal - oferta.precoPromocional, 0);
  const priceAt = (pct: number) => +(oferta.precoNormal * (1 - pct / 100)).toFixed(2);
  const setPromoByPct = (pct: number) =>
    upd("precoPromocional", Math.max(priceAt(pct), 0));

  const descontoTone =
    descontoPct <= 0
      ? "text-muted-foreground"
      : descontoPct < 5
      ? "text-amber-600"
      : descontoPct < 20
      ? "text-emerald-600"
      : "text-primary";

  const tipoPromocao: TipoPromocaoOferta = oferta.tipoPromocao || "simples";
  const qtdMinima = Math.max(Number(oferta.quantidadeMinima) || 1, 1);
  const precoTotalCombo = Number((qtdMinima * (oferta.precoPromocional || 0)).toFixed(2));

  const handleTipoChange = (novoTipo: TipoPromocaoOferta) => {
    let novaQtd = oferta.quantidadeMinima;
    if (novoTipo === "simples") {
      novaQtd = 1;
    } else if (novoTipo === "a_partir_de") {
      novaQtd = oferta.quantidadeMinima >= 2 ? oferta.quantidadeMinima : 6;
    } else if (novoTipo === "a_cada") {
      novaQtd = oferta.quantidadeMinima >= 2 ? oferta.quantidadeMinima : 3;
    }
    setOferta({
      ...oferta,
      tipoPromocao: novoTipo,
      quantidadeMinima: novaQtd,
    });
  };

  const handlePrecoTotalComboChange = (valTotal: number) => {
    const qtd = Math.max(Number(oferta.quantidadeMinima) || 1, 1);
    const unitario = +(valTotal / qtd).toFixed(2);
    upd("precoPromocional", unitario);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>{oferta.codigo ? "Editar Oferta" : "Nova Oferta"}</DialogTitle>
            <DialogDescription>
              Localize o produto pelo código ou descrição para preencher automaticamente.
            </DialogDescription>
          </DialogHeader>

          <ProductSearch onSelect={handleProductSelect} />

          {historico.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 mb-1">
              <div className="text-sm font-semibold text-amber-900">
                Este produto já participou de {historico.length} campanha
                {historico.length > 1 ? "s" : ""}
              </div>
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {historico.map(({ o, c }) => (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium text-navy">{c.nome}</span>
                    <span className="text-muted-foreground">
                      {fmtDate(c.dataInicial)} → {fmtDate(c.dataFinal)}
                    </span>
                    <span className="text-muted-foreground">
                      De <span className="line-through">{brl(o.precoNormal)}</span> por{" "}
                      <span className="font-semibold text-primary">{brl(o.precoPromocional)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {conflitoPDV && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-3.5 mb-2 text-xs text-amber-950 flex items-start gap-2.5 shadow-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900 block mb-0.5">
                  Alerta de Conflito Comercial no PDV:
                </span>
                <p className="text-amber-900/90 leading-relaxed">
                  Este produto também está cadastrado na campanha{" "}
                  <strong>&quot;{conflitoPDV.campanhaNome}&quot;</strong> (vigência:{" "}
                  {fmtDate(conflitoPDV.dataInicial)} a {fmtDate(conflitoPDV.dataFinal)}) por{" "}
                  <strong>{brl(conflitoPDV.precoPromocional)}</strong>.
                </p>
                <p className="mt-1 text-[11px] text-amber-800">
                  Verifique as datas ou filiais para evitar divergência de valor no caixa.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 py-2 grid-cols-1 md:grid-cols-2">
            <Field label="Código interno">
              <Input value={oferta.codigo} onChange={(e) => upd("codigo", e.target.value)} />
            </Field>
            <Field label="Código de barras (GTIN)">
              <Input value={oferta.gtin} onChange={(e) => upd("gtin", e.target.value)} />
            </Field>
            <Field label="Descrição" className="md:col-span-2">
              <Input value={oferta.descricao} onChange={(e) => upd("descricao", e.target.value)} />
            </Field>
            <Field label="Preço Atual (R$)">
              <Input
                type="number"
                step="0.01"
                value={oferta.precoNormal}
                onChange={(e) => upd("precoNormal", parseFloat(e.target.value) || 0)}
              />
            </Field>
            <Field label="Custo (R$)">
              <Input
                type="number"
                step="0.01"
                value={oferta.custo}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </Field>

            {/* Seletor de Formato da Promoção */}
            <div className="md:col-span-2 rounded-lg border border-border/80 bg-[#F6F8FA] p-4">
              <div className="mb-3">
                <Label className="text-xs font-semibold text-navy uppercase tracking-wider">
                  Formato da Promoção
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Escolha a mecânica promocional aplicada no caixa (PDV):
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleTipoChange("simples")}
                  className={`flex flex-col text-left p-3 rounded-md border transition-colors duration-100 ${
                    tipoPromocao === "simples"
                      ? "border-primary bg-primary/[0.06] shadow-[inset_3px_0_0_0_var(--color-primary)]"
                      : "border-border bg-card hover:border-navy/30 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-sm text-navy">
                    <span>🏷️</span>
                    <span>Preço Direto (tradicional)</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Desconto unitário De / Por. Válido a partir de 1 unidade.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTipoChange("a_partir_de")}
                  className={`flex flex-col text-left p-3 rounded-md border transition-colors duration-100 ${
                    tipoPromocao === "a_partir_de"
                      ? "border-primary bg-primary/[0.06] shadow-[inset_3px_0_0_0_var(--color-primary)]"
                      : "border-border bg-card hover:border-navy/30 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-sm text-navy">
                    <span>📦</span>
                    <span>A partir de X un (Atacado)</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Ex: A partir de 6 un sai por R$ 3,99 cada.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTipoChange("a_cada")}
                  className={`flex flex-col text-left p-3 rounded-md border transition-colors duration-100 ${
                    tipoPromocao === "a_cada"
                      ? "border-primary bg-primary/[0.06] shadow-[inset_3px_0_0_0_var(--color-primary)]"
                      : "border-border bg-card hover:border-navy/30 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-sm text-navy">
                    <span>🔁</span>
                    <span>A cada X un (Combo)</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Ex: A cada 3 un sai por R$ 3,99 cada (3 por R$ 11,97).
                  </div>
                </button>
              </div>
            </div>

            {/* Configurações específicas do formato */}
            <div className="md:col-span-2 rounded-lg border p-4 bg-card space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b">
                <div>
                  <div className="text-xs text-muted-foreground">Preço atual unitário</div>
                  <div className="text-xl font-semibold text-navy tabular-nums">{brl(oferta.precoNormal)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Desconto unitário</div>
                  <div className={`text-2xl font-bold tabular-nums ${descontoTone}`}>
                    {descontoPct.toFixed(1)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Economia por un</div>
                  <div className="text-lg font-semibold text-navy tabular-nums">{brl(economia)}</div>
                </div>
              </div>

              {/* SE FORMATO TRADICIONAL */}
              {tipoPromocao === "simples" && (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Sugestões automáticas — clique para aplicar
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[5, 10, 15].map((pct) => {
                        const preco = priceAt(pct);
                        const ativo = Math.abs(preco - oferta.precoPromocional) < 0.005;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setPromoByPct(pct)}
                            disabled={oferta.precoNormal <= 0}
                            className={`rounded-md border p-3 text-left transition-colors duration-100 hover:border-primary/60 disabled:opacity-50 disabled:cursor-not-allowed ${
                              ativo
                                ? "border-primary bg-primary/[0.06] shadow-[inset_3px_0_0_0_var(--color-primary)]"
                                : "bg-card"
                            }`}
                          >
                            <div className="text-xs font-semibold text-primary">−{pct}%</div>
                            <div className="text-lg font-bold text-navy leading-tight">
                              {brl(preco)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Economia {brl(oferta.precoNormal - preco)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Field label="Preço Promocional (R$) — unitário">
                    <Input
                      ref={promoRef}
                      type="number"
                      step="0.01"
                      value={oferta.precoPromocional}
                      onChange={(e) =>
                        upd("precoPromocional", parseFloat(e.target.value) || 0)
                      }
                    />
                  </Field>
                </>
              )}

              {/* SE FORMATO ATACADO (A PARTIR DE X UNIDADES) */}
              {tipoPromocao === "a_partir_de" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Quantidade mínima para ativar preço de atacado (X)">
                      <div className="space-y-1.5">
                        <Input
                          type="number"
                          min="2"
                          step="1"
                          value={oferta.quantidadeMinima}
                          onChange={(e) =>
                            upd(
                              "quantidadeMinima",
                              Math.max(parseInt(e.target.value, 10) || 2, 2)
                            )
                          }
                        />
                        <div className="flex gap-1.5 flex-wrap">
                          {[3, 6, 10, 12].map((qtd) => (
                            <Button
                              key={qtd}
                              type="button"
                              size="sm"
                              variant={
                                oferta.quantidadeMinima === qtd ? "secondary" : "outline"
                              }
                              className="h-7 text-xs px-2"
                              onClick={() => upd("quantidadeMinima", qtd)}
                            >
                              {qtd} un
                            </Button>
                          ))}
                        </div>
                      </div>
                    </Field>

                    <Field label="Preço Promocional por Unidade (R$)">
                      <Input
                        ref={promoRef}
                        type="number"
                        step="0.01"
                        value={oferta.precoPromocional}
                        onChange={(e) =>
                          upd("precoPromocional", parseFloat(e.target.value) || 0)
                        }
                      />
                    </Field>
                  </div>

                  <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-950">
                    <div className="font-semibold flex items-center gap-1.5 mb-1">
                      <span>📦</span> Como funciona no caixa (PDV):
                    </div>
                    <div>
                      A partir de <strong>{qtdMinima} unidades</strong>, cada uma sai por{" "}
                      <strong>{brl(oferta.precoPromocional)}</strong> (abaixo de {qtdMinima} un,
                      o cliente paga o preço normal de{" "}
                      <strong>{brl(oferta.precoNormal)}</strong>).
                    </div>
                  </div>
                </div>
              )}

              {/* SE FORMATO COMBO (A CADA X UNIDADES) */}
              {tipoPromocao === "a_cada" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Quantidade do combo (X un)">
                      <div className="space-y-1.5">
                        <Input
                          type="number"
                          min="2"
                          step="1"
                          value={oferta.quantidadeMinima}
                          onChange={(e) =>
                            upd(
                              "quantidadeMinima",
                              Math.max(parseInt(e.target.value, 10) || 2, 2)
                            )
                          }
                        />
                        <div className="flex gap-1.5 flex-wrap">
                          {[2, 3, 4, 6].map((qtd) => (
                            <Button
                              key={qtd}
                              type="button"
                              size="sm"
                              variant={
                                oferta.quantidadeMinima === qtd ? "secondary" : "outline"
                              }
                              className="h-7 text-xs px-2"
                              onClick={() => upd("quantidadeMinima", qtd)}
                            >
                              {qtd} un
                            </Button>
                          ))}
                        </div>
                      </div>
                    </Field>

                    <Field label="Preço por Unidade no Combo (R$)">
                      <Input
                        ref={promoRef}
                        type="number"
                        step="0.01"
                        value={oferta.precoPromocional}
                        onChange={(e) =>
                          upd("precoPromocional", parseFloat(e.target.value) || 0)
                        }
                      />
                    </Field>

                    <Field label={`Valor Total do Pacote (${qtdMinima} un) (R$)`}>
                      <Input
                        type="number"
                        step="0.01"
                        value={precoTotalCombo}
                        onChange={(e) =>
                          handlePrecoTotalComboChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </Field>
                  </div>

                  <div className="rounded-lg border border-purple-300 bg-purple-50/70 p-3 text-xs text-purple-950">
                    <div className="font-semibold flex items-center gap-1.5 mb-1">
                      <span>🔁</span> Como funciona no caixa (PDV):
                    </div>
                    <div>
                      A cada <strong>{qtdMinima} unidades</strong>, o cliente paga um total de{" "}
                      <strong>{brl(precoTotalCombo)}</strong> (ou seja,{" "}
                      <strong>{brl(oferta.precoPromocional)} cada</strong>).
                      {oferta.precoNormal > 0 && (
                        <span className="block mt-1 text-purple-800">
                          {qtdMinima} unidades no preço normal custariam{" "}
                          <strong>{brl(oferta.precoNormal * qtdMinima)}</strong>. Economia no
                          combo:{" "}
                          <strong>
                            {brl(
                              Math.max(
                                oferta.precoNormal * qtdMinima - precoTotalCombo,
                                0
                              )
                            )}
                          </strong>
                          .
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Field label="Códigos de barras cresce vendas">
                  <Textarea
                    value={oferta.gtinsCresceVendas}
                    onChange={(e) => upd("gtinsCresceVendas", e.target.value)}
                    placeholder="Informe um código de barras por linha (ou separados por vírgula) para variações do produto"
                    rows={3}
                  />
                </Field>
              </div>
            </div>

            <Field label="Data Inicial">
              <Input
                type="date"
                value={oferta.dataInicial}
                onChange={(e) => upd("dataInicial", e.target.value)}
                className="w-full"
              />
            </Field>
            <Field label="Data Final">
              <Input
                type="date"
                value={oferta.dataFinal}
                onChange={(e) => upd("dataFinal", e.target.value)}
                className="w-full"
              />
            </Field>

            <Field
              label="Filiais (herdadas da campanha — desmarque para excluir alguma)"
              className="md:col-span-2"
            >
              {filiaisPermitidas.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  Nenhuma filial foi selecionada na campanha. Edite a campanha e escolha as filiais
                  participantes.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-md border p-3">
                  {filiaisPermitidas.map((f) => {
                    const checked = oferta.filiais?.includes(f) ?? false;
                    return (
                      <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const atuais = oferta.filiais ?? [];
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
              )}
            </Field>

            <Field label="Status (definido pela campanha)">
              <Select
                value={oferta.status}
                disabled
                onValueChange={(v) => upd("status", v as Status)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-center gap-3 rounded-md border p-3 md:col-span-2">
              <Switch
                checked={oferta.clubeSumel}
                onCheckedChange={(v) => upd("clubeSumel", v)}
                id="clube"
              />
              <Label htmlFor="clube" className="cursor-pointer">
                Oferta Clube Sumel
              </Label>
            </div>

            {/* Sell Out — verba do fornecedor */}
            <div className="md:col-span-2 rounded-lg border p-4 bg-navy/5">
              <div className="flex items-center gap-3 mb-3">
                <Switch
                  checked={oferta.selloutTemVerba}
                  onCheckedChange={(v) => upd("selloutTemVerba", v)}
                  id="sellout"
                />
                <Label
                  htmlFor="sellout"
                  className="cursor-pointer flex items-center gap-1.5 font-semibold text-navy"
                >
                  <DollarSign className="h-4 w-4 text-primary" /> Possui verba de Sell Out do
                  fornecedor
                </Label>
              </div>
              {oferta.selloutTemVerba && (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Fornecedor da verba">
                    <Input
                      value={oferta.selloutFornecedor}
                      onChange={(e) => upd("selloutFornecedor", e.target.value)}
                      placeholder="Ex: Ambev"
                    />
                  </Field>
                  <Field label="Valor da verba (R$)">
                    <Input
                      type="number"
                      step="0.01"
                      value={oferta.selloutValor}
                      onChange={(e) =>
                        upd("selloutValor", parseFloat(e.target.value) || 0)
                      }
                    />
                  </Field>
                  <Field label="Observações / condições de cobrança" className="md:col-span-2">
                    <Textarea
                      rows={2}
                      value={oferta.selloutObs}
                      onChange={(e) => upd("selloutObs", e.target.value)}
                      placeholder="Ex: NF emitida ao final da campanha, referência do contrato, contato do comprador..."
                    />
                  </Field>
                </div>
              )}
              {!oferta.selloutTemVerba && (
                <p className="text-xs text-muted-foreground">
                  Ative quando o fornecedor pagar uma verba específica por esta oferta (para
                  lembrar de cobrar depois).
                </p>
              )}
            </div>
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
