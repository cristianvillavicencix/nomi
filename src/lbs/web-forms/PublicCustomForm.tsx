import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { useSearchParams } from "react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  emptyCustomFormValues,
  parseCustomFormSchema,
  validateCustomFormValues,
} from "@/lbs/web-forms/customFormSchema";
import {
  publicFormContentClassName,
  usePublicFormEmbed,
} from "@/lbs/web-forms/PublicFormEmbedProvider";

export const PublicCustomForm = ({ slug }: { slug: string }) => {
  const { embedded } = usePublicFormEmbed();
  const [searchParams] = useSearchParams();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const companyId = searchParams.get("company_id");
  const contactId = searchParams.get("contact_id");
  const dealId = searchParams.get("deal_id");

  const canLoad =
    "getPublicForm" in dataProvider &&
    typeof (dataProvider as CrmDataProvider & { getPublicForm?: unknown })
      .getPublicForm === "function";

  const canSubmit =
    "submitPublicForm" in dataProvider &&
    typeof dataProvider.submitPublicForm === "function";

  const {
    data: form,
    isPending,
    error,
  } = useQuery({
    queryKey: ["public-form", slug],
    enabled: Boolean(slug && canLoad),
    staleTime: 60_000,
    queryFn: () =>
      (
        dataProvider as CrmDataProvider & {
          getPublicForm: (payload: { slug: string }) => Promise<{
            name: string;
            description?: string | null;
            slug: string;
            schema?: Record<string, unknown>;
          }>;
        }
      ).getPublicForm({ slug }),
  });

  const schema = useMemo(
    () => parseCustomFormSchema(form?.schema),
    [form?.schema],
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resolvedValues = useMemo(() => {
    if (Object.keys(values).length > 0) return values;
    return emptyCustomFormValues(schema);
  }, [schema, values]);

  const { mutate, isPending: isSubmitting } = useMutation({
    mutationFn: () =>
      (
        dataProvider as CrmDataProvider & {
          submitPublicForm: (payload: {
            slug: string;
            companyId?: string | null;
            contactId?: string | null;
            dealId?: string | null;
            data: Record<string, string>;
          }) => Promise<unknown>;
        }
      ).submitPublicForm({
        slug,
        companyId,
        contactId,
        dealId,
        data: resolvedValues,
      }),
    onSuccess: () => {
      setSubmitted(true);
      notify("Form submitted. Thank you!", { type: "info" });
    },
    onError: (submitError: Error) => {
      notify(submitError.message || "Failed to submit form", { type: "error" });
    },
  });

  if (isPending) {
    return (
      <div
        className={`${publicFormContentClassName(embedded)} flex items-center justify-center gap-2 text-sm text-muted-foreground`}
      >
        <Loader2 className="size-4 animate-spin" />
        Loading form…
      </div>
    );
  }

  if (error || !form) {
    return (
      <div
        className={`${publicFormContentClassName(embedded)} text-center text-sm text-muted-foreground`}
      >
        This form is not available.
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={`${publicFormContentClassName(embedded)} text-center`}>
        <h1 className="text-2xl font-semibold">Thank you</h1>
        <p className="text-sm text-muted-foreground">
          We received your response. Our team will review it and follow up if
          needed.
        </p>
      </div>
    );
  }

  const setField = (key: string, next: string) =>
    setValues((current) => ({
      ...emptyCustomFormValues(schema),
      ...current,
      [key]: next,
    }));

  return (
    <div className={publicFormContentClassName(embedded)}>
      <div>
        <h1 className="text-2xl font-semibold">{form.name}</h1>
        {form.description ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {form.description}
          </p>
        ) : null}
      </div>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            notify("Form submission is not available in this environment", {
              type: "error",
            });
            return;
          }

          const nextValidationError = validateCustomFormValues(
            schema,
            resolvedValues,
          );
          if (nextValidationError) {
            setValidationError(nextValidationError);
            return;
          }

          setValidationError(null);
          mutate();
        }}
      >
        {schema.fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required ? " *" : ""}
            </Label>
            {field.multiline ? (
              <Textarea
                id={field.key}
                value={resolvedValues[field.key] ?? ""}
                onChange={(event) => setField(field.key, event.target.value)}
                placeholder={field.placeholder}
                rows={4}
              />
            ) : (
              <Input
                id={field.key}
                value={resolvedValues[field.key] ?? ""}
                onChange={(event) => setField(field.key, event.target.value)}
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}

        {validationError ? (
          <p className="text-sm text-destructive">{validationError}</p>
        ) : null}

        <Button type="submit" disabled={isSubmitting || !canSubmit}>
          {isSubmitting ? "Submitting…" : "Submit"}
        </Button>
      </form>
    </div>
  );
};
