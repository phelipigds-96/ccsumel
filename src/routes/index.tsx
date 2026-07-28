import { createFileRoute, redirect } from "@tanstack/react-router";
import { hasSessionPointer } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: hasSessionPointer() ? "/dashboard" : "/login" });
  },
  component: () => null,
});
