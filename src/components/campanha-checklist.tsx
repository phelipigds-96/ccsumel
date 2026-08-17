import { Check, Circle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { type Campanha, type ChecklistStatus, campanhasStore } from "@/lib/campanhas-store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface ChecklistProps {
  campanha: Campanha;
}

export function CampanhaChecklist({ campanha }: ChecklistProps) {
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
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy flex items-center gap-2">
            Checklist de Execução
            {isDone && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="h-3 w-3" />
                Campanha pronta
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Etapas padronizadas para o lançamento da campanha.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={cn("text-sm font-bold", isDone ? "text-emerald-600" : "text-navy")}>
            {completed}/{total} — {percentage % 1 === 0 ? percentage : percentage.toFixed(1)}%
          </span>
          <Progress value={percentage} className="h-2 w-32 sm:w-48" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {checklist.map((item) => (
          <button
            key={item.id}
            onClick={() => toggleStatus(item.id, item.status)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-slate-50 active:scale-[0.98]",
              item.status === "Concluída" ? "bg-emerald-50/30 border-emerald-100" : "bg-card border-slate-200"
            )}
          >
            <div className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
              item.status === "Concluída" 
                ? "bg-emerald-500 border-emerald-500 text-white" 
                : "bg-white border-slate-300 text-slate-300"
            )}>
              {item.status === "Concluída" ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3 fill-current" />}
            </div>
            <span className={cn(
              "font-medium transition-colors",
              item.status === "Concluída" ? "text-emerald-700 line-through opacity-70" : "text-navy"
            )}>
              {item.task}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}