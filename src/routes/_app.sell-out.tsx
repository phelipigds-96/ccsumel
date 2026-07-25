import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/sell-out")({
  head: () => ({
    meta: [
      { title: "Sell Out — SGMC" },
      { name: "description", content: "Acompanhamento de sell out." },
      { property: "og:title", content: "Sell Out — SGMC" },
      { property: "og:description", content: "Acompanhamento de sell out." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Sell Out" description="Acompanhe a saída de produtos no ponto de venda." />
      <EmptyModule name="Sell Out" />
    </div>
  ),
});
