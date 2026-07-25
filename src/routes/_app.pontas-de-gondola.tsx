import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/pontas-de-gondola")({
  head: () => ({
    meta: [
      { title: "Pontas de Gôndola — SGMC" },
      { name: "description", content: "Gestão de pontas de gôndola." },
      { property: "og:title", content: "Pontas de Gôndola — SGMC" },
      { property: "og:description", content: "Gestão de pontas de gôndola." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Pontas de Gôndola" description="Reserve e monitore espaços de destaque em loja." />
      <EmptyModule name="Pontas de Gôndola" />
    </div>
  ),
});
