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
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-navy flex items-center gap-2">
            Checklist
            {isDone && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Campanha pronta
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <Progress value={percentage} className="h-1.5 w-20" />
            <span className={cn("text-[10px] font-bold", isDone ? "text-emerald-600" : "text-navy")}>
              {completed}/{total}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {checklist.map((item) => (
          <button
            key={item.id}
            onClick={() => toggleStatus(item.id, item.status)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-all hover:bg-slate-50",
              item.status === "Concluída" ? "opacity-60" : "opacity-100"
            )}
          >
            <div className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
              item.status === "Concluída" 
                ? "bg-emerald-500 border-emerald-500 text-white" 
                : "bg-white border-slate-300 text-slate-300"
            )}>
              {item.status === "Concluída" ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2 fill-current" />}
            </div>
            <span className={cn(
              "text-xs font-medium transition-colors",
              item.status === "Concluída" ? "text-emerald-700 line-through" : "text-navy"
            )}>
              {item.task}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}