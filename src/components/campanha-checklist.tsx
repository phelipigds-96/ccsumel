import { Check, Circle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { type Campanha, type ChecklistStatus, campanhasStore } from "@/lib/campanhas-store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface ChecklistProps {
  campanha: Campanha;
  className?: string;
}

export function CampanhaChecklist({ campanha, className }: ChecklistProps) {
  const { user } = useAuth();

  if (!user?.isAdmin) return null;

  const checklist = campanha.checklist || [];
  const completed = checklist.filter((item) => item.status === "Concluída").length;
  const total = checklist.length;
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const isDone = completed === total && total > 0;

  const toggleStatus = (id: string, currentStatus: ChecklistStatus) => {
    const newStatus: ChecklistStatus = currentStatus === "Concluída" ? "Pendente" : "Concluída";
    
    const nextChecklist = checklist.map((item) =>
      item.id === id ? { ...item, status: newStatus } : item
    );
    
    campanhasStore.setCampanhas((prev) =>
      prev.map((c) => (c.id === campanha.id ? { ...c, checklist: nextChecklist } : c))
    );
  };

  return (
    <div className={cn("rounded-xl border border-border/60 bg-card p-3.5 shadow-xs flex flex-col justify-between h-full", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            Checklist
          </h2>
          {isDone && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
              <CheckCircle2 className="h-2.5 w-2.5" /> Pronta
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Progress value={percentage} className="h-1.5 w-16" />
          <span className={cn("text-[11px] font-bold tabular-nums", isDone ? "text-emerald-600" : "text-navy")}>
            {completed}/{total}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-0.5">
        {checklist.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggleStatus(item.id, item.status)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/50",
              item.status === "Concluída" ? "opacity-60" : "opacity-100"
            )}
          >
            <div className={cn(
              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
              item.status === "Concluída" 
                ? "bg-emerald-500 border-emerald-500 text-white" 
                : "bg-background border-muted-foreground/30 text-transparent"
            )}>
              {item.status === "Concluída" ? <Check className="h-2.5 w-2.5" /> : null}
            </div>
            <span className={cn(
              "text-[11px] font-medium transition-colors truncate",
              item.status === "Concluída" ? "text-muted-foreground line-through" : "text-navy"
            )}>
              {item.task}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
