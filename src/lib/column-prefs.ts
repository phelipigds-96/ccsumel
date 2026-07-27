import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";

/** Per-user, per-table column visibility preferences (persisted in localStorage). */
export function useColumnPrefs(tableKey: string, allKeys: string[], defaults?: Record<string, boolean>) {
  const { user } = useAuth();
  const storageKey = `sgmc.colprefs.${user?.id ?? "anon"}.${tableKey}`;

  // Stabilize array/object refs by content
  const keysSig = allKeys.join("|");
  const defaultsSig = defaults ? JSON.stringify(defaults) : "";
  const stableKeys = useMemo(() => allKeys, [keysSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const stableDefaults = useMemo(() => defaults, [defaultsSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const compute = useCallback((): Record<string, boolean> => {
    const base: Record<string, boolean> = {};
    stableKeys.forEach((k) => (base[k] = stableDefaults?.[k] ?? true));
    if (typeof window === "undefined") return base;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, boolean>;
        stableKeys.forEach((k) => {
          if (typeof saved[k] === "boolean") base[k] = saved[k];
        });
      }
    } catch {
      // ignore
    }
    return base;
  }, [storageKey, stableKeys, stableDefaults]);

  const [visible, setVisible] = useState<Record<string, boolean>>(compute);

  useEffect(() => {
    setVisible(compute());
  }, [compute]);

  const toggle = (key: string) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !(prev[key] !== false) };
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
