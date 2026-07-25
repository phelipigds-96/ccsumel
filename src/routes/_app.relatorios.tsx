import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — SGMC" },
      { name: "description", content: "Relatórios gerenciais do SGMC." },
      { property: "og:title", content: "Relatórios — SGMC" },
      { property: "og:description", content: "Relatórios gerenciais do SGMC." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Relatórios" description="Gere análises e exportações do sistema." />
      <EmptyModule name="Relatórios" />
    </div>
  ),
});
