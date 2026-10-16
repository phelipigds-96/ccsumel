import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCampanhas from "./tools/list-campanhas";
import searchProdutos from "./tools/search-produtos";
import listProdutosEmFalta from "./tools/list-produtos-em-falta";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "central-de-campanhas-sumel",
  title: "Central de campanhas Sumel",
  version: "0.1.0",
  instructions:
    "Ferramentas da Central de Campanhas Sumel: consultar campanhas, buscar produtos do catálogo e listar produtos em falta, respeitando as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCampanhas, searchProdutos, listProdutosEmFalta],
});
