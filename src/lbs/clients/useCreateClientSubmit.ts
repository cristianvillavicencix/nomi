import { useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { ClientCreateFormValues } from "@/lbs/clients/ClientCreateForm";
import {
  clientCreateFormValuesToUpsertInput,
  hasPrimaryContactDraft,
} from "@/lbs/clients/lbsClientUpsert";

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
      notify("You must be signed in to create a client", { type: "error" });
      return null;
    }

    const companyName = values.company_name.trim();
    if (!companyName) {
      notify("Company name is required", { type: "warning" });
      return null;
    }

    if (hasPrimaryContactDraft(values) && !values.primary_full_name.trim()) {
      notify("Primary contact name is required when adding contact details", {
        type: "warning",
      });
      return null;
    }

    if (!("upsertLbsClient" in dataProvider)) {
      notify("Client creation is not available in this environment", {
        type: "error",
      });
      return null;
    }

    setIsSaving(true);
    try {
      const result = await dataProvider.upsertLbsClient(
        clientCreateFormValuesToUpsertInput(values, identity.id),
      );
      notify(result.created ? "Client created" : "Client updated", {
        type: "info",
      });
      refresh();
      return result.company_id;
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to save client",
        { type: "error" },
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  return { submitClientCreate, isSaving };
};
