import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_produtos_em_falta",
  title: "Listar produtos em falta",
  description: "Lista os apontamentos de produtos em falta que o usuário pode ver, mais recentes primeiro.",
  inputSchema: {
    status: z.string().optional().describe("Filtrar por status exato, ex.: Pendente (opcional)."),
    limit: z.number().int().min(1).max(100).optional().describe("Máximo de registros (padrão 30)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("produtos_em_falta")
      .select("id, product_id, store_id, status, reported_at, reported_by_name, observation, management_observation")
      .order("reported_at", { ascending: false })
      .limit(limit ?? 30);
    if (status) q = q.eq("status", status as never);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const faltas = (data ?? []).map((f) => ({
      id: String(f.id),
      product_id: String(f.product_id),
      store_id: String(f.store_id),
      status: String(f.status),
      reported_at: String(f.reported_at),
      reported_by_name: String(f.reported_by_name ?? ""),
      observation: String(f.observation ?? ""),
      management_observation: String(f.management_observation ?? ""),
    }));
    return { content: [{ type: "text", text: JSON.stringify(faltas) }], structuredContent: { faltas } };
  },
});
