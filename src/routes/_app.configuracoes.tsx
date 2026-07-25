import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — SGMC" },
      { name: "description", content: "Configurações do sistema SGMC." },
      { property: "og:title", content: "Configurações — SGMC" },
      { property: "og:description", content: "Configurações do sistema SGMC." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Configurações" description="Ajuste preferências e parâmetros do sistema." />
      <EmptyModule name="Configurações" />
    </div>
  ),
});
