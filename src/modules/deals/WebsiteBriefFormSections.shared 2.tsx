import type { ReactNode } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Globe, Plus, X as XIcon } from "lucide-react";
import { BooleanInput } from "@/components/admin/boolean-input";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { BriefSocialLinksInput } from "@/modules/deals/BriefSocialLinksInput";
import { detectSocialIconFromBriefEntry } from "@/modules/deals/briefSocialLinks";
import type { WebsiteBriefFieldDef } from "@/modules/deals/websiteBriefSchema";

const BriefAddressFields = ({ field }: { field: WebsiteBriefFieldDef }) => {
  const { setValue } = useFormContext();
  const baseKey = field.key;

  const handlePlace = (details: {
    formattedAddress?: string | null;
    city?: string | null;
    stateAbbr?: string | null;
    zipcode?: string | null;
    country?: string | null;
  }) => {
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

const detectSocialIcon = (value: string) =>
  detectSocialIconFromBriefEntry(value);

export { BriefSocialLinksInput } from "@/modules/deals/BriefSocialLinksInput";

export const BriefDynamicListInput = ({
  field,
  detectIcon = detectSocialIcon,
}: {
  field: WebsiteBriefFieldDef;
  detectIcon?: (value: string) => typeof Globe;
}) => {
  const { control, register } = useFormContext();
  const source = `website_brief.${field.key}`;
  const { fields, append, remove, insert } = useFieldArray({
    control,
    name: source,
  });
  const values = useWatch({ name: source }) as Array<string> | undefined;

  const placeholder = field.placeholder ?? "Type or paste here…";

  return (
    <div className="md:col-span-2 space-y-2">
      <div className="text-sm font-medium">{field.label}</div>
      {field.helperText ? (
        <p className="text-muted-foreground text-xs">{field.helperText}</p>
      ) : null}
      <ul className="space-y-2">
        {fields.length === 0 ? (
          <li className="flex items-center gap-2">
            <Globe className="text-muted-foreground size-4 shrink-0" />
            <Input
              placeholder={placeholder}
              className="flex-1"
              onFocus={() => append("")}
            />
            <IconButton
              aria-label="Add entry"
              onClick={() => append("")}
              className="shrink-0"
            >
              <Plus className="size-4" />
            </IconButton>
          </li>
        ) : null}
        {fields.map((entry, index) => {
          const currentValue = String(values?.[index] ?? "");
          const Icon = detectIcon(currentValue);
          const isLast = index === fields.length - 1;
          return (
            <li key={entry.id} className="flex items-center gap-2">
              <Icon className="text-muted-foreground size-4 shrink-0" />
              <Input
                {...register(`${source}.${index}`)}
                defaultValue={currentValue}
                placeholder={placeholder}
                className="flex-1"
              />
              {isLast ? (
                <IconButton
                  aria-label="Add entry"
                  onClick={() => append("")}
                  className="shrink-0"
                >
                  <Plus className="size-4" />
                </IconButton>
              ) : (
                <IconButton
                  aria-label="Insert below"
                  onClick={() => insert(index + 1, "")}
                  className="shrink-0"
                >
                  <Plus className="size-4" />
                </IconButton>
              )}
              <IconButton
                aria-label="Remove entry"
                onClick={() => remove(index)}
                className="shrink-0"
              >
                <XIcon className="size-4" />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const BriefFieldInput = ({
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
  const fullSpanClass = gridClass.includes("1") ? undefined : "md:col-span-2";
  const widthClass = field.fullWidth ? fullSpanClass : undefined;

  if (field.key === "full_address" || field.key === "business_address") {
    return <BriefAddressFields field={field} />;
  }

  if (field.fieldType === "dynamic_list") {
    if (field.key === "social_links") {
      return <BriefSocialLinksInput field={field} />;
    }
    return <BriefDynamicListInput field={field} />;
  }

  if (field.key === "existing_website") {
    return (
      <BriefDynamicListInput
        field={{
          ...field,
          key: "existing_websites",
          label: field.label,
          placeholder: field.placeholder ?? "https://example.com",
          helperText:
            field.helperText ??
            "Add every URL the client owns — site, landing pages, microsites.",
        }}
        detectIcon={() => Globe}
      />
    );
  }

  if (field.fieldType === "checkbox") {
    return (
      <div className={fullSpanClass}>
        <BooleanInput source={source} label={field.label} helperText={false} />
      </div>
    );
  }

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

export const BriefSectionShell = ({
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
