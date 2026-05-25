import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "@/lbs/deals/websiteBriefSchema";
import { mergeDealIntoIntakeValues } from "@/lbs/deals/projectBriefProgress";
import {
  buildFormulaAnswers,
  evaluateFormula,
  formatFormulaValue,
} from "@/lib/forms-v2/formulaEvaluator";
import {
  formProgressStorageKey,
  getVisibleFields,
  getVisibleFormulaFields,
  getVisibleSections,
  resolveWizardEnabled,
  validateSectionFields,
} from "@/lbs/forms-v2/formSchemaUtils";
import { FormFieldRenderer } from "@/lbs/forms-v2/public/FormFieldRenderer";
import { FormBrandingShell } from "@/lbs/forms-v2/public/FormBrandingShell";
import {
  recaptchaConfigured,
  useRecaptchaToken,
} from "@/lbs/forms-v2/public/useRecaptcha";
import type { FormSectionDef, PublicFormPayload } from "@/lbs/forms-v2/types";
import {
  PublicFormEmbedProvider,
  publicFormContentClassName,
  usePublicFormEmbed,
} from "@/lbs/web-forms/PublicFormEmbedProvider";

const PreviewBanner = ({ isPreview }: { isPreview?: boolean }) =>
  isPreview ? (
    <div
      role="status"
      className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100"
    >
      Preview mode — submissions won&apos;t be saved.
    </div>
  ) : null;

const renderFormSection = ({
  section,
  answers,
  fieldErrors,
  formId,
  formulaAnswers,
  onChange,
}: {
  section: FormSectionDef;
  answers: Record<string, unknown>;
  fieldErrors: Record<string, string>;
  formId: number;
  formulaAnswers: Record<string, unknown>;
  onChange: (key: string, next: unknown) => void;
}) => (
  <section className="space-y-4 rounded-lg border p-4">
    {section.title ? (
      <h2 className="text-base font-semibold">{section.title}</h2>
    ) : null}
    {section.description ? (
      <p className="text-sm text-muted-foreground">{section.description}</p>
    ) : null}
    {getVisibleFields(section, answers).map((field) => (
      <div key={field.key} className="space-y-1">
        <FormFieldRenderer
          field={field}
          value={answers[field.key]}
          formId={formId}
          onChange={(next) => onChange(field.key, next)}
        />
        {fieldErrors[field.key] ? (
          <p className="text-xs text-destructive">{fieldErrors[field.key]}</p>
        ) : null}
      </div>
    ))}
    {getVisibleFormulaFields(section, answers).map((field) => {
      const computed = evaluateFormula(field.formula, formulaAnswers);
      return (
        <FormFieldRenderer
          key={field.key}
          field={field}
          value={formatFormulaValue(computed, field.format)}
          formId={formId}
          disabled
          onChange={() => undefined}
        />
      );
    })}
  </section>
);

