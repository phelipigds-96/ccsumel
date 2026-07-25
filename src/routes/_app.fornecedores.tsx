import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores — SGMC" },
      { name: "description", content: "Cadastro e gestão de fornecedores." },
      { property: "og:title", content: "Fornecedores — SGMC" },
      { property: "og:description", content: "Cadastro e gestão de fornecedores." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Fornecedores" description="Cadastre e gerencie seus parceiros comerciais." />
      <EmptyModule name="Fornecedores" />
    </div>
  ),
});
