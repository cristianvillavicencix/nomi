import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { useDataProvider, useNotify } from "ra-core";
import { ArrowRight, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  emptyWebsiteIntakeValues,
  getVisibleBriefSections,
  type WebsiteBriefFieldDef,
  type WebsiteBriefSectionDef,
} from "@/modules/deals/websiteBriefSchema";
import { usesContractorBriefForm } from "@/modules/deals/contractorBriefSchema";
import {
  filterBriefSections,
  parseBriefSectionsParam,
} from "@/modules/deals/projectBriefRequestScope";
import { ContractorBriefSectionFields } from "@/modules/deals/ContractorBriefFields";
import {
  computeYearsExperience,
  sanitizeBriefAnswersForSubmit,
} from "@/modules/deals/briefFormUtils";
import { mergeDealIntoIntakeValues } from "@/modules/deals/projectBriefProgress";
import {
  buildFormulaAnswers,
  formatFormulaValue,
} from "@/lib/forms-v2/formulaEvaluator";
import {
  formProgressStorageKey,
  getVisibleFields,
  getVisibleFormulaFields,
  getVisibleSections,
  resolveWizardEnabled,
  validateSectionFields,
} from "@/modules/forms/formSchemaUtils";
import { FormFieldRenderer } from "@/modules/forms/public/FormFieldRenderer";
import { FormBrandingShell } from "@/modules/forms/public/FormBrandingShell";
import {
  PublicFormAgencyHeader,
  resolvePublicFormAgency,
} from "@/modules/forms/public/PublicFormAgencyHeader";
import {
  recaptchaConfigured,
  useRecaptchaToken,
} from "@/modules/forms/public/useRecaptcha";
import type {
  FormFieldDef,
  FormSectionDef,
  PublicFormPayload,
} from "@/modules/forms/types";
import { useFormEventRecorder } from "@/modules/forms/public/useFormEventRecorder";
import {
  publicFormContentClassName,
  usePublicFormEmbed,
} from "@/modules/forms/public/PublicFormEmbedProvider";
import { expandWizardSteps, readStringList } from "@/modules/forms/wizardStepUtils";
import { applyProjectResourcesUploadLimits } from "@/modules/deals/applyProjectResourcesUploadLimits";
import {
  filterProjectResourcesSchema,
  buildPresetServicesAnswers,
  readRequestScopeFromLocation,
  type ResourceRequestSection,
} from "@/modules/deals/projectResourceRequestScope";
import {
  DynamicFileGroupsField,
  WizardSummaryStep,
} from "@/modules/forms/public/fields/DynamicFileGroupsField";
import { BeforeAfterPhotosField } from "@/modules/forms/public/fields/BeforeAfterPhotosField";
import {
  ProjectResourcesPreflightStep,
  type ProjectLinkMode,
} from "@/modules/forms/public/ProjectResourcesPreflightStep";
import {
  ProjectBriefThankYou,
  PROJECT_BRIEF_THANK_YOU_REDIRECT,
} from "@/modules/forms/public/ProjectBriefThankYou";

const DEFAULT_BRIEF_WELCOME_TITLE = "Thank you for your trust";

const buildBriefWelcomeMessage = (agencyName: string) =>
  agencyName
    ? `Thanks for choosing ${agencyName}. We’re excited to build your website with you. This short brief helps us get the details right — many answers are already filled in, and it only takes a few minutes.`
    : "Thanks for trusting us with your website. This short brief helps us get the details right — many answers are already filled in, and it only takes a few minutes.";

const PreviewBanner = ({ isPreview }: { isPreview?: boolean }) =>
  isPreview ? (
    <div
      role="status"
      className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100"
    >
      Preview mode — submissions won&apos;t be saved.
    </div>
  ) : null;

const getBeforeAfterField = (section?: FormSectionDef) =>
  section?.fields?.find((field) => field.type === "before_after_photos");

