import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyModule } from "@/components/page-header";

export const Route = createFileRoute("/_app/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — SGMC" },
      { name: "description", content: "Gerencie usuários e permissões." },
      { property: "og:title", content: "Usuários — SGMC" },
      { property: "og:description", content: "Gerencie usuários e permissões." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Usuários" description="Gerencie acessos e permissões do sistema." />
      <EmptyModule name="Usuários" />
    </div>
  ),
});
