import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WebsiteBriefSectionDef } from "@/lbs/deals/websiteBriefSchema";
import {
  computeYearsExperience,
  normalizeFlexibleUrl,
} from "@/lbs/deals/briefFormUtils";
import { FormFieldRenderer } from "@/lbs/forms-v2/public/FormFieldRenderer";
import type { FormFieldDef } from "@/lbs/forms-v2/types";
import { getVisibleFields } from "@/lbs/forms-v2/formSchemaUtils";
import {
  uploadFormFile,
  type UploadedFormFile,
} from "@/lbs/forms-v2/public/uploadFormFile";

const SOCIAL_PLATFORMS = [
  "Facebook",
  "Instagram",
  "Google Business",
  "Yelp",
  "Nextdoor",
  "TikTok",
  "Thumbtack",
  "Other",
];

const DAY_OPTIONS = [
  { value: "Monday", label: "Mon" },
  { value: "Tuesday", label: "Tue" },
  { value: "Wednesday", label: "Wed" },
  { value: "Thursday", label: "Thu" },
  { value: "Friday", label: "Fri" },
  { value: "Saturday", label: "Sat" },
  { value: "Sunday", label: "Sun" },
];

const LEGACY_DAY_KEYS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type ScheduleDay = {
  enabled: boolean;
  open: string;
  close: string;
};

type BusinessHourEntry = {
  day: string;
  open: string;
  close: string;
};

type BriefSectionProps = {
  section: WebsiteBriefSectionDef;
  formSection: { id: string; title?: string; fields: FormFieldDef[] };
  values: Record<string, unknown>;
  fieldErrors: Record<string, string>;
  formId: number;
  token: string;
  setField: (key: string, next: unknown) => void;
};

const readUploadedFiles = (value: unknown): UploadedFormFile[] => {
  if (Array.isArray(value)) return value as UploadedFormFile[];
  if (value && typeof value === "object") return [value as UploadedFormFile];
  return [];
};

const readServicePhotoMap = (value: unknown): Record<string, UploadedFormFile[]> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, UploadedFormFile[]>)
    : {};

const tabLabel = (service: string) =>
  service.length > 22 ? `${service.slice(0, 20)}…` : service;

const parseSocialLinks = (value: unknown) => {
  const rows = Array.isArray(value) ? value.map(String) : [];
  return rows.length > 0
    ? rows.map((entry) => {
        const [platform = "Facebook", url = ""] = entry.split("|");
        return { platform: platform.trim() || "Facebook", url: url.trim() };
      })
    : [{ platform: "Facebook", url: "" }];
};

const serializeSocialLinks = (rows: Array<{ platform: string; url: string }>) =>
  rows
    .filter((row) => row.url.trim())
    .map((row) => `${row.platform}|${normalizeFlexibleUrl(row.url)}`);

const parseReferenceSites = (value: unknown) => {
  const rows = Array.isArray(value) ? value.map(String) : [];
  return rows.length > 0 ? rows : [""];
};

const parseBusinessHoursEntries = (value: unknown): BusinessHourEntry[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is BusinessHourEntry =>
        entry != null &&
        typeof entry === "object" &&
        "day" in entry &&
        "open" in entry &&
        "close" in entry,
    );
  }

  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parseBusinessHoursEntries(parsed);
    }
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.entries)) {
        return parseBusinessHoursEntries(record.entries);
      }
      const legacy = parsed as Record<string, ScheduleDay>;
      return Object.entries(LEGACY_DAY_KEYS)
        .filter(([key]) => legacy[key]?.enabled)
        .map(([key, day]) => ({
          day,
          open: legacy[key]?.open ?? "08:00",
          close: legacy[key]?.close ?? "17:00",
        }));
    }
  } catch {
    return [];
  }

  return [];
};

const formatBusinessHoursLabel = (entries: BusinessHourEntry[]) => {
  const shortDay = (day: string) =>
    DAY_OPTIONS.find((option) => option.value === day)?.label ?? day.slice(0, 3);
  return entries
    .map((entry) => `${shortDay(entry.day)} ${entry.open}-${entry.close}`)
    .join(", ");
};

