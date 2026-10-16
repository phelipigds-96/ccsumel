import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_campanhas",
  title: "Listar campanhas",
  description: "Lista as campanhas comerciais visíveis ao usuário, com status e período.",
  inputSchema: {
    status: z.string().optional().describe("Filtrar por status exato (opcional)."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de campanhas (padrão 30)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("campanhas")
      .select("id, nome, descricao, status, data_inicial, data_final, clube_sumel")
      .order("data_inicial", { ascending: false })
      .limit(limit ?? 30);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const campanhas = (data ?? []).map((c) => ({
      id: String(c.id),
      nome: String(c.nome ?? ""),
      descricao: String(c.descricao ?? ""),
      status: String(c.status ?? ""),
      data_inicial: c.data_inicial ? String(c.data_inicial) : null,
      data_final: c.data_final ? String(c.data_final) : null,
      clube_sumel: Boolean(c.clube_sumel),
    }));
    return { content: [{ type: "text", text: JSON.stringify(campanhas) }], structuredContent: { campanhas } };
  },
});
