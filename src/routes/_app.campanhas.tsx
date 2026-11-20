import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { updateOportunidadeStatus } from "@/lib/oportunidades";
import {
  type Campanha,
  type Oferta,
  useCampanhasStore,
  campanhasStore,
} from "@/lib/campanhas-store";
import { CampanhasList } from "@/components/campanhas/campanhas-list";
import { CampanhaDetalhe } from "@/components/campanhas/campanha-detalhe";

export const Route = createFileRoute("/_app/campanhas")({
  head: () => ({
    meta: [
      { title: "Campanhas — Central de Campanhas Sumel" },
      {
        name: "description",
        content: "Gerenciamento de campanhas comerciais, encartes e ofertas do Supermercados Sumel.",
      },
      { property: "og:title", content: "Campanhas — Central de Campanhas Sumel" },
      {
        property: "og:description",
        content: "Gerenciamento de campanhas comerciais, encartes e ofertas do Supermercados Sumel.",
      },
    ],
  }),
  component: CampanhasModulo,
});

function CampanhasModulo() {
  const { campanhas, ofertas } = useCampanhasStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = campanhas.find((c) => c.id === selectedId) ?? null;

  const saveOferta = useCallback((o: Oferta) => {
    campanhasStore.setOfertas((prev) => {
      const exists = prev.some((p) => p.id === o.id);
      return exists ? prev.map((p) => (p.id === o.id ? o : p)) : [o, ...prev];
    });
  }, []);

  const deleteOferta = useCallback(
    async (id: string) => {
      const o = ofertas.find((off) => off.id === id);
      if (o) {
        // Se era de uma oportunidade, volta para Disponível no Supabase
        const { data } = await supabase
          .from("oportunidades" as any)
          .select("id")
          .eq("gtin", o.gtin)
          .eq("campanha_id", o.campanhaId)
          .maybeSingle();

        if (data && (data as any).id) {
          await updateOportunidadeStatus((data as any).id, "Disponível", null);
        }
      }
      campanhasStore.setOfertas((prev) => prev.filter((p) => p.id !== id));
    },
    [ofertas]
  );

  const deleteOfertas = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      const toDelete = ofertas.filter((o) => idSet.has(o.id));

      // Reverte oportunidades vinculadas para Disponível
      for (const o of toDelete) {
        if (o.gtin) {
          try {
            await supabase
              .from("oportunidades" as any)
              .update({ status: "Disponível", campanha_id: null, data_utilizacao: null })
              .eq("gtin", o.gtin)
              .eq("campanha_id", o.campanhaId);
          } catch (e) {
            console.error("[Campanhas] Erro ao liberar oportunidade em lote:", e);
          }
        }
      }

      campanhasStore.setOfertas((prev) => prev.filter((p) => !idSet.has(p.id)));
    },
    [ofertas]
  );

  const bulkUpdateOfertas = useCallback((ids: string[], patch: Partial<Oferta>) => {
    const idSet = new Set(ids);
    campanhasStore.setOfertas((prev) =>
      prev.map((o) => (idSet.has(o.id) ? { ...o, ...patch } : o))
    );
  }, []);

  const saveCampanha = useCallback((c: Campanha) => {
    campanhasStore.setCampanhas((prev) => {
      const exists = prev.some((p) => p.id === c.id);
      return exists ? prev.map((p) => (p.id === c.id ? c : p)) : [c, ...prev];
    });
  }, []);

  // LIBERAÇÃO DE OPORTUNIDADES ÓRFÃS AO EXCLUIR CAMPANHA
  const deleteCampanha = useCallback(async (id: string) => {
    try {
      // 1. Libera no Supabase todas as oportunidades que apontavam para esta campanha
      await supabase
        .from("oportunidades" as any)
        .update({
          status: "Disponível",
          campanha_id: null,
          data_utilizacao: null,
        })
        .eq("campanha_id", id);
    } catch (err) {
      console.error("[Campanhas] Erro ao liberar oportunidades ao excluir campanha:", err);
    }

    // 2. Remove do store local e sincroniza remoções
    campanhasStore.setCampanhas((prev) => prev.filter((p) => p.id !== id));
    campanhasStore.setOfertas((prev) => prev.filter((o) => o.campanhaId !== id));
  }, []);

  return selected ? (
    <CampanhaDetalhe
      campanha={selected}
      ofertas={ofertas.filter((o) => o.campanhaId === selected.id)}
      onBack={() => setSelectedId(null)}
      onSaveOferta={saveOferta}
      onDeleteOferta={deleteOferta}
      onDeleteOfertas={deleteOfertas}
      onBulkUpdateOfertas={bulkUpdateOfertas}
      onSaveCampanha={saveCampanha}
    />
  ) : (
    <CampanhasList
      campanhas={campanhas}
      ofertas={ofertas}
      onOpen={setSelectedId}
      onSave={saveCampanha}
      onDelete={deleteCampanha}
    />
  );
}
