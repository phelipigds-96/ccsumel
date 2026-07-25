import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sgmc.auth.user");
      throw redirect({ to: stored ? "/dashboard" : "/login" });
    }
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
