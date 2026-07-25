import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/verbas-cooperadas")({
  head: () => ({
    meta: [
      { title: "Verbas Cooperadas — SGMC" },
      { name: "description", content: "Gestão de verbas cooperadas." },
      { property: "og:title", content: "Verbas Cooperadas — SGMC" },
      { property: "og:description", content: "Gestão de verbas cooperadas." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Verbas Cooperadas" description="Controle verbas negociadas com fornecedores." />
      <EmptyModule name="Verbas" />
    </div>
  ),
});
