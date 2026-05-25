import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
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
} from "@/lbs/deals/websiteBriefSchema";
import { mergeDealIntoIntakeValues } from "@/lbs/deals/projectBriefProgress";
import {
  getVisibleFields,
  getVisibleSections,
  validateSection,
} from "@/lbs/forms-v2/formSchemaUtils";
import { FormFieldRenderer } from "@/lbs/forms-v2/public/FormFieldRenderer";
import {
  recaptchaConfigured,
  useRecaptchaToken,
} from "@/lbs/forms-v2/public/useRecaptcha";
import type { PublicFormPayload } from "@/lbs/forms-v2/types";
import {
  PublicFormEmbedProvider,
  publicFormContentClassName,
  usePublicFormEmbed,
} from "@/lbs/web-forms/PublicFormEmbedProvider";

const ProjectBriefPublicForm = ({
  payload,
  onSubmitted,
}: {
  payload: PublicFormPayload;
  onSubmitted: (result: {
    thank_you_title?: string;
    thank_you_message?: string;
    redirect_url?: string | null;
  }) => void;
}) => {
  const notify = useNotify();
  const { embedded } = usePublicFormEmbed();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const getRecaptchaToken = useRecaptchaToken(
    Boolean(payload.form.recaptcha_enabled && recaptchaConfigured),
  );

  const initialValues = useMemo(() => {
    const merged = mergeDealIntoIntakeValues(
      {
        project_type: String(payload.prefill?.project_type ?? ""),
        website_brief: payload.prefill as Record<string, string | null>,
      },
      emptyWebsiteIntakeValues,
    );
    return { ...merged, ...(payload.prefill as Record<string, string>) };
  }, [payload.prefill]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [honeypot, setHoneypot] = useState("");

  const projectType = values.project_type || "new-website";
  const sections = useMemo(
    () => getVisibleBriefSections(projectType),
    [projectType],
  );

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const recaptchaToken = await getRecaptchaToken();
      return dataProvider.submitFormV2({
        token: payload.token,
        answers: values,
        recaptchaToken,
        honeypot,
      });
    },
    onSuccess: (result) => {
      onSubmitted(result);
      notify("Form submitted. Thank you!", { type: "info" });
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to submit form", { type: "error" });
    },
  });

  const setField = (key: string, next: string) =>
    setValues((current) => ({ ...current, [key]: next }));

  return (
    <div
      className={publicFormContentClassName(embedded)}
      style={
        payload.form.primary_color
          ? { ["--form-primary-color" as string]: payload.form.primary_color }
          : undefined
      }
    >
      {payload.form.logo_url ? (
        <img
          src={payload.form.logo_url}
          alt=""
          className="mb-4 h-10 w-auto object-contain"
        />
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold">
          {payload.form.welcome_title || payload.form.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {payload.form.welcome_message ||
            "Answer what you can — fields change based on your project type."}
        </p>
      </div>

      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          mutate();
        }}
      >
        {payload.form.honeypot_enabled ? (
          <input
            type="text"
            name="company_website_confirm"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
          />
        ) : null}

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

        <Button type="submit" disabled={isPending}>
          {isPending ? "Submitting…" : "Submit project details"}
        </Button>
      </form>
    </div>
  );
};

export const PublicFormRenderer = () => (
  <PublicFormEmbedProvider>
    <PublicFormRendererContent />
  </PublicFormEmbedProvider>
);

