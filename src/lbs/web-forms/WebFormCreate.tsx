import { CreateBase, Form } from "ra-core";
import { Link } from "react-router";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Form as WebFormRecord } from "@/lbs/types";
import { WebFormInputs } from "@/lbs/web-forms/WebFormInputs";
import { DEFAULT_CUSTOM_FORM_SCHEMA } from "@/lbs/web-forms/customFormSchema";
import { normalizeWebFormSlug } from "@/lbs/web-forms/webFormConstants";

export const WebFormCreate = () => (
  <CreateBase
    resource="forms"
    redirect={(resource, id) => `/web-forms/${id}/show`}
    transform={(data: WebFormRecord) => ({
      ...data,
      name: data.name?.trim(),
      slug: normalizeWebFormSlug(data.slug ?? ""),
      description: data.description?.trim() || null,
      active: data.active ?? true,
      schema: data.schema ?? DEFAULT_CUSTOM_FORM_SCHEMA,
    })}
  >
    <div className="space-y-4 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">New web form</h1>
        <Button type="button" variant="outline" asChild>
          <Link to="/web-forms">Cancel</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-muted-foreground">
            Create a custom form with your own fields. Clients can fill it out
            at /forms/your-slug once the form is active.
          </p>
          <Form
            defaultValues={{
              active: true,
              schema: DEFAULT_CUSTOM_FORM_SCHEMA,
            }}
          >
            <WebFormInputs />
            <FormToolbar>
              <SaveButton label="Create form" />
            </FormToolbar>
          </Form>
        </CardContent>
      </Card>
    </div>
  </CreateBase>
);
