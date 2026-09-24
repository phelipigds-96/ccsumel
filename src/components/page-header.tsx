import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border bg-navy/5 px-4 py-5 shadow-[0_2px_16px_-6px_rgba(11,31,58,0.12)]">
      <span className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-navy/[0.06] blur-3xl" />
      <span className="pointer-events-none absolute -bottom-8 left-1/3 h-28 w-28 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-navy break-words sm:truncate">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-dashed border-border bg-card p-10 text-center ${className}`}>
      <p className="text-sm text-muted-foreground">{message}</p>
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
