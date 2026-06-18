import { ImageIcon, Loader2, X } from "lucide-react";
import { useState } from "react";
import type { Identifier } from "ra-core";
import { NumberInput } from "@/components/admin/number-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { evaluateCondition } from "@/lib/forms-v2/conditionalLogic";
import type { LbsDeal } from "@/modules/types";
import {
  BrandColorsField,
  ContactReachField,
  ServiceAreasPlacesInput,
  TagAddField,
  WeekdayBusinessHoursField,
  YesNoToggleField,
} from "@/modules/deals/contractorBrief/contractorBriefInternalFields";
import {
  readBriefUploadedFiles,
  uploadBriefAsset,
} from "@/modules/deals/contractorBrief/uploadBriefAsset";
import {
  BriefDynamicListInput,
  BriefFieldInput,
} from "@/modules/deals/WebsiteBriefFormSections.shared";
import type { WebsiteBriefSectionDef } from "@/modules/deals/websiteBriefSchema";
import { useFormContext, useWatch } from "react-hook-form";

const mapFreeOffers = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (raw === "Yes") return ["Free inspection", "Free estimate"];
  if (raw === "No") return ["Neither"];
  if (Array.isArray(value)) return value;
  return [];
};

const readFreeOffersYesNo = (value: unknown) => {
  const items = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? [value]
      : [];
  if (
    items.includes("Both") ||
    (items.includes("Free inspection") && items.includes("Free estimate"))
  ) {
    return "Yes";
  }
  if (items.includes("Neither") || items.length === 0) return "No";
  if (items.some((entry) => entry.toLowerCase().includes("free"))) return "Yes";
  return "No";
};

const BriefLogoUpload = ({
  dealId,
  value,
  onChange,
}: {
  dealId: Identifier;
  value: unknown;
  onChange: (next: unknown) => void;
}) => {
  const record = useWatch({ name: "org_id" }) as Identifier | undefined;
  const file = readBriefUploadedFiles(value)[0] ?? null;
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (fileList: FileList | null) => {
    const selected = fileList?.[0];
    if (!selected) return;
    setUploading(true);
    try {
      const uploaded = await uploadBriefAsset(dealId, selected, record);
      onChange(uploaded);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 md:col-span-2">
      <Label htmlFor="brief-logo-upload">Logo</Label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" asChild>
          <label htmlFor="brief-logo-upload" className="cursor-pointer">
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImageIcon className="size-4" />
            )}
            {file ? "Replace logo" : "Upload logo"}
          </label>
        </Button>
        <Input
          id="brief-logo-upload"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.svg"
          className="hidden"
          disabled={uploading}
          onChange={(event) => void handleUpload(event.target.files)}
        />
        {file ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            <X className="size-4" />
            Remove
          </Button>
        ) : null}
      </div>
      {file?.url ? (
        <div className="max-w-xs overflow-hidden rounded-md border bg-muted/20">
          <img
            src={file.url}
            alt={file.name}
            className="aspect-square w-full object-contain p-4"
          />
          <p className="truncate border-t px-2 py-1.5 text-xs">{file.name}</p>
        </div>
      ) : null}
    </div>
  );
};

type ContractorBriefInternalSectionProps = {
  section: WebsiteBriefSectionDef;
  dealId: Identifier;
  gridClass: string;
  validateUrl?: (url?: string) => string | undefined;
};

