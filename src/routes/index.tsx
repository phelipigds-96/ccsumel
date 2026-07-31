import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Central de Campanhas Sumel" },
      {
        name: "description",
        content: "Gestão de campanhas, ofertas e verbas.",
      },
      { property: "og:title", content: "Central de Campanhas Sumel" },
      {
        property: "og:description",
        content: "Gestão de campanhas, ofertas e verbas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: user ? "/dashboard" : "/login", replace: true });
  }, [user, loading, navigate]);

  return null;
}
