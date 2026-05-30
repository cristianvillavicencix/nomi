import { Form, useRedirect } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";
import { getClientShowPath } from "@/lbs/routing";
import {
  ClientCreateFormFields,
  type ClientCreateFormValues,
} from "@/lbs/clients/ClientCreateForm";
import { emptyClientFormValues } from "@/lbs/clients/clientFormValues";
import { useCreateClientSubmit } from "@/lbs/clients/useCreateClientSubmit";

export const ClientCreatePage = () => {
  const redirect = useRedirect();
  const { submitClientCreate, isSaving } = useCreateClientSubmit();

  const handleSubmit = async (values: ClientCreateFormValues) => {
    const companyId = await submitClientCreate(values);
    if (companyId != null) {
      redirect(getClientShowPath(companyId));
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
