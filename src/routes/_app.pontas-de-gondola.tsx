import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/pontas-de-gondola")({
  head: () => ({
    meta: [
      { title: "Pontas de Gôndola — Central de Campanhas Sumel" },
      { name: "description", content: "Gestão de pontas de gôndola na Central de Campanhas Sumel." },
      { property: "og:title", content: "Pontas de Gôndola — Central de Campanhas Sumel" },
      { property: "og:description", content: "Gestão de pontas de gôndola na Central de Campanhas Sumel." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Pontas de Gôndola" description="Reserve e monitore espaços de destaque em loja." />
      <EmptyModule name="Pontas de Gôndola" />
    </div>
  ),
});
