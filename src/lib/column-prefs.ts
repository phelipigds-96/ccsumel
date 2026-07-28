import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

/** Per-user, per-table column visibility preferences (persisted in the database). */
export function useColumnPrefs(tableKey: string, allKeys: string[], defaults?: Record<string, boolean>) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Stabilize array/object refs by content
  const keysSig = allKeys.join("|");
  const defaultsSig = defaults ? JSON.stringify(defaults) : "";
  const stableKeys = useMemo(() => allKeys, [keysSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const stableDefaults = useMemo(() => defaults, [defaultsSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseline = useCallback((): Record<string, boolean> => {
    const base: Record<string, boolean> = {};
    stableKeys.forEach((k) => (base[k] = stableDefaults?.[k] ?? true));
    return base;
  }, [stableKeys, stableDefaults]);

  const [visible, setVisible] = useState<Record<string, boolean>>(baseline);

  useEffect(() => {
    let alive = true;
    const base = baseline();
    setVisible(base);
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("preferencias_colunas" as any)
        .select("colunas")
        .eq("usuario_id", userId)
        .eq("tabela", tableKey)
        .maybeSingle();
      if (!alive) return;
      const saved = (data as any)?.colunas as Record<string, boolean> | undefined;
      if (!saved) return;
      const next = { ...base };
      stableKeys.forEach((k) => {
        if (typeof saved[k] === "boolean") next[k] = saved[k];
      });
      setVisible(next);
    })();
    return () => {
      alive = false;
    };
  }, [userId, tableKey, baseline, stableKeys]);

  const toggle = (key: string) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !(prev[key] !== false) };
      if (userId) {
        void supabase
          .from("preferencias_colunas" as any)
          .upsert({ usuario_id: userId, tabela: tableKey, colunas: next }, { onConflict: "usuario_id,tabela" });
      }
      return next;
    });
  };

  const isVisible = (k: string) => visible[k] !== false;

  return { visible, isVisible, toggle };
}