const renderFormSection = ({
  section,
  answers,
  fieldErrors,
  formId,
  token,
  formulaAnswers,
  onChange,
  framed = true,
}: {
  section: FormSectionDef;
  answers: Record<string, unknown>;
  fieldErrors: Record<string, string>;
  formId: number;
  token?: string;
  formulaAnswers: Record<string, unknown>;
  onChange: (key: string, next: unknown) => void;
  framed?: boolean;
}) => (
  <section
    className={
      framed
        ? "space-y-4 rounded-xl border bg-muted/10 p-4 sm:p-6"
        : "space-y-4"
    }
  >
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
          token={token}
          onChange={(next) => onChange(field.key, next)}
        />
        {fieldErrors[field.key] ? (
          <p className="text-xs text-destructive">{fieldErrors[field.key]}</p>
        ) : null}
      </div>
    ))}
    {getVisibleFormulaFields(section, answers).map((field) => {
      const raw = formulaAnswers[field.key];
      const computed =
        typeof raw === "number" && Number.isFinite(raw) ? raw : null;
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

const toBriefFormField = (field: WebsiteBriefFieldDef): FormFieldDef => ({
  key: field.key,
  type: field.fieldType ?? (field.multiline ? "textarea" : "text"),
  label: field.label,
  required: field.required,
  placeholder: field.placeholder,
  help_text:
    typeof field.helperText === "string" ? field.helperText : undefined,
  options: field.options,
  accept: field.accept,
  max_files: field.maxFiles,
  visible_when: field.visibleWhen,
});

const briefSectionToFormSection = (
  section: WebsiteBriefSectionDef,
): FormSectionDef => ({
  id: section.id,
  title: section.title,
  description: section.description,
  fields: section.fields.map(toBriefFormField),
});

export const ProjectBriefPublicForm = ({
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
  const [searchParams] = useSearchParams();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const getRecaptchaToken = useRecaptchaToken(
    Boolean(payload.form.recaptcha_enabled && recaptchaConfigured),
  );

  const initialValues = useMemo(() => {
    const merged = mergeDealIntoIntakeValues(
      {
        project_type: String(payload.prefill?.project_type ?? "website"),
        website_brief: payload.prefill as Record<string, string | null>,
      },
      emptyWebsiteIntakeValues(),
    );
    return { ...merged, ...payload.prefill } as Record<string, unknown>;
  }, [payload.prefill]);

  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [honeypot, setHoneypot] = useState("");
  const [step, setStep] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const projectType = String(values.project_type ?? "website");
  const isContractorBrief = usesContractorBriefForm(projectType);
  const briefSectionScope = useMemo(() => {
    const fromToken = payload.request_scope?.sections;
    if (Array.isArray(fromToken) && fromToken.length > 0) {
      return fromToken.map((entry) => String(entry).trim()).filter(Boolean);
    }
    return parseBriefSectionsParam(searchParams.get("sections"));
  }, [payload.request_scope?.sections, searchParams]);
  const sections = useMemo(
    () =>
      filterBriefSections(
        getVisibleBriefSections(projectType),
        briefSectionScope,
      ),
    [briefSectionScope, projectType],
  );
  const currentSection = sections[step];

  useEffect(() => {
    setStep(0);
    setShowWelcome(true);
  }, [briefSectionScope]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (payload.is_preview) {
        return {
          thank_you_title: "Preview only",
          thank_you_message: "Nothing was saved. This is a staff preview.",
          preview: true as const,
          redirect_url: null as string | null,
        };
      }
      const recaptchaToken = await getRecaptchaToken();
      const answers = isContractorBrief
        ? sanitizeBriefAnswersForSubmit(values)
        : values;
      return dataProvider.submitFormV2({
        token: payload.token,
        answers,
        recaptchaToken,
        honeypot,
        metadata: {
          source_url: window.location.href,
          brief_sections: briefSectionScope ?? undefined,
        },
      });
    },
    onSuccess: (result) => {
      if (payload.is_preview || result.preview) {
        onSubmitted({
          ...result,
          preview: true,
          redirect_url: null,
        });
        notify("Preview only — nothing was saved", { type: "info" });
        return;
      }
      onSubmitted({
        ...result,
        redirect_url: result.redirect_url ?? PROJECT_BRIEF_THANK_YOU_REDIRECT,
      });
      notify("Brief submitted. Thank you!", { type: "info" });
    },
    onError: (error: Error) => {
      notify(error.message || "Could not submit the form", {
        type: "error",
      });
    },
  });

  const setField = (key: string, next: unknown) =>
    setValues((current) => {
      const updated = { ...current, [key]: next };
      if (key === "company_founded_year") {
        const years = computeYearsExperience(next);
        if (years != null) updated.years_experience = years;
      }
      return updated;
    });

  const validateCurrentSection = () => {
    if (!currentSection) return true;
    const nextErrors = validateSectionFields(
      briefSectionToFormSection(currentSection),
      values,
    );
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      notify(
        Object.values(nextErrors)[0] ?? "Please complete the required fields",
        {
          type: "warning",
        },
      );
      return false;
    }
    return true;
  };

  const validateAllSections = () => {
    const nextErrors: Record<string, string> = {};
    for (const section of sections) {
      Object.assign(
        nextErrors,
        validateSectionFields(briefSectionToFormSection(section), values),
      );
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isContractorBrief && step < sections.length - 1) {
      if (!validateCurrentSection()) return;
      setStep((current) => current + 1);
      return;
    }
    if (!validateAllSections()) {
      notify("Review required fields before submitting", {
        type: "warning",
      });
      return;
    }
    mutate();
  };

  const renderSectionFields = (section: WebsiteBriefSectionDef) => {
    const formSection = briefSectionToFormSection(section);
    if (isContractorBrief) {
      return (
        <ContractorBriefSectionFields
          section={section}
          formSection={formSection}
          values={values}
          fieldErrors={fieldErrors}
          formId={payload.form.id}
          token={payload.token}
          setField={setField}
        />
      );
    }
    return getVisibleFields(formSection, values).map((field) => (
      <div key={field.key} className="space-y-1">
        <FormFieldRenderer
          field={field}
          value={values[field.key]}
          formId={payload.form.id}
          token={payload.token}
          onChange={(next) => setField(field.key, next)}
        />
        {fieldErrors[field.key] ? (
          <p className="text-xs text-destructive">{fieldErrors[field.key]}</p>
        ) : null}
      </div>
    ));
  };

  const {
    agencyName,
    agencyPhone,
    agencyEmail,
    agencyAddress,
    agencyWebsite,
    logoUrl,
  } = resolvePublicFormAgency(payload.form);
  const firstName = String(payload.prefill?.contact_first_name ?? "").trim();
  const welcomeTitle =
    String(payload.form.welcome_title ?? "").trim() ||
    DEFAULT_BRIEF_WELCOME_TITLE;
  const welcomeIntro =
    String(payload.form.welcome_message ?? "").trim() ||
    buildBriefWelcomeMessage(agencyName);

  if (showWelcome) {
    return (
      <FormBrandingShell
        primaryColor={payload.form.primary_color}
        backgroundImageUrl={payload.form.background_image_url}
        customFontUrl={payload.form.custom_font_url}
        customCss={payload.form.custom_css}
        embedded={embedded}
        className={publicFormContentClassName(embedded)}
      >
        <div className="flex flex-col items-center gap-6 py-4 text-center">
          <div className="flex w-full flex-col items-center gap-3">
            <img
              src={logoUrl}
              alt={agencyName}
              className="mx-auto h-16 w-auto max-w-[240px] object-contain"
            />
            <PublicFormAgencyHeader
              company={agencyName}
              phone={agencyPhone}
              email={agencyEmail}
              address={agencyAddress}
              website={agencyWebsite}
            />
            <PreviewBanner isPreview={payload.is_preview} />
          </div>

          <div className="flex w-full flex-col items-center gap-4">
            {firstName ? (
              <p className="text-base text-muted-foreground">
                Hi {firstName},
              </p>
            ) : null}
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Handshake className="size-7" aria-hidden />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {welcomeTitle}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {welcomeIntro}
              </p>
            </div>
          </div>

          <div className="flex w-full justify-center pt-2">
            <Button
              type="button"
              className="min-h-11 gap-2"
              onClick={() => setShowWelcome(false)}
            >
              Let’s get started
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </FormBrandingShell>
    );
  }

  return (
    <FormBrandingShell
      primaryColor={payload.form.primary_color}
      backgroundImageUrl={payload.form.background_image_url}
      customFontUrl={payload.form.custom_font_url}
      customCss={payload.form.custom_css}
      embedded={embedded}
      className={publicFormContentClassName(embedded)}
    >
      <header className="space-y-3">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left">
          <img
            src={logoUrl}
            alt={agencyName}
            className="h-10 w-auto max-w-[140px] shrink-0 object-contain"
          />
          <PublicFormAgencyHeader
            company={agencyName}
            phone={agencyPhone}
            email={agencyEmail}
            address={agencyAddress}
            website={agencyWebsite}
            compact
          />
        </div>
        <PreviewBanner isPreview={payload.is_preview} />
      </header>

      <form className="space-y-6" onSubmit={handleSubmit}>
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

        {isContractorBrief && sections.length > 1 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Step {step + 1} of {sections.length}
              </span>
              <span>{currentSection?.title}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.round(((step + 1) / sections.length) * 100)}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {isContractorBrief && currentSection ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">
                {currentSection.title}
              </h2>
              {currentSection.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentSection.description}
                </p>
              ) : null}
            </div>
            {renderSectionFields(currentSection)}
          </section>
        ) : sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This link does not include any valid brief sections. Contact your
            project team for a new link.
          </p>
        ) : (
          sections.map((section) => (
            <section key={section.id} className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">{section.title}</h2>
                {section.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {section.description}
                  </p>
                ) : null}
              </div>
              {renderSectionFields(section)}
            </section>
          ))
        )}

        <div
          className={`flex flex-wrap gap-2 ${
            isContractorBrief ? "justify-between" : "justify-end"
          }`}
        >
          {isContractorBrief ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                if (step > 0) {
                  setStep((current) => Math.max(0, current - 1));
                  return;
                }
                setShowWelcome(true);
              }}
            >
              Previous
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={isPending || sections.length === 0}
            className="min-h-11"
          >
            {isPending
              ? "Submitting…"
              : isContractorBrief && step < sections.length - 1
                ? "Next"
                : "Submit brief"}
          </Button>
        </div>
      </form>
    </FormBrandingShell>
  );
};

