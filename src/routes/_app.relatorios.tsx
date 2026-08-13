import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Central de Campanhas Sumel" },
      { name: "description", content: "Relatórios gerenciais da Central de Campanhas Sumel." },
      { property: "og:title", content: "Relatórios — Central de Campanhas Sumel" },
      { property: "og:description", content: "Relatórios gerenciais da Central de Campanhas Sumel." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Relatórios" description="Gere análises e exportações do sistema." />
      <EmptyModule name="Relatórios" />
    </div>
  ),
});
