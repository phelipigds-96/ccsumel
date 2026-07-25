import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/central-de-ofertas")({
  head: () => ({
    meta: [
      { title: "Central de Ofertas — SGMC" },
      { name: "description", content: "Central de ofertas do SGMC." },
      { property: "og:title", content: "Central de Ofertas — SGMC" },
      { property: "og:description", content: "Central de ofertas do SGMC." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Central de Ofertas" description="Publique e gerencie ofertas comerciais." />
      <EmptyModule name="Ofertas" />
    </div>
  ),
});
