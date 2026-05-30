import { useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { ClientCreateFormValues } from "@/lbs/clients/ClientCreateForm";
import { clientCreateFormValuesToUpsertInput } from "@/lbs/clients/lbsClientUpsert";

export const useCreateClientSubmit = () => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isSaving, setIsSaving] = useState(false);

  const submitClientCreate = async (
    values: ClientCreateFormValues,
  ): Promise<number | string | null> => {
    if (!identity?.id) {
      notify("Debes iniciar sesión para crear un cliente", { type: "error" });
      return null;
    }

    const companyName = values.company_name.trim();
    const primaryName = values.primary_full_name.trim();
    if (!companyName || !primaryName) {
      notify("El nombre de la empresa y del contacto principal son obligatorios", {
        type: "warning",
      });
      return null;
    }

    if (!("upsertLbsClient" in dataProvider)) {
      notify("La creación de clientes no está disponible en este entorno", {
        type: "error",
      });
      return null;
    }

    setIsSaving(true);
    try {
      const result = await dataProvider.upsertLbsClient(
        clientCreateFormValuesToUpsertInput(values, identity.id),
      );
      notify(result.created ? "Cliente creado" : "Cliente actualizado", {
        type: "info",
      });
      refresh();
      return result.company_id;
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "No se pudo guardar el cliente",
        { type: "error" },
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  return { submitClientCreate, isSaving };
};
