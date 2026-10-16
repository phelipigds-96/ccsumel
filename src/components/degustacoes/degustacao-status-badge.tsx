import React from "react";
import { Calendar, Play, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DegustacaoStatus } from "@/lib/degustacoes";

interface DegustacaoStatusBadgeProps {
  status: DegustacaoStatus;
  className?: string;
  showIcon?: boolean;
}

export function DegustacaoStatusBadge({
  status,
  className,
  showIcon = true,
}: DegustacaoStatusBadgeProps) {
  switch (status) {
    case "Programada":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-sky-50 text-sky-700 border-sky-200 font-medium px-2.5 py-0.5 gap-1.5",
            className,
          )}
        >
          {showIcon && <Calendar className="h-3.5 w-3.5 text-sky-500" />}
          <span>Programada</span>
        </Badge>
      );

    case "Ativa":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-emerald-50 text-emerald-700 border-emerald-300 font-medium px-2.5 py-0.5 gap-1.5 shadow-xs",
            className,
          )}
        >
          {showIcon && (
            <span className="relative flex h-2 w-2 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
          <span>Ativa</span>
        </Badge>
      );

    case "Aguardando Resultados":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-amber-50 text-amber-800 border-amber-300 font-medium px-2.5 py-0.5 gap-1.5",
            className,
          )}
        >
          {showIcon && <Clock className="h-3.5 w-3.5 text-amber-500" />}
          <span>Aguardando Resultados</span>
        </Badge>
      );

    case "Concluída":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-slate-100 text-slate-700 border-slate-300 font-medium px-2.5 py-0.5 gap-1.5",
            className,
          )}
        >
          {showIcon && <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />}
          <span>Concluída</span>
        </Badge>
      );

    case "Cancelada":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-red-50 text-red-700 border-red-200 font-medium px-2.5 py-0.5 gap-1.5",
            className,
          )}
        >
          {showIcon && <XCircle className="h-3.5 w-3.5 text-red-500" />}
          <span>Cancelada</span>
        </Badge>
      );

    default:
      return (
        <Badge variant="outline" className={className}>
          {status}
        </Badge>
      );
  }
}