const serializeBusinessHours = (entries: BusinessHourEntry[]) =>
  JSON.stringify({
    entries,
    _label: formatBusinessHoursLabel(entries),
  });

const FilePreviewGrid = ({
  files,
  onRemove,
}: {
  files: UploadedFormFile[];
  onRemove?: (index: number) => void;
}) => {
  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {files.map((file, index) => (
        <div
          key={file.url ?? `${file.name}-${index}`}
          className="relative overflow-hidden rounded-md border bg-muted/20"
        >
          <img
            src={file.url}
            alt={file.name}
            className="aspect-square w-full object-cover"
          />
          <div className="flex items-center justify-between gap-2 border-t bg-background/90 px-2 py-1.5 text-xs">
            <span className="truncate">{file.name}</span>
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                aria-label="Remove image"
                onClick={() => onRemove(index)}
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

const LogoUploadField = ({
  value,
  token,
  onChange,
}: {
  value: unknown;
  token: string;
  onChange: (next: UploadedFormFile | null) => void;
}) => {
  const file = readUploadedFiles(value)[0] ?? null;

  const handleUpload = async (fileList: FileList | null) => {
    const selected = fileList?.[0];
    if (!selected) return;
    const uploaded = await uploadFormFile(selected, {
      token,
      fieldKey: "logo_file",
    });
    onChange(uploaded);
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="logo_file">Logo</Label>
      <Input
        id="logo_file"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.svg"
        onChange={(event) => void handleUpload(event.target.files)}
      />
      {file ? (
        <div className="max-w-xs">
          <FilePreviewGrid files={[file]} onRemove={() => onChange(null)} />
        </div>
      ) : null}
    </div>
  );
};

const ServiceTabsPhotoUpload = ({
  services,
  value,
  token,
  fieldKey,
  emptyMessage,
  onChange,
}: {
  services: string[];
  value: unknown;
  token: string;
  fieldKey: string;
  emptyMessage?: string;
  onChange: (next: Record<string, UploadedFormFile[]>) => void;
}) => {
  const photos = readServicePhotoMap(value);
  const [activeTab, setActiveTab] = useState(services[0] ?? "");

  const activeService = services.includes(activeTab)
    ? activeTab
    : services[0] ?? "";

  const uploadForService = async (service: string, fileList: FileList | null) => {
    if (!fileList?.length) return;
    const uploaded = await Promise.all(
      Array.from(fileList).map((file) =>
        uploadFormFile(file, { token, fieldKey, groupKey: service }),
      ),
    );
    onChange({
      ...photos,
      [service]: [...(photos[service] ?? []), ...uploaded],
    });
  };

  const removePhoto = (service: string, index: number) => {
    const next = [...(photos[service] ?? [])];
    next.splice(index, 1);
    onChange({ ...photos, [service]: next });
  };

  if (services.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        {emptyMessage ??
          "Select your services in the previous step to upload photos."}
      </p>
    );
  }

  return (
    <Tabs
      value={activeService}
      onValueChange={setActiveTab}
      className="rounded-md border p-3"
    >
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        {services.map((service) => (
          <TabsTrigger key={service} value={service} className="text-xs sm:text-sm">
            {tabLabel(service)}
            {(photos[service] ?? []).length > 0
              ? ` (${(photos[service] ?? []).length})`
              : ""}
          </TabsTrigger>
        ))}
      </TabsList>
      {services.map((service) => (
        <TabsContent key={service} value={service} className="mt-3 space-y-3">
          <div>
            <Label>Photos — {service}</Label>
            <Input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.heic"
              className="mt-2"
              onChange={(event) => void uploadForService(service, event.target.files)}
            />
          </div>
          <FilePreviewGrid
            files={photos[service] ?? []}
            onRemove={(index) => removePhoto(service, index)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
};

const BeforeAfterByServiceField = ({
  services,
  beforeValue,
  afterValue,
  token,
  onBeforeChange,
  onAfterChange,
}: {
  services: string[];
  beforeValue: unknown;
  afterValue: unknown;
  token: string;
  onBeforeChange: (next: Record<string, UploadedFormFile[]>) => void;
  onAfterChange: (next: Record<string, UploadedFormFile[]>) => void;
}) => (
  <Tabs defaultValue="before" className="rounded-md border p-3">
    <TabsList>
      <TabsTrigger value="before">Before</TabsTrigger>
      <TabsTrigger value="after">After</TabsTrigger>
    </TabsList>
    <TabsContent value="before" className="mt-3">
      <ServiceTabsPhotoUpload
        services={services}
        value={beforeValue}
        token={token}
        fieldKey="service_before_photos"
        onChange={onBeforeChange}
      />
    </TabsContent>
    <TabsContent value="after" className="mt-3">
      <ServiceTabsPhotoUpload
        services={services}
        value={afterValue}
        token={token}
        fieldKey="service_after_photos"
        onChange={onAfterChange}
      />
    </TabsContent>
  </Tabs>
);

const TeamPhotosField = ({
  value,
  token,
  onChange,
}: {
  value: unknown;
  token: string;
  onChange: (next: UploadedFormFile[]) => void;
}) => {
  const files = readUploadedFiles(value);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const uploaded = await Promise.all(
      Array.from(fileList).map((file) =>
        uploadFormFile(file, { token, fieldKey: "team_photos_files" }),
      ),
    );
    onChange([...files, ...uploaded]);
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label>Team / truck / uniform photos</Label>
      <Input
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.heic"
        onChange={(event) => void handleUpload(event.target.files)}
      />
      <FilePreviewGrid
        files={files}
        onRemove={(index) => {
          const next = [...files];
          next.splice(index, 1);
          onChange(next);
        }}
      />
    </div>
  );
};

const SocialLinksField = ({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: string[]) => void;
}) => {
  const rows = parseSocialLinks(value);

  const updateRow = (
    index: number,
    patch: Partial<{ platform: string; url: string }>,
  ) => {
    const next = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    );
    onChange(serializeSocialLinks(next));
  };

  return (
    <div className="space-y-3">
      <Label>Social media (optional)</Label>
      <p className="text-xs text-muted-foreground">
        Add only the profiles you use. URLs can be written as www.yourcompany.com.
      </p>
      {rows.map((row, index) => (
        <div key={`social-${index}`} className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={row.platform}
            onValueChange={(next) => updateRow(index, { platform: next })}
          >
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOCIAL_PLATFORMS.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={row.url}
            placeholder="www.yourcompany.com"
            onChange={(event) => updateRow(index, { url: event.target.value })}
          />
          {rows.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Remove social profile"
              onClick={() => {
                const next = rows.filter((_, rowIndex) => rowIndex !== index);
                onChange(
                  serializeSocialLinks(
                    next.length > 0 ? next : [{ platform: "Facebook", url: "" }],
                  ),
                );
              }}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange(serializeSocialLinks([...rows, { platform: "Facebook", url: "" }]))
        }
      >
        <Plus className="size-4" />
        Add social profile
      </Button>
    </div>
  );
};

const ReferenceSitesField = ({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: string[]) => void;
}) => {
  const rows = parseReferenceSites(value);

  return (
    <div className="space-y-3">
      <Label>Reference websites (optional)</Label>
      <p className="text-xs text-muted-foreground">
        Add only if you have example sites you like.
      </p>
      {rows.map((url, index) => (
        <div key={`ref-${index}`} className="flex gap-2">
          <Input
            value={url}
            placeholder="www.example.com"
            onChange={(event) => {
              const next = [...rows];
              next[index] = event.target.value;
              onChange(next);
            }}
          />
          {rows.length > 1 || url.trim() ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Remove reference"
              onClick={() => {
                const next = rows.filter((_, rowIndex) => rowIndex !== index);
                onChange(next.length > 0 ? next : [""]);
              }}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, ""])}
      >
        <Plus className="size-4" />
        Add reference site
      </Button>
    </div>
  );
};

const BusinessHoursField = ({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: string) => void;
}) => {
  const entries = parseBusinessHoursEntries(value);
  const usedDays = new Set(entries.map((entry) => entry.day));
  const availableDays = DAY_OPTIONS.filter(
    (option) => !usedDays.has(option.value),
  );
  const [draftDay, setDraftDay] = useState(
    () => availableDays[0]?.value ?? "Monday",
  );
  const [draftOpen, setDraftOpen] = useState("08:00");
  const [draftClose, setDraftClose] = useState("17:00");

  const commit = (next: BusinessHourEntry[]) => {
    onChange(serializeBusinessHours(next));
  };

  const addEntry = () => {
    if (!draftDay || usedDays.has(draftDay)) return;
    commit(
      [...entries, { day: draftDay, open: draftOpen, close: draftClose }].sort(
        (left, right) =>
          DAY_OPTIONS.findIndex((option) => option.value === left.day) -
          DAY_OPTIONS.findIndex((option) => option.value === right.day),
      ),
    );
    const nextDay = DAY_OPTIONS.find(
      (option) =>
        option.value !== draftDay && !usedDays.has(option.value),
    );
    if (nextDay) setDraftDay(nextDay.value);
  };

  const removeEntry = (index: number) => {
    const next = entries.filter((_, entryIndex) => entryIndex !== index);
    commit(next);
    if (!next.some((entry) => entry.day === draftDay)) {
      const firstAvailable = DAY_OPTIONS.find(
        (option) => !next.some((entry) => entry.day === option.value),
      );
      if (firstAvailable) setDraftDay(firstAvailable.value);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Business hours</Label>
      <p className="text-xs text-muted-foreground">
        Add one day at a time. Skip days when you&apos;re closed.
      </p>
      {entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((entry, index) => (
            <li
              key={entry.day}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{entry.day}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {entry.open} – {entry.close}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`Remove ${entry.day}`}
                onClick={() => removeEntry(index)}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          No hours added yet.
        </p>
      )}
      {availableDays.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end">
          <div className="min-w-[8rem] flex-1 space-y-1">
            <Label className="text-xs">Day</Label>
            <Select value={draftDay} onValueChange={setDraftDay}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableDays.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} — {option.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Opens</Label>
            <Input
              type="time"
              className="h-9"
              value={draftOpen}
              onChange={(event) => setDraftOpen(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Closes</Label>
            <Input
              type="time"
              className="h-9"
              value={draftClose}
              onChange={(event) => setDraftClose(event.target.value)}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addEntry}>
            <Plus className="size-4" />
            Add day
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const BrandColorPickers = ({
  values,
  setField,
}: {
  values: Record<string, unknown>;
  setField: (key: string, next: unknown) => void;
}) => (
  <div className="grid gap-4 rounded-md border p-3 sm:grid-cols-3">
    {[
      { key: "brand_color_1", label: "Primary" },
      { key: "brand_color_2", label: "Secondary" },
      { key: "brand_color_3", label: "Accent" },
    ].map(({ key, label }) => (
      <div key={key} className="flex flex-col items-center gap-2">
        <Input
          id={key}
          type="color"
          className="h-14 w-full cursor-pointer p-1"
          value={String(values[key] || "#2563eb")}
          onChange={(event) => setField(key, event.target.value)}
        />
        <Label htmlFor={key} className="text-xs text-muted-foreground">
          {label}
        </Label>
      </div>
    ))}
  </div>
);

const renderField = (field: FormFieldDef, props: BriefSectionProps) => (
  <div key={field.key} className="space-y-1">
    <FormFieldRenderer
      field={field}
      value={props.values[field.key]}
      formId={props.formId}
      token={props.token}
      onChange={(next) => props.setField(field.key, next)}
    />
    {props.fieldErrors[field.key] ? (
      <p className="text-xs text-destructive">{props.fieldErrors[field.key]}</p>
    ) : null}
  </div>
);

const getFieldDef = (fields: FormFieldDef[], key: string) =>
  fields.find((field) => field.key === key);

const VisualContentSection = (props: BriefSectionProps) => {
  const { formSection, values, setField, token } = props;
  const fields = formSection.fields;
  const services = useMemo(
    () =>
      Array.isArray(values.services_offered)
        ? values.services_offered.map(String).filter(Boolean)
        : [],
    [values.services_offered],
  );

  const logoField = getFieldDef(fields, "logo_file");
  const projectPhotosField = getFieldDef(fields, "has_project_photos");
  const beforeAfterField = getFieldDef(fields, "before_after_photos");
  const teamPhotosField = getFieldDef(fields, "has_team_photos");

  return (
    <div className="space-y-6">
      {logoField ? (
        <LogoUploadField
          value={values.logo_file}
          token={token}
          onChange={(next) => setField("logo_file", next)}
        />
      ) : null}

      {projectPhotosField ? (
        <div className="space-y-3">
          {renderField(projectPhotosField, props)}
          {values.has_project_photos === "Yes, I'll upload now" ? (
            <ServiceTabsPhotoUpload
              services={services}
              value={values.service_project_photos}
              token={token}
              fieldKey="service_project_photos"
              onChange={(next) => setField("service_project_photos", next)}
            />
          ) : null}
        </div>
      ) : null}

      {beforeAfterField ? (
        <div className="space-y-3">
          {renderField(beforeAfterField, props)}
          {values.before_after_photos === "Yes" ? (
            <BeforeAfterByServiceField
              services={services}
              beforeValue={values.service_before_photos}
              afterValue={values.service_after_photos}
              token={token}
              onBeforeChange={(next) => setField("service_before_photos", next)}
              onAfterChange={(next) => setField("service_after_photos", next)}
            />
          ) : null}
        </div>
      ) : null}

      {teamPhotosField ? (
        <div className="space-y-3">
          {renderField(teamPhotosField, props)}
          {values.has_team_photos === "Yes" ? (
            <TeamPhotosField
              value={values.team_photos_files}
              token={token}
              onChange={(next) => setField("team_photos_files", next)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const BrandStyleSection = (props: BriefSectionProps) => {
  const { formSection, values, setField } = props;
  const fields = formSection.fields;
  const colorsField = getFieldDef(fields, "brand_colors_option");
  const exclusionsField = getFieldDef(fields, "site_exclusions");

  return (
    <div className="space-y-6">
      {colorsField ? (
        <div className="space-y-3">
          {renderField(colorsField, props)}
          {values.brand_colors_option === "Yes" ? (
            <BrandColorPickers values={values} setField={setField} />
          ) : null}
        </div>
      ) : null}

      <ReferenceSitesField
        value={values.reference_sites ?? [""]}
        onChange={(next) => setField("reference_sites", next)}
      />

      {exclusionsField ? renderField(exclusionsField, props) : null}
    </div>
  );
};

export const ContractorBriefSectionFields = (props: BriefSectionProps) => {
  const { section, formSection, values, setField } = props;
  const visibleFields = getVisibleFields(formSection, values);

  if (section.id === "confirm_data") {
    return (
      <>
        {visibleFields
          .filter((field) => field.key !== "social_links")
          .map((field) => renderField(field, props))}
        <SocialLinksField
          value={values.social_links}
          onChange={(next) => setField("social_links", next)}
        />
      </>
    );
  }

  if (section.id === "about_business") {
    const years = computeYearsExperience(values.company_founded_year);
    return (
      <>
        {visibleFields
          .filter(
            (field) =>
              field.key !== "business_hours" && field.key !== "years_experience",
          )
          .map((field) => renderField(field, props))}
        {years != null ? (
          <div className="space-y-1 rounded-md border bg-muted/20 p-3">
            <Label>Years of experience</Label>
            <p className="text-lg font-semibold">{years} years</p>
            <p className="text-xs text-muted-foreground">
              Calculated from founding year ({values.company_founded_year}).
            </p>
          </div>
        ) : null}
        <BusinessHoursField
          value={values.business_hours}
          onChange={(next) => setField("business_hours", next)}
        />
      </>
    );
  }

  if (section.id === "visual_content") {
    return <VisualContentSection {...props} />;
  }

  if (section.id === "brand_style") {
    return <BrandStyleSection {...props} />;
  }

  return <>{visibleFields.map((field) => renderField(field, props))}</>;
};
