import { useState } from "react";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRedirect,
} from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { getClientShowPath } from "@/lbs/routing";
import {
  ClientCreateFormFields,
  type ClientCreateFormValues,
} from "@/lbs/clients/ClientCreateForm";
import { emptyClientFormValues } from "@/lbs/clients/clientFormValues";
import { clientCreateFormValuesToUpsertInput } from "@/lbs/clients/lbsClientUpsert";

export const ClientCreatePage = () => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const redirect = useRedirect();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (values: ClientCreateFormValues) => {
    if (!identity?.id) {
      notify("You must be signed in to create a client", { type: "error" });
      return;
    }

    const companyName = values.company_name.trim();
    const primaryName = values.primary_full_name.trim();
    if (!companyName || !primaryName) {
      notify("Business name and primary contact name are required", {
        type: "warning",
      });
      return;
    }

    if (!("upsertLbsClient" in dataProvider)) {
      notify("Client creation is not available in this environment", {
        type: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await dataProvider.upsertLbsClient(
        clientCreateFormValuesToUpsertInput(values, identity.id),
      );
      notify(result.created ? "Client created" : "Client updated");
      redirect(getClientShowPath(result.company_id));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to save client", {
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-2 flex">
      <div className="max-w-3xl flex-1">
        <h1 className="mb-4 text-2xl font-semibold">New client</h1>
        <Form defaultValues={emptyClientFormValues()} onSubmit={handleSubmit}>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <ClientCreateFormFields />
              <FormToolbar />
              {isSaving ? (
                <p className="text-sm text-muted-foreground">Saving client…</p>
              ) : null}
            </CardContent>
          </Card>
        </Form>
      </div>
    </div>
  );
};
