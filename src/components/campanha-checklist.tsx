import { useState } from "react";
import { Plus, Check, Loader2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Campanha, type ChecklistItem, type ChecklistStatus, campanhasStore } from "@/lib/campanhas-store";
import { useAuth } from "@/lib/auth";

interface ChecklistProps {
  campanha: Campanha;
}

export function CampanhaChecklist({ campanha }: ChecklistProps) {
  const { user } = useAuth();
  const [newTask, setNewTask] = useState("");

  if (!user?.isAdmin) return null;

  const checklist = campanha.checklist || [];
  const completed = checklist.filter((item) => item.status === "Concluída").length;
  const total = checklist.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const updateStatus = (id: string, status: ChecklistStatus) => {
    const nextChecklist = checklist.map((item) =>
      item.id === id ? { ...item, status } : item
    );
    campanhasStore.setCampanhas((prev) =>
      prev.map((c) => (c.id === campanha.id ? { ...c, checklist: nextChecklist } : c))
    );
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      task: newTask.trim(),
      status: "Pendente",
    };
    const nextChecklist = [...checklist, newItem];
    campanhasStore.setCampanhas((prev) =>
      prev.map((c) => (c.id === campanha.id ? { ...c, checklist: nextChecklist } : c))
    );
    setNewTask("");
  };

  const statusColors: Record<ChecklistStatus, string> = {
    Pendente: "bg-slate-100 text-slate-600 border-slate-200",
    "Em andamento": "bg-blue-100 text-blue-600 border-blue-200",
    Concluída: "bg-emerald-100 text-emerald-600 border-emerald-200",
  };

  const statusIcons: Record<ChecklistStatus, React.ReactNode> = {
    Pendente: <Circle className="h-4 w-4" />,
    "Em andamento": <Loader2 className="h-4 w-4 animate-spin" />,
    Concluída: <Check className="h-4 w-4" />,
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy">Checklist de Execução</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe o progresso das etapas de lançamento desta campanha.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-sm font-bold text-navy">
            {completed}/{total} — {percentage}% concluído
          </span>
          <Progress value={percentage} className="h-2 w-32 sm:w-48" />
        </div>
      </div>

      <div className="space-y-3">
        {checklist.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                {statusIcons[item.status]}
              </div>
              <span className={"font-medium " + (item.status === "Concluída" ? "text-muted-foreground line-through" : "text-navy")}>
                {item.task}
              </span>
            </div>

            <Select
              value={item.status}
              onValueChange={(val) => updateStatus(item.id, val as ChecklistStatus)}
            >
              <SelectTrigger className={"h-9 w-full sm:w-[160px] " + statusColors[item.status]}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pendente">⬜ Pendente</SelectItem>
                <SelectItem value="Em andamento">🔵 Em andamento</SelectItem>
                <SelectItem value="Concluída">🟢 Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Nova tarefa adicional..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            className="flex-1"
          />
          <Button onClick={addTask} disabled={!newTask.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Tarefa
          </Button>
        </div>
      </div>
    </div>
  );
}
