import type { ComponentType } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "primary" | "navy";
  className?: string;
}

const TONE_CLASS = {
  primary: {
    bar: "bg-primary",
    iconBg: "bg-primary/10 text-primary",
  },
  navy: {
    bar: "bg-navy",
    iconBg: "bg-navy/10 text-navy",
  },
};

export function StatCard({ label, value, sub, icon: Icon, tone = "navy", className = "" }: StatCardProps) {
  const t = TONE_CLASS[tone];
  return (
    <div className={`group relative overflow-hidden rounded-xl border bg-card p-4 transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(11,31,58,0.45)] ${className}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && (
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${t.iconBg}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold tabular-nums text-navy sm:text-4xl">{value}</span>
        {sub && <span className="text-xs font-medium text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}
