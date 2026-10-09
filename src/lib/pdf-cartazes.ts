import jsPDF from "jspdf";
import type { Oferta } from "./campanhas-store";

export type TextPosition = {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  visible: boolean;
  maxWidth?: number;
};

export type CartazLayoutConfig = {
  produto: TextPosition;
  precoNormal: TextPosition;
  precoPromo: TextPosition;
  validade: TextPosition;
};

export type CartazTemplate = {
  id: string;
  nome: string;
  bg_url: string | null;
  config: CartazLayoutConfig;
};

export const defaultLayoutConfig: CartazLayoutConfig = {
  produto: { x: 105, y: 30, fontSize: 36, color: "#000000", align: "center", visible: true, maxWidth: 190 },
  precoNormal: { x: 50, y: 80, fontSize: 24, color: "#000000", align: "center", visible: true },
  precoPromo: { x: 150, y: 120, fontSize: 80, color: "#FFFFFF", align: "center", visible: true },
  validade: { x: 105, y: 140, fontSize: 14, color: "#000000", align: "center", visible: true },
};

/**
 * Função utilitária para converter URL de imagem em Base64 (necessário para o jsPDF)
 */
async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Desenha os centavos elevados (ex: 29,99)
 */
function drawPrice(doc: jsPDF, price: number, config: TextPosition, yOffset: number = 0) {
  if (!config.visible) return;
  const priceStr = price.toFixed(2); // "29.99"
  const parts = priceStr.split(".");
  const reais = parts[0];
  const cents = "," + parts[1];
  const currency = "R$ ";

  doc.setTextColor(config.color);
  
  const baseFontSize = config.fontSize;
  const currencyFontSize = baseFontSize * 0.4;
  const centsFontSize = baseFontSize * 0.5;

  // Calculando as larguras exatas para alinhar perfeitamente
  doc.setFontSize(currencyFontSize);
  const wCurrency = doc.getTextWidth(currency);

  doc.setFontSize(baseFontSize);
  const wReais = doc.getTextWidth(reais);

  doc.setFontSize(centsFontSize);
  const wCents = doc.getTextWidth(cents);

  const totalWidth = wCurrency + wReais + wCents;

  let startX = config.x;
  if (config.align === "center") {
    startX = config.x - (totalWidth / 2);
  } else if (config.align === "right") {
    startX = config.x - totalWidth;
  }

  const y = config.y + yOffset;

  // Desenha Moeda (R$) um pouco levantada
  doc.setFontSize(currencyFontSize);
  doc.text(currency, startX, y - (baseFontSize * 0.15));

  // Desenha os Reais (Ex: 29) gigante
  doc.setFontSize(baseFontSize);
  doc.text(reais, startX + wCurrency, y);

  // Desenha os Centavos (Ex: ,99) pequenos e alinhados no topo
  doc.setFontSize(centsFontSize);
  doc.text(cents, startX + wCurrency + wReais, y - (baseFontSize * 0.25));
}

/**
 * Gera o PDF com 2 cartazes por página A4 (Meia Folha Horizontal)
 */
export async function generateCartazesPDF(ofertas: Oferta[], template: CartazTemplate, validadeText: string): Promise<string> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  doc.setFont("helvetica", "bold");

  let bgBase64: string | null = null;
  if (template.bg_url) {
    try {
      bgBase64 = await getBase64ImageFromUrl(template.bg_url);
    } catch (e) {
      console.error("Erro ao carregar imagem de fundo", e);
    }
  }

  const itemsPerPage = 2;
  const halfHeight = 148.5; // Metade do A4 (297 / 2)
  const pageWidth = 210;

  for (let i = 0; i < ofertas.length; i++) {
    const oferta = ofertas[i];
    const isBottom = i % 2 === 1;
    const yOffset = isBottom ? halfHeight : 0;

    // Se for o primeiro item da página (e não a primeira página), adiciona página
    if (i > 0 && i % itemsPerPage === 0) {
      doc.addPage();
    }

    // Desenha o fundo
    if (bgBase64) {
      // Identifica o formato pela string base64
      const format = bgBase64.includes("image/jpeg") || bgBase64.includes("image/jpg") ? "JPEG" : "PNG";
      doc.addImage(bgBase64, format, 0, yOffset, pageWidth, halfHeight);
    } else {
      // Fundo branco se não tiver imagem
      doc.setFillColor(255, 255, 255);
      doc.rect(0, yOffset, pageWidth, halfHeight, "F");
    }

    // Linha pontilhada no meio (se for o topo)
    if (!isBottom) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(0, halfHeight, pageWidth, halfHeight);
      doc.setLineDashPattern([], 0); // reseta
    }

    const cfg = template.config;

    // 1. NOME DO PRODUTO
    if (cfg.produto.visible) {
      doc.setFontSize(cfg.produto.fontSize);
      doc.setTextColor(cfg.produto.color);
      
      const nome = oferta.descricao || "PRODUTO SEM NOME";
      // Quebra de texto
      const textLines = doc.splitTextToSize(nome, cfg.produto.maxWidth || 190);
      doc.text(textLines, cfg.produto.x, cfg.produto.y + yOffset, { align: cfg.produto.align });
    }

    // 2. PREÇO NORMAL
    if (cfg.precoNormal.visible && oferta.precoNormal) {
      // Aqui podemos usar um risco no meio se quisermos
      drawPrice(doc, oferta.precoNormal, cfg.precoNormal, yOffset);
    }

    // 3. PREÇO PROMO
    if (cfg.precoPromo.visible && oferta.precoPromocional) {
      drawPrice(doc, oferta.precoPromocional, cfg.precoPromo, yOffset);
    }

    // 4. VALIDADE
    if (cfg.validade.visible && validadeText) {
      doc.setFontSize(cfg.validade.fontSize);
      doc.setTextColor(cfg.validade.color);
      doc.text(validadeText, cfg.validade.x, cfg.validade.y + yOffset, { align: cfg.validade.align });
    }
  }

  return doc.output("bloburl") as unknown as string;
}