const ProjectBriefPublicForm = ({
  payload,
  onSubmitted,
}: {
  payload: PublicFormPayload;
  onSubmitted: (result: {
    thank_you_title?: string;
    thank_you_message?: string;
    redirect_url?: string | null;
    preview?: boolean;
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
    <FormBrandingShell
      primaryColor={payload.form.primary_color}
      backgroundImageUrl={payload.form.background_image_url}
      customFontUrl={payload.form.custom_font_url}
      customCss={payload.form.custom_css}
      embedded={embedded}
      className={publicFormContentClassName(embedded)}
    >
      {payload.form.logo_url ? (
        <img
          src={payload.form.logo_url}
          alt=""
          className="mb-4 h-10 w-auto object-contain"
        />
      ) : null}
      <PreviewBanner isPreview={payload.is_preview} />
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
    </FormBrandingShell>
  );
};

export const PublicFormRenderer = () => (
  <PublicFormEmbedProvider>
    <PublicFormRendererContent />
  </PublicFormEmbedProvider>
);

const PublicFormRendererContent = () => {
  const { slug: token = "" } = useParams();
  const [searchParams] = useSearchParams();
  const notify = useNotify();
  const { embedded } = usePublicFormEmbed();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const getRecaptchaToken = useRecaptchaToken(true);

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [honeypot, setHoneypot] = useState("");
  const [step, setStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedProgress, setSavedProgress] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [progressDismissed, setProgressDismissed] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const [submitted, setSubmitted] = useState<{
    thank_you_title?: string;
    thank_you_message?: string;
    redirect_url?: string | null;
    preview?: boolean;
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

  useEffect(() => {
    const urlPrefill: Record<string, string> = {};
    const source = searchParams.get("source");
    if (source) urlPrefill.source = source;
    if (Object.keys(urlPrefill).length === 0) return;
    setAnswers((current) => ({ ...urlPrefill, ...current }));
  }, [searchParams]);

  useEffect(() => {
    if (!token || formPayload?.is_preview) return;
    try {
      const raw = localStorage.getItem(formProgressStorageKey(token));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        setSavedProgress(parsed);
      }
    } catch {
      // ignore invalid saved progress
    }
  }, [token, formPayload?.is_preview]);

  useEffect(() => {
    if (!token || formPayload?.is_preview || submitted) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          formProgressStorageKey(token),
          JSON.stringify(answers),
        );
      } catch {
        // ignore quota errors
      }
    }, 1000);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [answers, token, formPayload?.is_preview, submitted]);

  const sections = useMemo(
    () => getVisibleSections(formPayload?.form.schema, answers),
    [formPayload?.form.schema, answers],
  );
  const isWizard = resolveWizardEnabled(formPayload?.form.schema);
  const currentSection = isWizard ? sections[step] : sections[0];
  const formulaAnswers = useMemo(
    () => buildFormulaAnswers(formPayload?.form.schema, answers),
    [formPayload?.form.schema, answers],
  );

  const setAnswer = useCallback((key: string, next: unknown) => {
    setAnswers((current) => ({ ...current, [key]: next }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
  }, []);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!formPayload) throw new Error("Form not loaded");
      const recaptchaToken = await getRecaptchaToken();
      const payloadAnswers = buildFormulaAnswers(
        formPayload.form.schema,
        answers,
      );
      return dataProvider.submitFormV2({
        token: formPayload.token,
        answers: payloadAnswers,
        recaptchaToken:
          formPayload.form.recaptcha_enabled && recaptchaConfigured
            ? recaptchaToken
            : undefined,
        honeypot,
      });
    },
    onSuccess: (result) => {
      try {
        localStorage.removeItem(formProgressStorageKey(token));
      } catch {
        // ignore
      }
      setSubmitted({
        ...result,
        preview: Boolean((result as { preview?: boolean }).preview),
      });
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
          {submitted.preview ? <PreviewBanner isPreview /> : null}
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
        {submitted.preview ? <PreviewBanner isPreview /> : null}
        <h1 className="text-2xl font-semibold">
          {submitted.thank_you_title || "Thank you"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {submitted.thank_you_message || "Your submission has been received."}
        </p>
      </div>
    );
  }

  const validateCurrentStep = () => {
    if (!currentSection) return true;
    const nextErrors = validateSectionFields(currentSection, answers);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      notify(Object.values(nextErrors).join(", "), { type: "warning" });
      return false;
    }
    return true;
  };

  const validateAllSections = () => {
    const nextErrors: Record<string, string> = {};
    for (const section of sections) {
      Object.assign(nextErrors, validateSectionFields(section, answers));
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      notify(Object.values(nextErrors).join(", "), { type: "warning" });
      return false;
    }
    return true;
  };

  return (
    <FormBrandingShell
      primaryColor={formPayload.form.primary_color}
      backgroundImageUrl={formPayload.form.background_image_url}
      customFontUrl={formPayload.form.custom_font_url}
      customCss={formPayload.form.custom_css}
      embedded={embedded}
      className={publicFormContentClassName(embedded)}
    >
      {formPayload.form.logo_url ? (
        <img
          src={formPayload.form.logo_url}
          alt=""
          className="mb-4 h-10 w-auto object-contain"
        />
      ) : null}

      <PreviewBanner isPreview={formPayload.is_preview} />

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

      {!progressDismissed && savedProgress ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Continue where you left off?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            We saved your previous answers in this browser.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setAnswers((current) => ({ ...savedProgress, ...current }));
                setProgressDismissed(true);
              }}
            >
              Continue
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  localStorage.removeItem(formProgressStorageKey(token));
                } catch {
                  // ignore
                }
                setSavedProgress(null);
                setProgressDismissed(true);
              }}
            >
              Start over
            </Button>
          </div>
        </div>
      ) : null}

      {isWizard ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Step {Math.min(step + 1, sections.length || 1)} of{" "}
              {sections.length || 1}
              {currentSection?.title ? `: ${currentSection.title}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                disabled={index > step}
                className={
                  index === step
                    ? "font-medium text-foreground"
                    : index < step
                      ? "text-foreground underline-offset-2 hover:underline"
                      : "cursor-not-allowed opacity-60"
                }
                onClick={() => {
                  if (index <= step) setStep(index);
                }}
              >
                {index < step ? "✓ " : index === step ? "● " : "○ "}
                {section.title || `Step ${index + 1}`}
              </button>
            ))}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${
                  sections.length > 0
                    ? ((step + 1) / sections.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (isWizard && step < sections.length - 1) {
            if (!validateCurrentStep()) return;
            setStep((current) => current + 1);
            setFieldErrors({});
            return;
          }
          if (!validateAllSections()) return;
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

        {isWizard && currentSection
          ? renderFormSection({
              section: currentSection,
              answers,
              fieldErrors,
              formId: formPayload.form.id,
              formulaAnswers,
              onChange: setAnswer,
            })
          : null}

        {!isWizard
          ? sections.map((section) => (
              <div key={section.id}>
                {renderFormSection({
                  section,
                  answers,
                  fieldErrors,
                  formId: formPayload.form.id,
                  formulaAnswers,
                  onChange: setAnswer,
                })}
              </div>
            ))
          : null}

        <div className="flex justify-between gap-2">
          {isWizard && step > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep((current) => current - 1);
                setFieldErrors({});
              }}
            >
              Previous
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Submitting…"
              : isWizard && step < sections.length - 1
                ? "Next"
                : "Submit"}
          </Button>
        </div>
      </form>
    </FormBrandingShell>
  );
};
