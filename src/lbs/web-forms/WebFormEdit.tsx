import { EditBase, Form, useNotify, useRecordContext, useRedirect } from "ra-core";
import { Link, useParams } from "react-router";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Form as WebFormRecord } from "@/lbs/types";
import { WebFormInputs } from "@/lbs/web-forms/WebFormInputs";
import { isSystemWebFormSlug } from "@/lbs/web-forms/webFormConstants";

const WebFormEditForm = () => {
  const record = useRecordContext<WebFormRecord>();

  return (
    <>
      <WebFormInputs
        slugDisabled={record?.slug ? isSystemWebFormSlug(record.slug) : true}
        showFieldsEditor={record?.slug ? !isSystemWebFormSlug(record.slug) : true}
      />
      <FormToolbar>
        <SaveButton />
      </FormToolbar>
    </>
  );
};

export const WebFormEdit = () => {
  const { id } = useParams();
  const notify = useNotify();
  const redirect = useRedirect();

  if (!id) return null;

  return (
    <EditBase
      resource="forms"
      id={id}
      redirect={false}
      mutationOptions={{
        onSuccess: () => {
          notify("Web form updated");
          redirect(`/web-forms/${id}/show`);
        },
      }}
    >
      <div className="space-y-4 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Edit web form</h1>
          <Button type="button" variant="outline" asChild>
            <Link to={`/web-forms/${id}/show`}>Cancel</Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Form className="flex flex-col gap-4">
              <WebFormEditForm />
            </Form>
          </CardContent>
        </Card>
      </div>
    </EditBase>
  );
};