const PublicFormRendererContent = () => {
  const { slug: token = "" } = useParams();
  const notify = useNotify();
  const { embedded } = usePublicFormEmbed();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const getRecaptchaToken = useRecaptchaToken(true);

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [honeypot, setHoneypot] = useState("");
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState<{
    thank_you_title?: string;
    thank_you_message?: string;
    redirect_url?: string | null;
  } | null>(null);

  const {
    data: payload,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["public-form-v2", token],
    enabled: Boolean(token),
    staleTime: 60_000,
    queryFn: () => dataProvider.getFormByToken({ token }),
  });

  const formPayload = payload as PublicFormPayload | undefined;

  useEffect(() => {
    if (!formPayload?.prefill) return;
    setAnswers((current) => ({ ...formPayload.prefill, ...current }));
  }, [formPayload?.prefill]);

  const sections = useMemo(
    () => getVisibleSections(formPayload?.form.schema, answers),
    [formPayload?.form.schema, answers],
  );
  const currentSection = sections[step];
  const isMultiStep = sections.length > 1;

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!formPayload) throw new Error("Form not loaded");
      const recaptchaToken = await getRecaptchaToken();
      return dataProvider.submitFormV2({
        token: formPayload.token,
        answers,
        recaptchaToken:
          formPayload.form.recaptcha_enabled && recaptchaConfigured
            ? recaptchaToken
            : undefined,
        honeypot,
      });
    },
    onSuccess: (result) => {
      setSubmitted(result);
      if (result.redirect_url) {
        window.setTimeout(() => {
          window.location.href = result.redirect_url!;
        }, 1500);
      }
    },
    onError: (submitError: Error) => {
      notify(submitError.message || "Failed to submit form", { type: "error" });
    },
  });

  if (isLoading) {
    return (
      <div className={publicFormContentClassName(embedded)}>
        <p className="text-sm text-muted-foreground">Loading form…</p>
      </div>
    );
  }

  if (error || !formPayload) {
    return (
      <div className={publicFormContentClassName(embedded)}>
        <h1 className="text-xl font-semibold">Form unavailable</h1>
        <p className="text-sm text-muted-foreground">
          This link is invalid or has expired.
        </p>
      </div>
    );
  }

  if (formPayload.form.type === "project_brief") {
    if (submitted) {
      return (
        <div className={publicFormContentClassName(embedded) + " text-center"}>
          <h1 className="text-2xl font-semibold">
            {submitted.thank_you_title || "Thank you"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {submitted.thank_you_message || "We received your project details."}
          </p>
        </div>
      );
    }

    return (
      <ProjectBriefPublicForm
        payload={formPayload}
        onSubmitted={(result) => setSubmitted(result)}
      />
    );
  }

  if (submitted) {
    return (
      <div className={publicFormContentClassName(embedded) + " text-center"}>
        <h1 className="text-2xl font-semibold">
          {submitted.thank_you_title || "Thank you"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {submitted.thank_you_message || "Your submission has been received."}
        </p>
      </div>
    );
  }

  const sectionErrors = currentSection
    ? validateSection(currentSection, answers)
    : [];

  return (
    <div
      className={publicFormContentClassName(embedded)}
      style={
        formPayload.form.primary_color
          ? {
              ["--form-primary-color" as string]:
                formPayload.form.primary_color,
            }
          : undefined
      }
    >
      {formPayload.form.logo_url ? (
        <img
          src={formPayload.form.logo_url}
          alt=""
          className="mb-4 h-10 w-auto object-contain"
        />
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold">
          {formPayload.form.welcome_title || formPayload.form.name}
        </h1>
        {formPayload.form.welcome_message ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {formPayload.form.welcome_message}
          </p>
        ) : null}
      </div>

      {isMultiStep ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {sections.map((section, index) => (
              <span
                key={section.id}
                className={
                  index === step ? "font-medium text-foreground" : undefined
                }
              >
                {index < step ? "✓ " : index === step ? "● " : "○ "}
                {section.title || `Step ${index + 1}`}
              </span>
            ))}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${((step + 1) / sections.length) * 100}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (isMultiStep && step < sections.length - 1) {
            if (sectionErrors.length > 0) {
              notify(sectionErrors.join(", "), { type: "warning" });
              return;
            }
            setStep((current) => current + 1);
            return;
          }
          mutate();
        }}
      >
        {formPayload.form.honeypot_enabled ? (
          <input
            type="text"
            name="company_website_confirm"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
          />
        ) : null}

        {currentSection ? (
          <section className="space-y-4 rounded-lg border p-4">
            {currentSection.title ? (
              <h2 className="text-base font-semibold">
                {currentSection.title}
              </h2>
            ) : null}
            {getVisibleFields(currentSection, answers).map((field) => (
              <FormFieldRenderer
                key={field.key}
                field={field}
                value={answers[field.key]}
                onChange={(next) =>
                  setAnswers((current) => ({ ...current, [field.key]: next }))
                }
              />
            ))}
          </section>
        ) : null}

        <div className="flex justify-between gap-2">
          {isMultiStep && step > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((current) => current - 1)}
            >
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Submitting…"
              : isMultiStep && step < sections.length - 1
                ? "Next"
                : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
};
