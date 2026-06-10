import { useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { ClientCreateFormValues } from "@/lbs/clients/ClientCreateForm";
import { clientCreateFormValuesToUpsertInput } from "@/lbs/clients/lbsClientUpsert";

export const useUpdateClientSubmit = (
  companyId: Identifier,
  primaryContactId?: Identifier | null,
) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isSaving, setIsSaving] = useState(false);

  const submitClientUpdate = async (
    values: ClientCreateFormValues,
  ): Promise<boolean> => {
    if (!identity?.id) {
      notify("You must be signed in to update this client", { type: "error" });
      return false;
    }

    if (!("upsertLbsClient" in dataProvider)) {
      notify("Client editing is not available in this environment", {
        type: "error",
      });
      return false;
    }

    setIsSaving(true);
    try {
      await dataProvider.upsertLbsClient({
        ...clientCreateFormValuesToUpsertInput(values, identity.id),
        companyId,
        primaryContactId:
          values.selected_primary_contact_id ?? primaryContactId ?? undefined,
        linkPrimaryContactOnly: true,
      });
      notify("Client updated", { type: "info" });
      refresh();
      return true;
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to update client",
        { type: "error" },
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { submitClientUpdate, isSaving };
};
