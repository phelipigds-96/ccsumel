import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/verbas-cooperadas")({
  head: () => ({
    meta: [
      { title: "Verbas Cooperadas — Central de Campanhas Sumel" },
      { name: "description", content: "Gestão de verbas cooperadas na Central de Campanhas Sumel." },
      { property: "og:title", content: "Verbas Cooperadas — Central de Campanhas Sumel" },
      { property: "og:description", content: "Gestão de verbas cooperadas na Central de Campanhas Sumel." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Verbas Cooperadas" description="Controle verbas negociadas com fornecedores." />
      <EmptyModule name="Verbas" />
    </div>
  ),
});
