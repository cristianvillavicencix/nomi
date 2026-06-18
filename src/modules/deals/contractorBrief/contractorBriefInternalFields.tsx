import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  fetchGooglePlaceDetails,
  fetchPlacesAutocomplete,
  isGooglePlacesEnabled,
  type GooglePlaceDetails,
} from "@/lib/googlePlaces";

const parseChips = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const formatServiceAreaLabel = (details: GooglePlaceDetails) => {
  const parts = [details.city, details.stateAbbr, details.zipcode].filter(
    Boolean,
  );
  if (parts.length) return parts.join(", ");
  return details.formattedAddress.trim();
};

export const ServiceAreasPlacesInput = ({
  value,
  onChange,
  label = "Service areas / cities you work in",
  helpText = "Search a city or ZIP, then add it to your list.",
}: {
  value: unknown;
  onChange: (next: string[]) => void;
  label?: string;
  helpText?: string;
}) => {
  const chips = parseChips(value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{ placeId: string; text: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const placesEnabled = isGooglePlacesEnabled();
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!placesEnabled || trimmedQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    void fetchPlacesAutocomplete(trimmedQuery, "address", controller.signal)
      .then((results) => setSuggestions(results))
      .catch(() => setSuggestions([]))
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [placesEnabled, trimmedQuery]);

  const addArea = (labelText: string) => {
    const next = labelText.trim();
    if (!next || chips.includes(next)) return;
    onChange([...chips, next]);
    setQuery("");
    setOpen(false);
    setSuggestions([]);
  };

  const selectSuggestion = async (placeId: string) => {
    setIsFetchingDetails(true);
    try {
      const details = await fetchGooglePlaceDetails(placeId);
      addArea(formatServiceAreaLabel(details));
    } catch {
      const fallback = suggestions.find((item) => item.placeId === placeId)?.text;
      if (fallback) addArea(fallback);
    } finally {
      setIsFetchingDetails(false);
    }
  };

  return (
    <div className="space-y-2 md:col-span-2">
      <Label>{label}</Label>
      {helpText ? (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      ) : null}

      <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              placeholder={
                placesEnabled
                  ? "Search city, state, or ZIP…"
                  : "Type city, state, ZIP and press Enter"
              }
              className="pl-9"
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (trimmedQuery) addArea(trimmedQuery);
                }
              }}
              onFocus={() => setOpen(true)}
            />
            {isLoading || isFetchingDetails ? (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-1"
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {suggestions.map((item) => (
            <button
              key={item.placeId}
              type="button"
              className="flex w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void selectSuggestion(item.placeId)}
            >
              {item.text}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs"
            >
              {chip}
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onChange(chips.filter((entry) => entry !== chip))}
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

export const TagAddField = ({
  label,
  value,
  onChange,
  placeholder,
  helpText,
}: {
  label: string;
  value: unknown;
  onChange: (next: string[]) => void;
  placeholder?: string;
  helpText?: string;
}) => {
  const tags = parseChips(value);
  const [draft, setDraft] = useState("");

  const addTag = () => {
    const next = draft.trim();
    if (!next || tags.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...tags, next]);
    setDraft("");
  };

  return (
    <div className="space-y-2 md:col-span-2">
      <Label>{label}</Label>
      {helpText ? (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder ?? "Type and press Add"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addTag}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onChange(tags.filter((entry) => entry !== tag))}
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

const WEEKDAYS = [
  { value: "Monday", label: "Monday", short: "Mon" },
  { value: "Tuesday", label: "Tuesday", short: "Tue" },
  { value: "Wednesday", label: "Wednesday", short: "Wed" },
  { value: "Thursday", label: "Thursday", short: "Thu" },
  { value: "Friday", label: "Friday", short: "Fri" },
] as const;

type HourEntry = { day: string; open: string; close: string };

const parseBusinessHours = (value: unknown): HourEntry[] => {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parseBusinessHours(parsed);
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        if (Array.isArray(record.entries)) return parseBusinessHours(record.entries);
      }
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is HourEntry =>
        entry != null &&
        typeof entry === "object" &&
        "day" in entry &&
        "open" in entry &&
        "close" in entry,
    );
  }
  return [];
};

const serializeBusinessHours = (entries: HourEntry[]) =>
  JSON.stringify({
    entries,
    _label: entries
      .map((entry) => {
        const short =
          WEEKDAYS.find((day) => day.value === entry.day)?.short ??
          entry.day.slice(0, 3);
        return `${short} ${entry.open}-${entry.close}`;
      })
      .join(", "),
  });

export const WeekdayBusinessHoursField = ({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: string) => void;
}) => {
  const saved = parseBusinessHours(value);
  const [rows, setRows] = useState(() => {
    const monday = saved.find((entry) => entry.day === "Monday");
    return {
      Monday: monday ?? { day: "Monday", open: "08:00", close: "17:00" },
      extraDays: saved
        .filter((entry) => entry.day !== "Monday")
        .map((entry) => entry.day),
      schedules: Object.fromEntries(
        WEEKDAYS.map((day) => {
          const match = saved.find((entry) => entry.day === day.value);
          return [
            day.value,
            {
              open: match?.open ?? "08:00",
              close: match?.close ?? "17:00",
            },
          ];
        }),
      ) as Record<string, { open: string; close: string }>,
    };
  });

  const commit = (
    nextSchedules: Record<string, { open: string; close: string }>,
    visibleDays: string[],
  ) => {
    const entries = visibleDays.map((day) => ({
      day,
      open: nextSchedules[day]?.open ?? "08:00",
      close: nextSchedules[day]?.close ?? "17:00",
    }));
    onChange(serializeBusinessHours(entries));
  };

  const visibleDays = ["Monday", ...rows.extraDays];
  const nextHiddenDay = WEEKDAYS.find(
    (day) => day.value !== "Monday" && !rows.extraDays.includes(day.value),
  );

  const updateTime = (
    day: string,
    patch: Partial<{ open: string; close: string }>,
  ) => {
    const nextSchedules = {
      ...rows.schedules,
      [day]: { ...rows.schedules[day]!, ...patch },
    };
    setRows((current) => ({ ...current, schedules: nextSchedules }));
    commit(nextSchedules, visibleDays);
  };

  const addDay = () => {
    if (!nextHiddenDay) return;
    const nextExtra = [...rows.extraDays, nextHiddenDay.value];
    setRows((current) => ({ ...current, extraDays: nextExtra }));
    commit(rows.schedules, ["Monday", ...nextExtra]);
  };

  const removeDay = (day: string) => {
    const nextExtra = rows.extraDays.filter((entry) => entry !== day);
    setRows((current) => ({ ...current, extraDays: nextExtra }));
    commit(rows.schedules, ["Monday", ...nextExtra]);
  };

  return (
    <div className="space-y-2 md:col-span-2">
      <Label>Business hours</Label>
      <p className="text-xs text-muted-foreground">
        Monday is shown by default. Add Tuesday through Friday as needed.
      </p>
      <div className="divide-y rounded-md border">
        {visibleDays.map((day) => {
          const meta = WEEKDAYS.find((entry) => entry.value === day);
          const schedule = rows.schedules[day]!;
          return (
            <div key={day} className="flex items-center gap-3 px-3 py-2">
              <span className="w-24 shrink-0 text-sm font-medium">
                {meta?.label ?? day}
              </span>
              <Input
                type="time"
                value={schedule.open}
                className="h-8 w-28 text-sm"
                onChange={(event) =>
                  updateTime(day, { open: event.target.value })
                }
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="time"
                value={schedule.close}
                className="h-8 w-28 text-sm"
                onChange={(event) =>
                  updateTime(day, { close: event.target.value })
                }
              />
              {day !== "Monday" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-8"
                  aria-label={`Remove ${day}`}
                  onClick={() => removeDay(day)}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      {nextHiddenDay ? (
        <Button type="button" variant="outline" size="sm" onClick={addDay}>
          <Plus className="size-4" />
          Add {nextHiddenDay.label}
        </Button>
      ) : null}
    </div>
  );
};

export const YesNoToggleField = ({
  label,
  value,
  onChange,
  helpText,
}: {
  label: string;
  value: unknown;
  onChange: (next: string) => void;
  helpText?: string;
}) => {
  const current = String(value ?? "").trim();
  const options = ["Yes", "No"] as const;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {helpText ? (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      ) : null}
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              current === option
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

const CONTACT_METHODS = [
  { id: "Phone call", label: "Phone", numberKey: "business_phone" },
  { id: "SMS / text", label: "SMS", numberKey: "business_phone" },
  { id: "WhatsApp", label: "WhatsApp", numberKey: "whatsapp_business" },
  { id: "Email", label: "Email", numberKey: "form_notification_email" },
  { id: "Website form", label: "Website form", numberKey: "form_notification_email" },
] as const;

export const ContactReachField = ({
  values,
  onChangeMethods,
  onChangeField,
}: {
  values: Record<string, unknown>;
  onChangeMethods: (next: string[]) => void;
  onChangeField: (key: string, value: string) => void;
}) => {
  const selected = parseChips(values.preferred_contact_methods);
  const fallbackPhone = String(
    values.business_phone ?? values.contact_phone ?? "",
  ).trim();
  const fallbackEmail = String(
    values.business_email ?? values.contact_email ?? "",
  ).trim();

  const toggle = (methodId: string) => {
    const next = selected.includes(methodId)
      ? selected.filter((entry) => entry !== methodId)
      : [...selected, methodId];
    onChangeMethods(next);

    if (!selected.includes(methodId)) {
      const meta = CONTACT_METHODS.find((entry) => entry.id === methodId);
      if (!meta) return;
      const current = String(values[meta.numberKey] ?? "").trim();
      if (current) return;
      if (meta.numberKey === "form_notification_email" && fallbackEmail) {
        onChangeField(meta.numberKey, fallbackEmail);
      } else if (meta.numberKey !== "form_notification_email" && fallbackPhone) {
        onChangeField(meta.numberKey, fallbackPhone);
      }
    }
  };

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="space-y-2">
        <Label>How should customers reach you?</Label>
        <p className="text-xs text-muted-foreground">
          Pick the channels you want on the site. We&apos;ll auto-fill numbers
          from the contact on file when available.
        </p>
        <div className="flex flex-wrap gap-2">
          {CONTACT_METHODS.map((method) => {
            const active = selected.includes(method.id);
            return (
              <button
                key={method.id}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground",
                )}
                onClick={() => toggle(method.id)}
              >
                {method.label}
              </button>
            );
          })}
        </div>
      </div>

      {selected.some((entry) =>
        ["Phone call", "SMS / text"].includes(entry),
      ) ? (
        <div className="space-y-2">
          <Label htmlFor="business_phone">Phone number</Label>
          <Input
            id="business_phone"
            value={String(values.business_phone ?? fallbackPhone)}
            placeholder="(555) 555-5555"
            onChange={(event) =>
              onChangeField("business_phone", event.target.value)
            }
          />
        </div>
      ) : null}

      {selected.includes("WhatsApp") ? (
        <div className="space-y-2">
          <Label htmlFor="whatsapp_business">WhatsApp number</Label>
          <Input
            id="whatsapp_business"
            value={String(values.whatsapp_business ?? fallbackPhone)}
            placeholder="(555) 555-5555"
            onChange={(event) =>
              onChangeField("whatsapp_business", event.target.value)
            }
          />
        </div>
      ) : null}

      {selected.some((entry) => ["Email", "Website form"].includes(entry)) ? (
        <div className="space-y-2">
          <Label htmlFor="form_notification_email">Email for leads</Label>
          <Input
            id="form_notification_email"
            type="email"
            value={String(values.form_notification_email ?? fallbackEmail)}
            placeholder="leads@company.com"
            onChange={(event) =>
              onChangeField("form_notification_email", event.target.value)
            }
          />
        </div>
      ) : null}
    </div>
  );
};

export const BrandColorsField = ({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, value: string) => void;
}) => (
  <div className="grid gap-4 rounded-md border p-3 sm:grid-cols-3 md:col-span-2">
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
          onChange={(event) => onChange(key, event.target.value)}
        />
        <Label htmlFor={key} className="text-xs text-muted-foreground">
          {label}
        </Label>
      </div>
    ))}
  </div>
);
