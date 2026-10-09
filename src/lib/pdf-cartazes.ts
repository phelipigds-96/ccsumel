import jsPDF from "jspdf";
import type { Oferta } from "./campanhas-store";
import { supabase } from "@/integrations/supabase/client";

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
 * Baixa a imagem usando a API do Supabase (para furar o bloqueio de CORS), desenha num Canvas,
 * e extrai um base64 puro em JPEG garantido.
 */
async function getNormalizedJpegBase64(imageUrl: string): Promise<string> {
  let blob: Blob;

  // Se a URL for do nosso Storage, usa o cliente oficial para evitar bloqueios CORS do navegador
  if (imageUrl.includes("/public/campanha-materiais/")) {
    const path = decodeURIComponent(imageUrl.split("/public/campanha-materiais/")[1]);
    const { data, error } = await supabase.storage.from("campanha-materiais").download(path);
    if (error || !data) {
      throw new Error("Falha ao baixar imagem via Supabase: " + (error?.message || "Sem dados"));
    }
    blob = data;
  } else {
    // Fallback para imagens de fora (caso exista)
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error("Falha no fetch: " + res.status);
    blob = await res.blob();
  }

  const objUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Fundo branco caso a imagem tenha transparência
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Extrai como JPEG puro
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        URL.revokeObjectURL(objUrl);
        // Retorna só o base64 (removendo "data:image/jpeg;base64,")
        resolve(dataUrl.split(",")[1]);
      } else {
        URL.revokeObjectURL(objUrl);
        reject(new Error("Erro ao criar contexto de imagem"));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("Erro ao carregar a imagem na tela invisível"));
    };
    img.src = objUrl;
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
      bgBase64 = await getNormalizedJpegBase64(template.bg_url);
    } catch (e) {
      console.error("Erro ao normalizar imagem de fundo", e);
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
      // Como a imagem já foi normalizada no canvas, ela é 100% um JPEG válido!
      doc.addImage(bgBase64, "JPEG", 0, yOffset, pageWidth, halfHeight);
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
