import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — SGMC" },
      { name: "description", content: "Gerencie campanhas de marketing comercial." },
      { property: "og:title", content: "Campanhas — SGMC" },
      { property: "og:description", content: "Gerencie campanhas de marketing comercial." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Campanhas" description="Planeje e acompanhe suas campanhas comerciais." />
      <EmptyModule name="Campanhas" />
    </div>
  ),
});
