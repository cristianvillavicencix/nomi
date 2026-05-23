import { useState } from "react";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRedirect,
} from "ra-core";
import { Link, useParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact } from "@/components/atomic-crm/types";
import {
  ClientCreateFormFields,
  type ClientCreateFormValues,
} from "@/lbs/clients/ClientCreateForm";
import {
  companyToClientFormValues,
  emptyClientFormValues,
} from "@/lbs/clients/clientFormValues";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";
import { clientCreateFormValuesToUpsertInput } from "@/lbs/clients/lbsClientUpsert";
import { getClientShowPath } from "@/lbs/routing";

export const ClientEditPage = () => {
  const { id } = useParams();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const redirect = useRedirect();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [isSaving, setIsSaving] = useState(false);

  const { data: company, isPending: companyPending } =
    useGetOne<CompanyWithPrimaryContact>(
      "companies",
      { id: id! },
      { enabled: !!id },
    );

  const { data: primaryContact, isPending: contactPending } =
    useGetOne<Contact>(
      "contacts",
      { id: company?.primary_contact_id! },
      { enabled: !!company?.primary_contact_id },
    );

  if (!id) return null;
  if (companyPending || (company?.primary_contact_id && contactPending))
    return null;
  if (!company) return null;

  const defaultValues = companyToClientFormValues(
    company,
    primaryContact ?? null,
  );

  const handleSubmit = async (values: ClientCreateFormValues) => {
    if (!identity?.id) {
      notify("You must be signed in to update this client", { type: "error" });
      return;
    }

    if (!("upsertLbsClient" in dataProvider)) {
      notify("Client editing is not available in this environment", {
        type: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await dataProvider.upsertLbsClient({
        ...clientCreateFormValuesToUpsertInput(values, identity.id),
        companyId: id,
        primaryContactId: company.primary_contact_id ?? undefined,
      });
      notify("Client updated");
      redirect(getClientShowPath(result.company_id));
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to update client",
        { type: "error" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-2 flex">
      <div className="max-w-3xl flex-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Edit client</h1>
          <Button asChild variant="ghost" size="sm">
            <Link to={getClientShowPath(id)}>Cancel</Link>
          </Button>
        </div>
        <Form
          key={String(company.id)}
          defaultValues={defaultValues ?? emptyClientFormValues()}
          onSubmit={handleSubmit}
        >
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
