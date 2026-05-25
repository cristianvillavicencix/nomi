// DEPRECATED - use forms-v2 instead
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { useDataProvider, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  emptyWebsiteIntakeValues,
  getVisibleBriefSections,
  lbsProjectTypeChoices,
  WEBSITE_INTAKE_SLUG,
} from "@/lbs/deals/websiteBriefSchema";
import { PROJECT_RESOURCES_SLUG } from "@/lbs/deals/projectResourceConstants";
import { mergeDealIntoIntakeValues } from "@/lbs/deals/projectBriefProgress";
import { PublicCustomForm } from "@/lbs/web-forms/PublicCustomForm";
import {
  PublicFormEmbedProvider,
  publicFormContentClassName,
  usePublicFormEmbed,
} from "@/lbs/web-forms/PublicFormEmbedProvider";
import { PublicProjectResourcesForm } from "@/lbs/web-forms/PublicProjectResourcesForm";

export const PublicFormPage = () => (
  <PublicFormEmbedProvider>
    <PublicFormPageContent />
  </PublicFormEmbedProvider>
);

const PublicFormPageContent = () => {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { embedded } = usePublicFormEmbed();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const companyId = searchParams.get("company_id");
  const contactId = searchParams.get("contact_id");
  const dealId = searchParams.get("deal_id");

  const [values, setValues] = useState(emptyWebsiteIntakeValues);
  const [submitted, setSubmitted] = useState(false);

  const canLoadBrief =
    dealId &&
    companyId &&
    contactId &&
    "getPublicDealBrief" in dataProvider &&
    typeof (dataProvider as CrmDataProvider & { getPublicDealBrief?: unknown })
      .getPublicDealBrief === "function";

  useQuery({
    queryKey: ["public-deal-brief", dealId, companyId, contactId],
    enabled: Boolean(canLoadBrief),
    staleTime: 60_000,
    queryFn: async () => {
      const brief = await (
        dataProvider as CrmDataProvider & {
          getPublicDealBrief: (payload: {
            dealId: string;
            companyId: string;
            contactId: string;
          }) => Promise<{
            project_type?: string | null;
            website_brief?: Record<string, string | null>;
          }>;
        }
      ).getPublicDealBrief({
        dealId: dealId!,
        companyId: companyId!,
        contactId: contactId!,
      });
      setValues((current) => mergeDealIntoIntakeValues(brief, current));
      return brief;
    },
  });

  const projectType = values.project_type || "new-website";
  const sections = useMemo(
    () => getVisibleBriefSections(projectType),
    [projectType],
  );

  const canSubmit =
    "submitPublicForm" in dataProvider &&
    typeof dataProvider.submitPublicForm === "function";

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      (
        dataProvider as CrmDataProvider & {
          submitPublicForm: (payload: {
            slug: string;
            companyId?: string | null;
            contactId?: string | null;
            dealId?: string | null;
            data: Record<string, string>;
          }) => Promise<{ deal_id?: number }>;
        }
      ).submitPublicForm({
        slug,
        companyId,
        contactId,
        dealId,
        data: values,
      }),
    onSuccess: () => {
      setSubmitted(true);
      notify("Form submitted. Thank you!", { type: "info" });
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to submit form", { type: "error" });
    },
  });

  const title = useMemo(() => {
    if (slug === WEBSITE_INTAKE_SLUG) return "Website & marketing intake";
    return slug ? `Form: ${slug}` : "Project intake form";
  }, [slug]);

  if (slug === PROJECT_RESOURCES_SLUG) {
    return <PublicProjectResourcesForm />;
  }

  if (slug !== WEBSITE_INTAKE_SLUG) {
    return <PublicCustomForm slug={slug} />;
  }

  if (submitted) {
    return (
      <div className={publicFormContentClassName(embedded) + " text-center"}>
        <h1 className="text-2xl font-semibold">Thank you</h1>
        <p className="text-sm text-muted-foreground">
          We received your project details. Our team will review them and follow
          up soon.
        </p>
      </div>
    );
  }

  const setField = (key: string, next: string) =>
    setValues((current) => ({ ...current, [key]: next }));

  return (
    <div className={publicFormContentClassName(embedded)}>
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Answer what you can — fields change based on your project type. Leave
          blanks if you are not sure yet.
          {dealId
            ? " We loaded any details already on file for this project."
            : ""}
        </p>
      </div>

      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            notify("Form submission is not available in this environment", {
              type: "error",
            });
            return;
          }
          mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="project_type">Project type</Label>
          <Select
            value={projectType}
            onValueChange={(next) => setField("project_type", next)}
          >
            <SelectTrigger id="project_type">
              <SelectValue placeholder="Select project type" />
            </SelectTrigger>
            <SelectContent>
              {lbsProjectTypeChoices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {sections.map((section) => (
          <section key={section.id} className="space-y-4 rounded-lg border p-4">
            <div>
              <h2 className="text-base font-semibold">{section.title}</h2>
              {section.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {section.description}
                </p>
              ) : null}
            </div>
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                {field.multiline ? (
                  <Textarea
                    id={field.key}
                    value={values[field.key] ?? ""}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                    placeholder={field.placeholder}
                    rows={field.rows ?? 3}
                  />
                ) : (
                  <Input
                    id={field.key}
                    value={values[field.key] ?? ""}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}
          </section>
        ))}

        {!embedded ? (
          <p className="text-sm text-muted-foreground">
            After we start your project, you can upload logos and photos through
            a separate file upload link from our team.
          </p>
        ) : null}

        <Button type="submit" disabled={isPending || !canSubmit}>
          {isPending ? "Submitting…" : "Submit project details"}
        </Button>
      </form>
    </div>
  );
};