export const ContractorBriefInternalSection = ({
  section,
  dealId,
  gridClass,
  validateUrl,
}: ContractorBriefInternalSectionProps) => {
  const { setValue } = useFormContext<LbsDeal>();
  const briefAnswers =
    (useWatch({ name: "website_brief" }) as Record<string, unknown>) ?? {};

  const setField = (key: string, value: unknown) => {
    setValue(`website_brief.${key}`, value, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const renderDefaultField = (field: WebsiteBriefSectionDef["fields"][number]) => {
    if (!evaluateCondition(field.visibleWhen, briefAnswers)) return null;
    if (field.fieldType === "dynamic_list") {
      return <BriefDynamicListInput key={field.key} field={field} />;
    }
    return (
      <BriefFieldInput
        key={field.key}
        field={field}
        gridClass={gridClass}
        validateUrl={validateUrl}
      />
    );
  };

  if (section.id === "about_business") {
    const skip = new Set([
      "service_areas",
      "business_hours",
      "company_founded_year",
    ]);
    return (
      <div className={gridClass}>
        <div className={gridClass.includes("1") ? "" : "md:col-span-2"}>
          <NumberInput
            source="website_brief.company_founded_year"
            label="Year the company was founded"
            helperText={false}
          />
        </div>
        {section.fields
          .filter((field) => !skip.has(field.key))
          .map((field) => renderDefaultField(field))}
        <ServiceAreasPlacesInput
          value={briefAnswers.service_areas}
          onChange={(next) => setField("service_areas", next)}
        />
        <WeekdayBusinessHoursField
          value={briefAnswers.business_hours}
          onChange={(next) => setField("business_hours", next)}
        />
      </div>
    );
  }

  if (section.id === "services") {
    const skip = new Set([
      "services_offered",
      "brands_used",
      "free_offers",
      "insurance_claims",
      "accepts_xactimate",
      "service_categories",
      "primary_service",
    ]);
    return (
      <div className={gridClass}>
        <TagAddField
          label="Services offered"
          value={briefAnswers.services_offered}
          placeholder="e.g. Roof Repairs"
          helpText="Add each service one at a time."
          onChange={(next) => setField("services_offered", next)}
        />
        <TagAddField
          label="Brands / manufacturers you work with"
          value={briefAnswers.brands_used}
          placeholder="e.g. GAF, Trex, Owens Corning"
          helpText="Add each brand as a tag."
          onChange={(next) => setField("brands_used", next)}
        />
        <div className={gridClass.includes("1") ? "" : "md:col-span-2"}>
          <TextInput
            source="website_brief.primary_service"
            label="Primary / most profitable service"
            helperText="Pick one of the services you added above."
          />
        </div>
        <YesNoToggleField
          label="Do you offer free inspections or estimates?"
          value={readFreeOffersYesNo(briefAnswers.free_offers)}
          onChange={(next) => setField("free_offers", mapFreeOffers(next))}
        />
        <YesNoToggleField
          label="Do you work with insurance claims?"
          value={briefAnswers.insurance_claims}
          onChange={(next) => setField("insurance_claims", next)}
        />
        {String(briefAnswers.insurance_claims ?? "") === "Yes" ? (
          <YesNoToggleField
            label="Do you accept Xactimate?"
            value={briefAnswers.accepts_xactimate}
            onChange={(next) => setField("accepts_xactimate", next)}
          />
        ) : null}
        {section.fields
          .filter((field) => !skip.has(field.key))
          .map((field) => renderDefaultField(field))}
      </div>
    );
  }

  if (section.id === "contact_preferences") {
    const skip = new Set([
      "preferred_contact_methods",
      "form_notification_email",
      "whatsapp_business",
    ]);
    return (
      <div className={gridClass}>
        <ContactReachField
          values={briefAnswers}
          onChangeMethods={(next) =>
            setField("preferred_contact_methods", next)
          }
          onChangeField={(key, value) => setField(key, value)}
        />
        {section.fields
          .filter((field) => !skip.has(field.key))
          .map((field) => renderDefaultField(field))}
      </div>
    );
  }

  if (section.id === "visual_content") {
    const skip = new Set(["logo_file", "has_project_photos", "has_team_photos"]);
    return (
      <div className={gridClass}>
        <BriefLogoUpload
          dealId={dealId}
          value={briefAnswers.logo_file}
          onChange={(next) => setField("logo_file", next)}
        />
        <YesNoToggleField
          label="Do you have photos of completed projects?"
          value={
            String(briefAnswers.has_project_photos ?? "").startsWith("Yes")
              ? "Yes"
              : "No"
          }
          onChange={(next) =>
            setField(
              "has_project_photos",
              next === "Yes"
                ? "Yes, I'll upload now"
                : "No, use professional stock photos",
            )
          }
        />
        <YesNoToggleField
          label="Do you have team / truck / uniform photos?"
          value={String(briefAnswers.has_team_photos ?? "") === "Yes" ? "Yes" : "No"}
          onChange={(next) => setField("has_team_photos", next)}
        />
        {section.fields
          .filter((field) => !skip.has(field.key))
          .map((field) => renderDefaultField(field))}
      </div>
    );
  }

  if (section.id === "brand_style") {
    const skip = new Set([
      "brand_color_1",
      "brand_color_2",
      "brand_color_3",
      "brand_colors_option",
    ]);
    return (
      <div className={gridClass}>
        <YesNoToggleField
          label="Do you have specific brand colors?"
          value={
            String(briefAnswers.brand_colors_option ?? "") === "Yes" ? "Yes" : "No"
          }
          onChange={(next) =>
            setField(
              "brand_colors_option",
              next === "Yes" ? "Yes" : "No, use colors from the logo",
            )
          }
        />
        {String(briefAnswers.brand_colors_option ?? "") === "Yes" ? (
          <BrandColorsField
            values={briefAnswers}
            onChange={(key, value) => setField(key, value)}
          />
        ) : null}
        {section.fields
          .filter((field) => !skip.has(field.key))
          .map((field) => renderDefaultField(field))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {section.fields.map((field) => renderDefaultField(field))}
    </div>
  );
};