export const PublicFormRenderer = () => {
  const { slug: token = "" } = useParams();
  const [searchParams] = useSearchParams();
  const notify = useNotify();
  const { embedded } = usePublicFormEmbed();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const getRecaptchaToken = useRecaptchaToken(true);

  const [answers, setAnswers] = useState<Record<string, unknown>>(() =>
    buildPresetServicesAnswers(readRequestScopeFromLocation().presetServices),
  );
  const [honeypot, setHoneypot] = useState("");
  const [step, setStep] = useState(0);
  const [showResourcesWelcome, setShowResourcesWelcome] = useState(true);
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
  const [preflightComplete, setPreflightComplete] = useState(false);
  const [projectLinkMode, setProjectLinkMode] =
    useState<ProjectLinkMode | null>(null);
  const [projectCode, setProjectCode] = useState("");

  const {
    data: payload,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["public-form-v2", token],
    enabled: Boolean(token),
    staleTime: 60_000,
    retry: (failureCount, queryError) => {
      if (queryError instanceof Error && queryError.name === "AbortError") {
        return failureCount < 1;
      }
      return failureCount < 2;
    },
    queryFn: ({ signal }) => dataProvider.getFormByToken({ token, signal }),
  });

  const formPayload = payload as PublicFormPayload | undefined;
  const { trackAnswerChange, markSubmitted } = useFormEventRecorder(token, {
    isPreview: formPayload?.is_preview,
  });

  useEffect(() => {
    if (!formPayload?.prefill && !formPayload?.request_scope) return;
    setAnswers((current) => {
      const prefill = formPayload.prefill ?? {};
      // Prefill first, then keep in-progress answers — but never let an empty
      // draft wipe server-backed uploads (reopen request links).
      const merged: Record<string, unknown> = { ...prefill, ...current };
      for (const key of [
        "logos",
        "team_photos",
        "service_photos",
        "before_after_photos",
      ] as const) {
        const fromPrefill = prefill[key];
        const fromCurrent = current[key];
        if (fromPrefill == null) continue;
        if (fromCurrent == null) {
          merged[key] = fromPrefill;
          continue;
        }
        if (Array.isArray(fromCurrent) && fromCurrent.length === 0) {
          merged[key] = fromPrefill;
        }
      }
      const tokenServices = Array.isArray(
        formPayload.request_scope?.presetServices,
      )
        ? formPayload.request_scope.presetServices
            .map((entry) => String(entry).trim())
            .filter(Boolean)
        : [];
      const urlServices = readRequestScopeFromLocation().presetServices;
      const prefillServices = readStringList(formPayload.prefill?.services);
      const services =
        tokenServices.length > 0
          ? tokenServices
          : urlServices.length > 0
            ? urlServices
            : prefillServices;
      if (services.length > 0) {
        merged.services = services;
      }
      return merged;
    });
  }, [formPayload?.prefill, formPayload?.request_scope]);

  useEffect(() => {
    const urlPrefill: Record<string, string> = {};
    const source = searchParams.get("source");
    if (source) urlPrefill.source = source;
    if (Object.keys(urlPrefill).length === 0) return;
    setAnswers((current) => ({ ...urlPrefill, ...current }));
  }, [searchParams]);

  useEffect(() => {
    if (!token || formPayload?.is_preview) return;
    const { presetServices } = readRequestScopeFromLocation();
    if (presetServices.length > 0) {
      setProgressDismissed(true);
      return;
    }
    const prefillServices = readStringList(formPayload?.prefill?.services);
    if (
      formPayload?.form.slug === "project-resources" &&
      prefillServices.length > 0
    ) {
      setProgressDismissed(true);
      setSavedProgress(null);
      return;
    }
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
  }, [
    formPayload?.form.slug,
    formPayload?.is_preview,
    formPayload?.prefill?.services,
    searchParams,
    token,
  ]);

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

  const requestScope = useMemo(() => {
    const fromUrl = readRequestScopeFromLocation();
    const tokenSections = payload?.request_scope?.sections;
    const tokenPresets = payload?.request_scope?.presetServices;
    if (Array.isArray(tokenSections) && tokenSections.length > 0) {
      return {
        sections: tokenSections.map((entry) =>
          String(entry).trim(),
        ) as ResourceRequestSection[],
        presetServices: Array.isArray(tokenPresets)
          ? tokenPresets.map((entry) => String(entry).trim()).filter(Boolean)
          : fromUrl.presetServices,
      };
    }
    return fromUrl;
  }, [payload?.request_scope, searchParams]);

  const effectivePresetServices = useMemo(() => {
    if (requestScope.presetServices.length > 0) {
      return requestScope.presetServices;
    }
    if (formPayload?.form.slug === "project-resources") {
      return readStringList(formPayload.prefill?.services);
    }
    return [];
  }, [
    formPayload?.form.slug,
    formPayload?.prefill?.services,
    requestScope.presetServices,
  ]);

  const effectiveSchema = useMemo(() => {
    if (formPayload?.form.slug !== "project-resources") {
      return formPayload?.form.schema;
    }
    const limited = applyProjectResourcesUploadLimits(formPayload?.form.schema);
    const filtered =
      filterProjectResourcesSchema(
        limited,
        requestScope.sections,
        effectivePresetServices,
      ) ?? limited;
    // Deal-linked CRM shares already know the client — skip company intro.
    if (formPayload.links?.deal_id && filtered?.sections?.length) {
      return {
        ...filtered,
        sections: filtered.sections.filter(
          (section) => section.id !== "company_info",
        ),
      };
    }
    return filtered;
  }, [
    effectivePresetServices,
    formPayload?.form.schema,
    formPayload?.form.slug,
    formPayload?.links?.deal_id,
    requestScope.sections,
  ]);

  useEffect(() => {
    if (formPayload?.form.slug !== "project-resources") return;
    if (effectivePresetServices.length === 0) return;
    setAnswers((current) => {
      const existing = readStringList(current.services);
      if (existing.length === 0) {
        return { ...current, services: effectivePresetServices };
      }
      const merged = [...existing];
      for (const name of effectivePresetServices) {
        if (
          !merged.some(
            (entry) => entry.toLowerCase() === name.toLowerCase(),
          )
        ) {
          merged.push(name);
        }
      }
      if (
        merged.length === existing.length &&
        merged.every((entry, index) => entry === existing[index])
      ) {
        return current;
      }
      return { ...current, services: merged };
    });
  }, [effectivePresetServices, formPayload?.form.slug]);

  const sections = useMemo(
    () => getVisibleSections(effectiveSchema, answers),
    [answers, effectiveSchema],
  );
  const isWizard = resolveWizardEnabled(effectiveSchema);
  const wizardSteps = useMemo(
    () => (isWizard ? expandWizardSteps(effectiveSchema, answers) : []),
    [answers, effectiveSchema, isWizard],
  );
  const servicePhotoGroupKeys = wizardSteps
    .filter(
      (entry): entry is Extract<(typeof wizardSteps)[number], { kind: "dynamic_file_group" }> =>
        entry.kind === "dynamic_file_group",
    )
    .map((entry) => entry.groupKey);
  const needsPreflight =
    formPayload?.form.slug === "project-resources" &&
    !formPayload.links?.deal_id &&
    !formPayload?.is_preview;
  const showPreflight = needsPreflight && !preflightComplete;
  const currentWizardStep = isWizard ? wizardSteps[step] : null;
  const currentSection =
    isWizard && currentWizardStep?.kind === "section"
      ? currentWizardStep.section
      : isWizard
        ? undefined
        : sections[0];
  const [formulaAnswers, setFormulaAnswers] =
    useState<Record<string, unknown>>(answers);

  useEffect(() => {
    let cancelled = false;
    void buildFormulaAnswers(formPayload?.form.schema, answers).then((next) => {
      if (!cancelled) setFormulaAnswers(next);
    });
    return () => {
      cancelled = true;
    };
  }, [formPayload?.form.schema, answers]);

  const setAnswer = useCallback(
    (key: string, next: unknown) => {
      setAnswers((current) => ({ ...current, [key]: next }));
      trackAnswerChange(key, next);
      setFieldErrors((current) => {
        if (!current[key]) return current;
        const rest = { ...current };
        delete rest[key];
        return rest;
      });
    },
    [trackAnswerChange],
  );

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!formPayload) throw new Error("Form not loaded");
      const recaptchaToken = await getRecaptchaToken();
      const payloadAnswers = await buildFormulaAnswers(
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
      markSubmitted();
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
    const errorMessage =
      error instanceof Error && error.message.trim()
        ? error.message
        : "This link is invalid or has expired.";
    return (
      <div className={publicFormContentClassName(embedded)}>
        <h1 className="text-xl font-semibold">Form unavailable</h1>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
      </div>
    );
  }

  if (formPayload.form.type === "project_brief") {
    if (submitted) {
      return (
        <FormBrandingShell
          primaryColor={formPayload.form.primary_color}
          backgroundImageUrl={formPayload.form.background_image_url}
          customFontUrl={formPayload.form.custom_font_url}
          customCss={formPayload.form.custom_css}
          embedded={embedded}
          className={publicFormContentClassName(embedded)}
        >
          <ProjectBriefThankYou
            embedded={embedded}
            preview={submitted.preview}
            className={publicFormContentClassName(embedded)}
          />
        </FormBrandingShell>
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
    const isResourcesThankYou =
      formPayload.form.slug === "project-resources";
    if (isResourcesThankYou) {
      const agency = resolvePublicFormAgency(formPayload.form);
      return (
        <FormBrandingShell
          primaryColor={formPayload.form.primary_color}
          backgroundImageUrl={formPayload.form.background_image_url}
          customFontUrl={formPayload.form.custom_font_url}
          customCss={formPayload.form.custom_css}
          embedded={embedded}
          className={publicFormContentClassName(embedded)}
        >
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <img
              src={agency.logoUrl}
              alt={agency.agencyName}
              className="h-12 w-auto max-w-[200px] object-contain"
            />
            <PublicFormAgencyHeader
              company={agency.agencyName}
              phone={agency.agencyPhone}
              email={agency.agencyEmail}
              address={agency.agencyAddress}
              website={agency.agencyWebsite}
            />
            {submitted.preview ? <PreviewBanner isPreview /> : null}
            <h1 className="text-2xl font-semibold tracking-tight">
              {submitted.thank_you_title || "Thank you"}
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              {submitted.thank_you_message ||
                "Your files were received. We’ll review them for your project."}
            </p>
          </div>
        </FormBrandingShell>
      );
    }
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

  const isProjectResources = formPayload.form.slug === "project-resources";
  const resourcesAgency = resolvePublicFormAgency(formPayload.form);
  const resourcesFirstName = String(
    formPayload.prefill?.contact_first_name ?? "",
  ).trim();

  if (isProjectResources && showResourcesWelcome) {
    return (
      <FormBrandingShell
        primaryColor={formPayload.form.primary_color}
        backgroundImageUrl={formPayload.form.background_image_url}
        customFontUrl={formPayload.form.custom_font_url}
        customCss={formPayload.form.custom_css}
        embedded={embedded}
        className={publicFormContentClassName(embedded)}
      >
        <div className="flex flex-col items-center gap-6 py-4 text-center">
          <div className="flex w-full flex-col items-center gap-3">
            <img
              src={resourcesAgency.logoUrl}
              alt={resourcesAgency.agencyName}
              className="mx-auto h-16 w-auto max-w-[240px] object-contain"
            />
            <PublicFormAgencyHeader
              company={resourcesAgency.agencyName}
              phone={resourcesAgency.agencyPhone}
              email={resourcesAgency.agencyEmail}
              address={resourcesAgency.agencyAddress}
              website={resourcesAgency.agencyWebsite}
            />
            <PreviewBanner isPreview={formPayload.is_preview} />
          </div>
          <div className="flex w-full flex-col items-center gap-4">
            {resourcesFirstName ? (
              <p className="text-base text-muted-foreground">
                Hi {resourcesFirstName},
              </p>
            ) : null}
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Handshake className="size-7" aria-hidden />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {formPayload.form.welcome_title || "Share your project photos"}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {formPayload.form.welcome_message ||
                  `Thanks for working with ${resourcesAgency.agencyName}. Upload logos, team photos, and service photos so we can build your site with the right assets.`}
              </p>
            </div>
          </div>
          <div className="flex w-full justify-center pt-2">
            <Button
              type="button"
              className="min-h-11 gap-2"
              onClick={() => setShowResourcesWelcome(false)}
            >
              Let’s get started
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </FormBrandingShell>
    );
  }

  const validateCurrentStep = () => {
    if (showPreflight) {
      notify("Complete the project selection step first", { type: "warning" });
      return false;
    }
    if (currentWizardStep?.kind === "summary") return true;
    if (currentWizardStep?.kind === "dynamic_file_group") return true;
    if (
      currentWizardStep?.kind === "section" &&
      currentSection?.id === "before_after"
    ) {
      return true;
    }
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

  const isOptionalBeforeAfterStep =
    currentWizardStep?.kind === "section" &&
    currentSection?.id === "before_after";
  // Alias kept so stale HMR bundles that still reference the old name don't crash.
  const isOptionalPhotoStep = isOptionalBeforeAfterStep;

  const nextWizardStep =
    isWizard && step < wizardSteps.length - 1 ? wizardSteps[step + 1] : null;

  const primaryActionLabel = isPending
    ? "Submitting…"
    : !isWizard || step >= wizardSteps.length - 1
      ? "Submit"
      : nextWizardStep?.kind === "dynamic_file_group"
        ? `Next: ${nextWizardStep.groupKey}`
        : "Next";

  const countServicePhotos = (groupKey: string) => {
    const raw = answers.service_photos;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
    const files = (raw as Record<string, unknown[]>)[groupKey];
    return Array.isArray(files) ? files.length : 0;
  };

  const advanceWizardStep = () => {
    if (
      currentWizardStep?.kind === "dynamic_file_group" &&
      countServicePhotos(currentWizardStep.groupKey) === 0
    ) {
      notify(
        `No photos for ${currentWizardStep.groupKey} yet — you can go back later if needed.`,
        { type: "info" },
      );
    }
    setStep((current) => current + 1);
    setFieldErrors({});
  };

  const handleAddService = (serviceName: string) => {
    const trimmed = serviceName.trim();
    if (!trimmed) return;
    const currentServices = readStringList(answers.services);
    if (
      currentServices.some(
        (entry) => entry.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      notify("That service is already listed", { type: "warning" });
      const existingIndex = wizardSteps.findIndex(
        (entry) =>
          entry.kind === "dynamic_file_group" &&
          entry.groupKey.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existingIndex >= 0) {
        setStep(existingIndex);
        setFieldErrors({});
      }
      return;
    }

    const nextAnswers = {
      ...answers,
      services: [...currentServices, trimmed],
    };
    setAnswers(nextAnswers);
    trackAnswerChange("services", nextAnswers.services);
    const nextSteps = expandWizardSteps(effectiveSchema, nextAnswers);
    const nextIndex = nextSteps.findIndex(
      (entry) =>
        entry.kind === "dynamic_file_group" && entry.groupKey === trimmed,
    );
    if (nextIndex >= 0) {
      setStep(nextIndex);
      setFieldErrors({});
    }
    notify(`Added ${trimmed}. Upload photos for this service next.`, {
      type: "info",
    });
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
      {isProjectResources ? (
        <header className="space-y-3">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left">
            <img
              src={resourcesAgency.logoUrl}
              alt={resourcesAgency.agencyName}
              className="h-10 w-auto max-w-[140px] shrink-0 object-contain"
            />
            <PublicFormAgencyHeader
              company={resourcesAgency.agencyName}
              phone={resourcesAgency.agencyPhone}
              email={resourcesAgency.agencyEmail}
              address={resourcesAgency.agencyAddress}
              website={resourcesAgency.agencyWebsite}
              compact
            />
          </div>
          <PreviewBanner isPreview={formPayload.is_preview} />
        </header>
      ) : (
        <>
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
        </>
      )}

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
                setAnswers((current) => {
                  const merged = { ...savedProgress, ...current };
                  const fromSaved = readStringList(savedProgress.services);
                  const fromCurrent = readStringList(current.services);
                  const base =
                    fromCurrent.length > 0
                      ? fromCurrent
                      : fromSaved.length > 0
                        ? fromSaved
                        : effectivePresetServices;
                  const nextServices = [...base];
                  for (const name of effectivePresetServices) {
                    if (
                      !nextServices.some(
                        (entry) =>
                          entry.toLowerCase() === name.toLowerCase(),
                      )
                    ) {
                      nextServices.push(name);
                    }
                  }
                  if (nextServices.length > 0) {
                    merged.services = nextServices;
                  }
                  return merged;
                });
                setProgressDismissed(true);
              }}
            >
              Continue
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
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

      {isWizard && !showPreflight ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              Step {Math.min(step + 1, wizardSteps.length || 1)} of{" "}
              {wizardSteps.length || 1}
            </span>
            <span className="text-xs text-muted-foreground">
              {currentWizardStep?.kind === "section" &&
              currentWizardStep.section.title
                ? currentWizardStep.section.title
                : currentWizardStep?.kind === "dynamic_file_group"
                  ? currentWizardStep.groupKey
                  : currentWizardStep?.kind === "section" &&
                      currentWizardStep.section.id === "before_after"
                    ? "Before & After"
                    : currentWizardStep?.kind === "summary"
                      ? "Summary"
                      : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${
                  wizardSteps.length > 0
                    ? ((step + 1) / wizardSteps.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {showPreflight ? (
        <ProjectResourcesPreflightStep
          mode={projectLinkMode}
          projectCode={projectCode}
          onModeChange={setProjectLinkMode}
          onProjectCodeChange={setProjectCode}
          onContinue={() => {
            if (!projectLinkMode) return;
            setAnswers((current) => ({
              ...current,
              project_link_mode: projectLinkMode,
              project_code: projectCode.trim(),
            }));
            setPreflightComplete(true);
          }}
        />
      ) : null}

      {!showPreflight ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (isWizard && step < wizardSteps.length - 1) {
              if (!validateCurrentStep()) return;
              advanceWizardStep();
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

          {isWizard && currentWizardStep?.kind === "section" && currentSection ? (
            currentSection.id === "before_after" &&
            getBeforeAfterField(currentSection) ? (
              <section
                className={
                  isProjectResources
                    ? "space-y-4"
                    : "space-y-4 rounded-xl border bg-muted/10 p-4 sm:p-6"
                }
              >
                {currentSection.title ? (
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold">
                      {currentSection.title}
                    </h2>
                    {currentSection.description ? (
                      <p className="text-sm text-muted-foreground">
                        {currentSection.description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <BeforeAfterPhotosField
                  field={getBeforeAfterField(currentSection)!}
                  services={readStringList(answers.services)}
                  value={answers.before_after_photos}
                  token={formPayload.token}
                  onChange={(next) => setAnswer("before_after_photos", next)}
                />
              </section>
            ) : (
              renderFormSection({
                section: currentSection,
                answers,
                fieldErrors,
                formId: formPayload.form.id,
                token: formPayload.token,
                formulaAnswers,
                onChange: setAnswer,
                framed: !isProjectResources,
              })
            )
          ) : null}

          {isWizard && currentWizardStep?.kind === "dynamic_file_group" ? (
            <section
              className={
                isProjectResources
                  ? "space-y-1"
                  : "space-y-1 rounded-xl border bg-muted/10 p-4 sm:p-6"
              }
            >
              <DynamicFileGroupsField
                field={currentWizardStep.field}
                groupKey={currentWizardStep.groupKey}
                groupIndex={currentWizardStep.groupIndex}
                groupTotal={currentWizardStep.groupTotal}
                allGroupKeys={servicePhotoGroupKeys}
                value={answers[currentWizardStep.field.key]}
                token={formPayload.token}
                onChange={(next) =>
                  setAnswer(currentWizardStep.field.key, next)
                }
                onAddService={
                  isProjectResources ? handleAddService : undefined
                }
              />
            </section>
          ) : null}

          {isWizard && currentWizardStep?.kind === "summary" ? (
            <WizardSummaryStep answers={answers} />
          ) : null}

          {!isWizard
            ? sections.map((section) => (
                <div key={section.id}>
                  {renderFormSection({
                    section,
                    answers,
                    fieldErrors,
                    formId: formPayload.form.id,
                    token: formPayload.token,
                    formulaAnswers,
                    onChange: setAnswer,
                    framed: !isProjectResources,
                  })}
                </div>
              ))
            : null}

          <div className="sticky bottom-0 -mx-1 border-t bg-background/95 px-1 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {isWizard && (step > 0 || isProjectResources) ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    if (step > 0) {
                      setStep((current) => current - 1);
                      setFieldErrors({});
                      return;
                    }
                    if (isProjectResources) {
                      setShowResourcesWelcome(true);
                    }
                  }}
                >
                  Previous
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}

              <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
                {isWizard && isOptionalBeforeAfterStep ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 sm:min-w-36 sm:flex-none"
                    disabled={isPending}
                    onClick={() => advanceWizardStep()}
                  >
                    Skip — no before/after
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  className="flex-1 sm:min-w-36 sm:flex-none"
                  disabled={isPending}
                >
                  {primaryActionLabel}
                </Button>
              </div>
            </div>
          </div>
        </form>
      ) : null}
    </FormBrandingShell>
  );
};
