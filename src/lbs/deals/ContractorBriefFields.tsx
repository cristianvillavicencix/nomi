import { useMemo, useState } from "react";
import { Check, ChevronDown, ImageIcon, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  rows.map((row) =>
    row.url.trim()
      ? `${row.platform}|${normalizeFlexibleUrl(row.url)}`
      : `${row.platform}|`,
  );

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

type CertificationImage = { url: string; name: string };

type CertificationEntry = {
  label: string;
  url: string;
  images: CertificationImage[];
};

const parseCertifications = (value: unknown): CertificationEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object")
    .map((entry) => ({
      label: String(entry.label ?? ""),
      url: String(entry.url ?? ""),
      // migrate old image_url field
      images: Array.isArray(entry.images)
        ? (entry.images as CertificationImage[])
        : entry.image_url
          ? [{ url: String(entry.image_url), name: String(entry.image_name ?? "") }]
          : [],
    }));
};

const CertificationsField = ({
  value,
  token,
  onChange,
}: {
  value: unknown;
  token: string;
  onChange: (next: CertificationEntry[]) => void;
}) => {
  const rows = parseCertifications(value);
  const fileInputRefs = useMemo(
    () => rows.map(() => ({ current: null as HTMLInputElement | null })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows.length],
  );

  const updateRow = (index: number, patch: Partial<CertificationEntry>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeRow = (index: number) =>
    onChange(rows.filter((_, i) => i !== index));

  const handleImageUpload = async (index: number, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const uploaded = await uploadFormFile(file, { token, fieldKey: "certifications" });
    const current = rows[index];
    if (!current) return;
    const images = [...(current.images ?? [])];
    if (images.length < 2) images.push({ url: uploaded.url, name: uploaded.name });
    updateRow(index, { images });
  };

  const removeImage = (rowIndex: number, imgIndex: number) => {
    const current = rows[rowIndex];
    if (!current) return;
    updateRow(rowIndex, {
      images: current.images.filter((_, i) => i !== imgIndex),
    });
  };

  return (
    <div className="space-y-2">
      <Label>Certifications &amp; awards (optional)</Label>
      <p className="text-xs text-muted-foreground">
        Label, link, and up to 2 badge images per certification.
      </p>
      {rows.map((row, index) => {
        const canAddImage = row.images.length < 2;
        return (
          <div key={`cert-${index}`} className="flex items-center gap-2">
            <Input
              value={row.label}
              placeholder="BBB A+, GAF Certified…"
              className="w-36 shrink-0"
              onChange={(e) => updateRow(index, { label: e.target.value })}
            />
            <Input
              value={row.url}
              placeholder="https://bbb.org/…"
              className="min-w-0 flex-1"
              onChange={(e) => updateRow(index, { url: e.target.value })}
            />
            {row.images.map((img, imgIndex) => (
              <div key={img.url} className="relative shrink-0">
                <img
                  src={img.url}
                  alt={img.name}
                  className="size-8 rounded border object-contain"
                />
                <button
                  type="button"
                  aria-label="Remove image"
                  className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                  onClick={() => removeImage(index, imgIndex)}
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
            {canAddImage ? (
              <>
                <input
                  ref={(el) => { if (fileInputRefs[index]) fileInputRefs[index].current = el; }}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.svg"
                  className="hidden"
                  onChange={(e) => void handleImageUpload(index, e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground"
                  aria-label="Upload badge image"
                  onClick={() => fileInputRefs[index]?.current?.click()}
                >
                  <ImageIcon className="size-4" />
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove certification"
              onClick={() => removeRow(index)}
            >
              <X className="size-4" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { label: "", url: "", images: [] }])}
      >
        <Plus className="size-4" />
        Add certification
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
  const saved = parseBusinessHoursEntries(value);

  type DayState = { enabled: boolean; open: string; close: string };
  const [days, setDays] = useState<Record<string, DayState>>(() => {
    const map: Record<string, DayState> = {};
    for (const option of DAY_OPTIONS) {
      const entry = saved.find((e) => e.day === option.value);
      map[option.value] = entry
        ? { enabled: true, open: entry.open, close: entry.close }
        : { enabled: false, open: "08:00", close: "17:00" };
    }
    return map;
  });

  const commit = (next: Record<string, DayState>) => {
    const entries = DAY_OPTIONS.filter((o) => next[o.value]?.enabled).map(
      (o) => ({ day: o.value, open: next[o.value]!.open, close: next[o.value]!.close }),
    );
    onChange(serializeBusinessHours(entries));
  };

  const update = (day: string, patch: Partial<DayState>) => {
    const next = { ...days, [day]: { ...days[day]!, ...patch } };
    setDays(next);
    commit(next);
  };

  return (
    <div className="space-y-2">
      <Label>Business hours</Label>
      <div className="divide-y rounded-md border">
        {DAY_OPTIONS.map((option) => {
          const state = days[option.value]!;
          return (
            <div
              key={option.value}
              className="flex items-center gap-3 px-3 py-2"
            >
              <input
                type="checkbox"
                id={`bh-${option.value}`}
                checked={state.enabled}
                className="size-4 shrink-0 accent-primary"
                onChange={(e) => update(option.value, { enabled: e.target.checked })}
              />
              <label
                htmlFor={`bh-${option.value}`}
                className={`w-8 shrink-0 text-sm font-medium ${state.enabled ? "" : "text-muted-foreground"}`}
              >
                {option.label}
              </label>
              {state.enabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={state.open}
                    className="h-8 w-28 text-sm"
                    onChange={(e) => update(option.value, { open: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={state.close}
                    className="h-8 w-28 text-sm"
                    onChange={(e) => update(option.value, { close: e.target.value })}
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Closed</span>
              )}
            </div>
          );
        })}
      </div>
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

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1939 }, (_, i) => CURRENT_YEAR - i);

const YearSelectField = ({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: number | null) => void;
}) => {
  const year = value != null && Number(value) > 0 ? String(Number(value)) : "";
  return (
    <div className="space-y-2">
      <Label>Year the company was founded</Label>
      <Select
        value={year}
        onValueChange={(v) => onChange(v === "__none__" ? null : Number(v))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select year…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Not sure —</SelectItem>
          {YEAR_OPTIONS.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const parseChips = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const ChipInput = ({
  label,
  value,
  placeholder,
  helpText,
  onChange,
}: {
  label: string;
  value: unknown;
  placeholder?: string;
  helpText?: string;
  onChange: (next: string[]) => void;
}) => {
  const chips = parseChips(value);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed || chips.includes(trimmed)) { setDraft(""); return; }
    onChange([...chips, trimmed]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      <Input
        value={draft}
        placeholder={placeholder ?? "Type and press Enter…"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
          if (e.key === "Backspace" && !draft && chips.length > 0) {
            onChange(chips.slice(0, -1));
          }
        }}
        onBlur={commit}
      />
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span key={chip} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
              {chip}
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onChange(chips.filter((c) => c !== chip))}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const parseBulletList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    return value.split("\n").map((s) => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  }
  return [];
};

const BulletListField = ({
  label,
  value,
  placeholder,
  addLabel,
  helpText,
  onChange,
}: {
  label: string;
  value: unknown;
  placeholder?: string;
  addLabel?: string;
  helpText?: string;
  onChange: (next: string[]) => void;
}) => {
  const items = parseBulletList(value);
  const visibleItems = items.length > 0 ? items : [""];

  const update = (index: number, next: string) => {
    const arr = [...items];
    // expand if editing into the fallback slot
    while (arr.length <= index) arr.push("");
    arr[index] = next;
    onChange(arr);
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      <div className="space-y-2">
        {visibleItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="shrink-0 text-muted-foreground">•</span>
            <Input
              value={item}
              placeholder={placeholder}
              className="flex-1"
              onChange={(e) => update(index, e.target.value)}
            />
            {visibleItems.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(index)}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, ""])}
      >
        <Plus className="size-4" />
        {addLabel ?? "Add item"}
      </Button>
    </div>
  );
};

type ServicePreset = {
  label: string;
  services: string[];
  primaryService: string;
  insuranceClaims?: "Yes" | "No";
  acceptsXactimate?: "Yes" | "No";
  differentiators: string[];
  freeInspection?: boolean;
};

const SERVICE_PRESETS: ServicePreset[] = [
  {
    label: "Roofing Contractor",
    services: ["Roof Repairs", "Roof Replacements", "Gutter Cleaning", "Chimney Repairs", "Gutter Repairs"],
    primaryService: "Roof Replacements",
    insuranceClaims: "Yes",
    acceptsXactimate: "Yes",
    freeInspection: true,
    differentiators: [
      "Licensed & fully insured",
      "Free storm damage inspections",
      "Insurance claim specialists",
      "Financing available",
      "Lifetime workmanship warranty",
    ],
  },
  {
    label: "Siding Contractor",
    services: ["Siding Repairs", "Siding Replacements", "Vinyl Siding Installation", "Exterior Painting"],
    primaryService: "Siding Replacements",
    insuranceClaims: "Yes",
    freeInspection: true,
    differentiators: [
      "Manufacturer-certified installer",
      "Wide selection of colors & materials",
      "Free estimates",
      "Same-week scheduling",
    ],
  },
  {
    label: "Deck & Fence Contractor",
    services: ["Deck Repairs", "Deck Replacements", "New Deck Construction", "Composite Decking (Trex)", "Railing Systems"],
    primaryService: "New Deck Construction",
    differentiators: [
      "Custom design options",
      "Composite & wood options",
      "Licensed & insured",
      "5-year workmanship warranty",
    ],
  },
  {
    label: "Painting Contractor",
    services: ["Exterior Painting", "Interior Painting", "Power Washing"],
    primaryService: "Exterior Painting",
    differentiators: [
      "Premium paints (Sherwin-Williams)",
      "Same-day quotes",
      "Licensed & insured",
      "Free color consultation",
    ],
  },
  {
    label: "Gutter Specialist",
    services: ["Gutter Cleaning", "Gutter Repairs", "Gutter Replacements", "Gutter Installation"],
    primaryService: "Gutter Replacements",
    freeInspection: true,
    differentiators: [
      "Leaf-guard gutter systems available",
      "Same-day service available",
      "Licensed & insured",
      "Free estimates",
    ],
  },
];

const CATEGORY_BRANDS: Record<string, string[]> = {
  Roofing: [
    "GAF", "Owens Corning", "CertainTeed", "Atlas Roofing",
    "IKO", "TAMKO", "Malarkey", "Boral",
  ],
  Siding: [
    "James Hardie", "LP SmartSide", "Alside", "Ply Gem",
    "CertainTeed Siding", "Mastic", "Norandex",
  ],
  Painting: [
    "Sherwin-Williams", "Benjamin Moore", "PPG Paints",
    "Behr", "Valspar", "Dunn-Edwards",
  ],
  Gutters: [
    "Amerimax", "Spectra Metals", "Mueller", "LeafGuard", "K-Guard",
  ],
  "Decking & Fencing": [
    "Trex", "TimberTech", "Fiberon", "Azek", "Wolf Decking", "Deckorators",
  ],
  "General Home Improvements": [
    "3M", "DAP", "Quikrete", "USG", "James Hardie",
  ],
};

const getBrandsForCategories = (categories: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cat of categories.filter(Boolean)) {
    for (const brand of CATEGORY_BRANDS[cat] ?? []) {
      if (!seen.has(brand)) { seen.add(brand); result.push(brand); }
    }
  }
  return result;
};

const parseBrands = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [];
};

const BrandsField = ({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: unknown;
  onChange: (next: string[]) => void;
}) => {
  const available = getBrandsForCategories(categories);
  const selected = parseBrands(value);

  if (available.length === 0) return null;

  const toggle = (brand: string) => {
    onChange(
      selected.includes(brand)
        ? selected.filter((b) => b !== brand)
        : [...selected, brand],
    );
  };

  return (
    <div className="space-y-2">
      <Label>Brands / manufacturers you work with</Label>
      <p className="text-xs text-muted-foreground">
        Select the brands you prefer or are certified with.
      </p>
      <div className="flex flex-wrap gap-2">
        {available.map((brand) => {
          const active = selected.includes(brand);
          return (
            <button
              key={brand}
              type="button"
              onClick={() => toggle(brand)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/50 hover:bg-muted"
              }`}
            >
              {brand}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const CreatableMultiSelect = ({
  label,
  options,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const trimmed = search.trim();
  const filtered = options.filter((o) =>
    o.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const canCreate =
    trimmed.length > 0 &&
    !options.some((o) => o.toLowerCase() === trimmed.toLowerCase()) &&
    !value.some((v) => v.toLowerCase() === trimmed.toLowerCase());

  const toggle = (option: string) => {
    onChange(
      value.includes(option)
        ? value.filter((v) => v !== option)
        : [...value, option],
    );
  };

  const create = () => {
    if (!trimmed) return;
    onChange([...value, trimmed]);
    setSearch("");
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-left">
              {value.length === 0
                ? (placeholder ?? "Select…")
                : `${value.length} selected`}
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or add a service…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => toggle(option)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={`size-4 shrink-0 ${value.includes(option) ? "opacity-100" : "opacity-0"}`}
                    />
                    {option}
                  </CommandItem>
                ))}
                {canCreate ? (
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={create}
                    className="flex items-center gap-2 text-primary"
                  >
                    <Plus className="size-4 shrink-0" />
                    Add &ldquo;{trimmed}&rdquo;
                  </CommandItem>
                ) : null}
                {filtered.length === 0 && !canCreate ? (
                  <CommandEmpty>No results.</CommandEmpty>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs"
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => toggle(v)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const PrimaryServiceSelect = ({
  services,
  value,
  onChange,
}: {
  services: string[];
  value: string;
  onChange: (next: string) => void;
}) => {
  if (services.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Primary / most profitable service</Label>
        <Input
          value={value}
          placeholder="Your main service"
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Select services above to populate this list.
        </p>
      </div>
    );
  }

  const isCustom = value && !services.includes(value);

  return (
    <div className="space-y-2">
      <Label>Primary / most profitable service</Label>
      <Select
        value={isCustom ? "__custom__" : (value || "")}
        onValueChange={(next) => {
          if (next !== "__custom__") onChange(next === "__none__" ? "" : next);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Pick one…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— None —</SelectItem>
          {services.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

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
      {(() => {
        const videoField = getFieldDef(fields, "video_url");
        return videoField ? renderField(videoField, props) : null;
      })()}
    </div>
  );
};

const BRAND_STYLE_HANDLED = new Set([
  "brand_colors_option", "brand_color_1", "brand_color_2", "brand_color_3",
  "reference_sites", "site_exclusions",
]);

const BrandStyleSection = (props: BriefSectionProps) => {
  const { formSection, values, setField } = props;
  const fields = formSection.fields;
  const colorsField = getFieldDef(fields, "brand_colors_option");
  const exclusionsField = getFieldDef(fields, "site_exclusions");
  const extraFields = fields.filter((f) => !BRAND_STYLE_HANDLED.has(f.key));

  return (
    <div className="space-y-6">
      {extraFields.map((field) => renderField(field, props))}
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

const CATEGORY_PRESET_MAP: Record<string, ServicePreset> = Object.fromEntries(
  SERVICE_PRESETS.map((p) => [p.label, p]),
);

const ALL_PRESET_SERVICES = new Set(SERVICE_PRESETS.flatMap((p) => p.services));

const CATEGORY_OPTIONS = SERVICE_PRESETS.map((p) => p.label).concat("Other");

// Returns the union of sub-services for the given categories (preserving order).
const getServicesForCategories = (categories: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cat of categories) {
    for (const s of CATEGORY_PRESET_MAP[cat]?.services ?? []) {
      if (!seen.has(s)) { seen.add(s); result.push(s); }
    }
  }
  return result;
};

const parseCategories = (value: unknown): string[] => {
  // Keep empty strings — they represent pending "choose a specialty" slots in the UI.
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [""];
};

const ServicesSection = (props: BriefSectionProps) => {
  const { formSection, values, setField } = props;
  const visibleFields = getVisibleFields(formSection, values);
  const servicesField = visibleFields.find((f) => f.key === "services_offered");
  const primaryField = visibleFields.find((f) => f.key === "primary_service");
  const otherFields = visibleFields.filter(
    (f) =>
      f.key !== "service_categories" &&
      f.key !== "services_offered" &&
      f.key !== "primary_service",
  );

  // Parse categories — start with at least one empty slot
  const categories = parseCategories(
    (values.service_categories ?? values.service_category) as unknown,
  );

  const selectedServices = Array.isArray(values.services_offered)
    ? values.services_offered.map(String).filter(Boolean)
    : [];

  // Services that the user manually added (not from any preset)
  const customServices = selectedServices.filter((s) => !ALL_PRESET_SERVICES.has(s));

  // Options for the multi-select = sub-services from selected categories + custom ones already added
  const activeCategories = categories.filter(Boolean);
  const categoryServiceOptions =
    activeCategories.length > 0
      ? getServicesForCategories(activeCategories)
      : (servicesField?.options ?? []);

  const applyCategories = (newCats: string[]) => {
    setField("service_categories", newCats);
    const activeCats = newCats.filter(Boolean);
    const newPresetServices = getServicesForCategories(activeCats);
    // New services_offered = preset services + custom services already added
    setField("services_offered", [
      ...newPresetServices,
      ...customServices.filter((s) => !newPresetServices.includes(s)),
    ]);
    // Auto-fill from first category with a preset
    const firstPreset = activeCats.map((c) => CATEGORY_PRESET_MAP[c]).find(Boolean);
    if (firstPreset) {
      setField("primary_service", firstPreset.primaryService);
      if (firstPreset.insuranceClaims) setField("insurance_claims", firstPreset.insuranceClaims);
      if (firstPreset.acceptsXactimate) setField("accepts_xactimate", firstPreset.acceptsXactimate);
      if (firstPreset.freeInspection) setField("free_offers", ["Free inspection", "Free estimate"]);
    }
  };

  const updateCategory = (index: number, newCat: string) => {
    const next = [...categories];
    next[index] = newCat;
    applyCategories(next);
  };

  const removeCategory = (index: number) => {
    const next = categories.filter((_, i) => i !== index);
    applyCategories(next.length > 0 ? next : [""]);
  };

  const addCategory = () => {
    applyCategories([...categories, ""]);
  };

  return (
    <>
      <div className="space-y-2">
        <Label>What type of contractor are you?</Label>
        <p className="text-xs text-muted-foreground">
          Select your specialty — sub-services will auto-fill below.
        </p>
        {categories.map((cat, i) => (
          <div key={i} className="flex gap-2">
            <Select
              value={cat}
              onValueChange={(next) => updateCategory(i, next)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select specialty…" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeCategory(i)}
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
          onClick={addCategory}
          disabled={categories[categories.length - 1] === ""}
        >
          <Plus className="size-4" />
          Add another specialty
        </Button>
      </div>

      {servicesField ? (
        <CreatableMultiSelect
          label={servicesField.label ?? "Services offered"}
          options={categoryServiceOptions}
          value={selectedServices}
          placeholder="Select or add services…"
          onChange={(next) => setField("services_offered", next)}
        />
      ) : null}

      <BrandsField
        categories={activeCategories}
        value={values.brands_used}
        onChange={(next) => setField("brands_used", next)}
      />

      {primaryField ? (
        <PrimaryServiceSelect
          services={selectedServices}
          value={String(values.primary_service ?? "")}
          onChange={(next) => setField("primary_service", next)}
        />
      ) : null}

      {otherFields.map((field) => renderField(field, props))}
    </>
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
    return (
      <>
        <YearSelectField
          value={values.company_founded_year}
          onChange={(next) => setField("company_founded_year", next)}
        />
        {visibleFields
          .filter(
            (f) =>
              f.key !== "company_founded_year" &&
              f.key !== "years_experience" &&
              f.key !== "service_areas" &&
              f.key !== "certifications" &&
              f.key !== "business_hours",
          )
          .map((field) => renderField(field, props))}
        <ChipInput
          label="Service areas / cities you work in"
          value={values.service_areas}
          placeholder="e.g. Dallas, Plano, Frisco…"
          helpText="Press Enter or comma after each city."
          onChange={(next) => setField("service_areas", next)}
        />
        <CertificationsField
          value={values.certifications}
          token={props.token}
          onChange={(next) => setField("certifications", next)}
        />
        <BusinessHoursField
          value={values.business_hours}
          onChange={(next) => setField("business_hours", next)}
        />
      </>
    );
  }

  if (section.id === "web_content") {
    const bulletKeys = new Set(["warranties_guarantees", "differentiators"]);
    return (
      <>
        {visibleFields
          .filter((f) => !bulletKeys.has(f.key))
          .map((field) => renderField(field, props))}
        <BulletListField
          label="Warranties you offer"
          value={values.warranties_guarantees}
          placeholder="e.g. 10-year materials warranty…"
          addLabel="Add warranty"
          onChange={(next) => setField("warranties_guarantees", next)}
        />
        <BulletListField
          label="What makes you different from competitors?"
          value={values.differentiators}
          placeholder="e.g. Family-owned since 1998, lifetime workmanship guarantee…"
          addLabel="Add differentiator"
          helpText="3–5 bullet points."
          onChange={(next) => setField("differentiators", next)}
        />
      </>
    );
  }

  if (section.id === "services") {
    return <ServicesSection {...props} />;
  }

  if (section.id === "visual_content") {
    return <VisualContentSection {...props} />;
  }

  if (section.id === "brand_style") {
    return <BrandStyleSection {...props} />;
  }

  return <>{visibleFields.map((field) => renderField(field, props))}</>;
};
