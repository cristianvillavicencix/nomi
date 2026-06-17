import type { ReactNode } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Music2,
  Plus,
  Twitter,
  Youtube,
  X as XIcon,
} from "lucide-react";
import { BooleanInput } from "@/components/admin/boolean-input";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLbsProjectScopeMode } from "@/modules/deals/lbsProjectConstants";
import { ProjectScopeChecklist } from "@/modules/deals/ProjectScopeChecklist";
import {
  getVisibleBriefSections,
  type WebsiteBriefFieldDef,
} from "@/modules/deals/websiteBriefSchema";
import { evaluateCondition } from "@/lib/forms-v2/conditionalLogic";

const BriefSectionShell = ({
  title,
  description,
  children,
  showDivider = true,
  hideHeader = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  showDivider?: boolean;
  hideHeader?: boolean;
}) => (
  <>
    {!hideHeader && showDivider ? (
      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-border/80 to-transparent"
        aria-hidden
      />
    ) : null}
    <section className="space-y-4 py-1">
      {!hideHeader ? (
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  </>
);

const BriefAddressFields = ({ field }: { field: WebsiteBriefFieldDef }) => {
  const { setValue } = useFormContext();
  const baseKey = field.key;
  // We keep the legacy `full_address` text in sync so existing data and the
  // public form keep working, while exposing structured street/city/state/zip.
  const handlePlace = (details: {
    formattedAddress?: string | null;
    city?: string | null;
    stateAbbr?: string | null;
    zipcode?: string | null;
    country?: string | null;
  }) => {
    // The Places API returns the full formatted address; we keep the street
    // line as the part before the first comma, which works well for US/EU.
    if (details.formattedAddress != null) {
      const street = details.formattedAddress.split(",")[0]?.trim() ?? "";
      setValue(`website_brief.${baseKey}_street`, street, {
        shouldDirty: true,
      });
      setValue(`website_brief.${baseKey}`, details.formattedAddress, {
        shouldDirty: true,
      });
    }
    if (details.city != null)
      setValue(`website_brief.${baseKey}_city`, details.city, {
        shouldDirty: true,
      });
    if (details.stateAbbr != null)
      setValue(`website_brief.${baseKey}_state`, details.stateAbbr, {
        shouldDirty: true,
      });
    if (details.zipcode != null)
      setValue(`website_brief.${baseKey}_zip`, details.zipcode, {
        shouldDirty: true,
      });
    if (details.country != null)
      setValue(`website_brief.${baseKey}_country`, details.country, {
        shouldDirty: true,
      });
  };

  return (
    <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <GooglePlacesAutocompleteInput
          source={`website_brief.${baseKey}_street`}
          label="Street"
          placeholder="123 Main St"
          mode="address"
          onPlaceDetails={handlePlace}
        />
      </div>
      <TextInput
        source={`website_brief.${baseKey}_city`}
        label="City"
        helperText={false}
      />
      <TextInput
        source={`website_brief.${baseKey}_state`}
        label="State / Province"
        helperText={false}
      />
      <TextInput
        source={`website_brief.${baseKey}_zip`}
        label="ZIP / Postal code"
        helperText={false}
      />
      <TextInput
        source={`website_brief.${baseKey}_country`}
        label="Country"
        helperText={false}
      />
    </div>
  );
};

const detectSocialIcon = (value: string) => {
  const v = value.toLowerCase();
  if (v.includes("facebook.com") || v.startsWith("facebook"))
    return Facebook;
  if (v.includes("instagram.com") || v.startsWith("instagram"))
    return Instagram;
  if (
    v.includes("twitter.com") ||
    v.includes("x.com") ||
    v.startsWith("twitter") ||
    v.startsWith("x")
  )
    return Twitter;
  if (v.includes("linkedin.com") || v.startsWith("linkedin")) return Linkedin;
  if (v.includes("youtube.com") || v.includes("youtu.be")) return Youtube;
  if (v.includes("tiktok.com") || v.startsWith("tiktok")) return Music2;
  return Globe;
};

const BriefDynamicListInput = ({ field }: { field: WebsiteBriefFieldDef }) => {
  const { control, register } = useFormContext();
  const source = `website_brief.${field.key}`;
  const { fields, append, remove } = useFieldArray({
    control,
    name: source,
  });
  const values = useWatch({ name: source }) as Array<string> | undefined;

  const placeholder =
    field.placeholder ?? "Type or paste here…";
  const addLabel = "Add entry";

  return (
    <div className="md:col-span-2 space-y-2">
      <div className="text-sm font-medium">{field.label}</div>
      {field.helperText ? (
        <p className="text-muted-foreground text-xs">{field.helperText}</p>
      ) : null}
      <ul className="space-y-2">
        {fields.length === 0 ? (
          <li className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-xs">
            No entries yet. Click "+" below to add one.
          </li>
        ) : null}
        {fields.map((entry, index) => {
          const currentValue = String(values?.[index] ?? "");
          const Icon = detectSocialIcon(currentValue);
          return (
            <li key={entry.id} className="flex items-center gap-2">
              <Icon className="text-muted-foreground size-4 shrink-0" />
              <Input
                {...register(`${source}.${index}`)}
                defaultValue={currentValue}
                placeholder={placeholder}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove entry"
                onClick={() => remove(index)}
                className="size-8 shrink-0"
              >
                <XIcon className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append("")}
      >
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
};

const BriefFieldInput = ({
  field,
  gridClass,
  validateUrl,
}: {
  field: WebsiteBriefFieldDef;
  gridClass: string;
  validateUrl?: (url?: string) => string | undefined;
}) => {
  const source = `website_brief.${field.key}`;
  const isUrlField =
    field.key === "existing_website" || field.key === "staging_url";
  const fullSpanClass = gridClass.includes("1")
    ? undefined
    : "md:col-span-2";
  const widthClass = field.fullWidth ? fullSpanClass : undefined;

  // Address: split into autocompleted fields.
  if (field.key === "full_address" || field.key === "business_address") {
    return <BriefAddressFields field={field} />;
  }

  // Dynamic list (e.g. social_links, warranties, differentiators).
  if (field.fieldType === "dynamic_list") {
    return <BriefDynamicListInput field={field} />;
  }

  // Checkbox / toggle.
  if (field.fieldType === "checkbox") {
    return (
      <div className={fullSpanClass}>
        <BooleanInput source={source} label={field.label} helperText={false} />
      </div>
    );
  }

  // Radio (rendered as a select for simplicity).
  if (field.fieldType === "radio" && field.options?.length) {
    return (
      <div className={widthClass}>
        <SelectInput
          source={source}
          label={field.label}
          choices={field.options.map((value) => ({ id: value, name: value }))}
          helperText={field.helperText ?? false}
        />
      </div>
    );
  }

  if (field.fieldType === "number") {
    return (
      <div className={widthClass}>
        <NumberInput
          source={source}
          label={field.label}
          placeholder={field.placeholder}
          helperText={field.helperText ?? false}
        />
      </div>
    );
  }

  return (
    <div className={widthClass}>
      <TextInput
        source={source}
        label={field.label}
        placeholder={field.placeholder}
        helperText={field.helperText ?? false}
        multiline={field.multiline || field.fieldType === "textarea"}
        rows={field.rows ?? (field.fieldType === "textarea" ? 3 : undefined)}
        validate={isUrlField && validateUrl ? validateUrl : undefined}
      />
    </div>
  );
};

type WebsiteBriefFormSectionsProps = {
  gridClass?: string;
  projectTypeSource?: string;
  excludeFieldKeys?: string[];
  onlySectionId?: string;
  showScopeChecklist?: boolean;
  showSecurityHint?: boolean;
  validateUrl?: (url?: string) => string | undefined;
};

export const WebsiteBriefFormSections = ({
  gridClass = "grid gap-4 md:grid-cols-2",
  projectTypeSource = "project_type",
  excludeFieldKeys = [],
  onlySectionId,
  showScopeChecklist = true,
  showSecurityHint = true,
  validateUrl,
}: WebsiteBriefFormSectionsProps) => {
  const projectType = useWatch({ name: projectTypeSource }) as
    | string
    | undefined;
  const briefAnswers =
    (useWatch({ name: "website_brief" }) as Record<string, unknown>) ?? {};
  const sections = getVisibleBriefSections(projectType).filter(
    (section) => !onlySectionId || section.id === onlySectionId,
  );
  const scopeMode = getLbsProjectScopeMode(projectType);
  const excluded = new Set(excludeFieldKeys);
  // Hide the inner section title/description when only one section is shown,
  // because the parent Sheet header already displays them.
  const hideSectionHeader = Boolean(onlySectionId);

  return (
    <div className="space-y-2">
      {sections.map((section, index) => {
        const fields = section.fields
          .filter((field) => !excluded.has(field.key))
          .filter((field) =>
            evaluateCondition(field.visibleWhen, briefAnswers),
          );
        if (
          fields.length === 0 &&
          !(section.id === "scope" && showScopeChecklist)
        ) {
          return null;
        }

        return (
          <BriefSectionShell
            key={section.id}
            title={section.title}
            description={section.description}
            showDivider={index > 0}
            hideHeader={hideSectionHeader}
          >
            <div className={gridClass}>
              {section.id === "scope" &&
              showScopeChecklist &&
              scopeMode === "pages" ? (
                <div className="md:col-span-2">
                  <ProjectScopeChecklist />
                </div>
              ) : null}
              {fields.map((field) => (
                <BriefFieldInput
                  key={field.key}
                  field={field}
                  gridClass={gridClass}
                  validateUrl={validateUrl}
                />
              ))}
            </div>
          </BriefSectionShell>
        );
      })}

      {showSecurityHint ? (
        <p className="text-sm text-muted-foreground">
          Store hosting, WordPress, FTP, and other logins in the{" "}
          <span className="font-medium text-foreground">Security</span> tab.
          Upload logos and photos in{" "}
          <span className="font-medium text-foreground">Resources</span>.
        </p>
      ) : null}
    </div>
  );
};
