import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-navy truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyModule({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-primary font-bold">
        {name.charAt(0)}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">Módulo {name}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
        Este módulo está preparado para receber suas funcionalidades. Em breve você poderá gerenciar {name.toLowerCase()} por aqui.
      </p>
    </div>
  );
}
