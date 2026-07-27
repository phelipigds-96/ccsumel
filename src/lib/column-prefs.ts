import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

/** Per-user, per-table column visibility preferences (persisted in localStorage). */
export function useColumnPrefs(tableKey: string, allKeys: string[], defaults?: Record<string, boolean>) {
  const { user } = useAuth();
  const storageKey = `sgmc.colprefs.${user?.id ?? "anon"}.${tableKey}`;

  const initial = useCallback((): Record<string, boolean> => {
    const base: Record<string, boolean> = {};
    allKeys.forEach((k) => (base[k] = defaults?.[k] ?? true));
    if (typeof window === "undefined") return base;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, boolean>;
        allKeys.forEach((k) => {
          if (typeof saved[k] === "boolean") base[k] = saved[k];
        });
      }
    } catch {
      // ignore
    }
    return base;
  }, [storageKey, allKeys, defaults]);

  const [visible, setVisible] = useState<Record<string, boolean>>(initial);

  // Reload when user or table changes
  useEffect(() => {
    setVisible(initial());
  }, [initial]);

  const toggle = (key: string) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const isVisible = (k: string) => visible[k] !== false;

  return { visible, isVisible, toggle };
}
