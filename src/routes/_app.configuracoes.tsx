import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Central de Campanhas Sumel" },
      { name: "description", content: "Configurações da Central de Campanhas Sumel." },
      { property: "og:title", content: "Configurações — Central de Campanhas Sumel" },
      { property: "og:description", content: "Configurações da Central de Campanhas Sumel." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Configurações" description="Ajuste preferências e parâmetros do sistema." />
      <EmptyModule name="Configurações" />
    </div>
  ),
});
