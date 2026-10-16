import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_produtos",
  title: "Buscar produtos",
  description: "Busca produtos do catálogo por parte da descrição, código ou código de barras.",
  inputSchema: {
    termo: z.string().min(1).describe("Texto, código interno ou EAN a buscar."),
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de resultados (padrão 20)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ termo, limit }, ctx) => {
    const supabase = supabaseForUser(ctx);
    const t = termo.replace(/[%,()]/g, " ").trim();
    const { data, error } = await supabase
      .from("produtos")
      .select("id, codigo, gtin, descricao, preco_venda, ativo")
      .or(`descricao.ilike.%${t}%,codigo.eq.${t},gtin.eq.${t}`)
      .limit(limit ?? 20);
    if (error) throw new ToolError(error.message);
    const produtos = (data ?? []).map((p) => ({
      id: String(p.id),
      codigo: p.codigo ? String(p.codigo) : null,
      gtin: p.gtin ? String(p.gtin) : null,
      descricao: String(p.descricao ?? ""),
      preco_venda: Number(p.preco_venda ?? 0),
      ativo: Boolean(p.ativo),
    }));
    return { content: [{ type: "text", text: JSON.stringify(produtos) }], structuredContent: { produtos } };
  },
});
