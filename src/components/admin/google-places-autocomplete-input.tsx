import { useEffect, useState, type ReactNode } from "react";
import {
  FieldTitle,
  useInput,
  useResourceContext,
  type InputProps,
} from "ra-core";
import { Loader2, MapPin } from "lucide-react";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { Input } from "@/components/ui/input";
import { FloatingFieldShell, floatingFieldPlaceholder } from "@/components/ui/floating-field";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  fetchGooglePlaceDetails,
  fetchPlacesAutocomplete,
  GooglePlacesUnavailableError,
  isGooglePlacesEnabled,
  type GooglePlaceDetails,
  type GooglePlacesAutocompleteMode,
} from "@/lib/googlePlaces";

export type GooglePlacesAutocompleteInputProps = Omit<InputProps, "source"> &
  Pick<InputProps, "source"> & {
    mode: GooglePlacesAutocompleteMode;
    onPlaceDetails?: (details: GooglePlaceDetails) => void;
    onManualChange?: () => void;
    placeholder?: string;
    multiline?: boolean;
    className?: string;
    suggestionHeader?: ReactNode;
    disabled?: boolean;
    readOnly?: boolean;
    labelVariant?: "default" | "floating";
  };

export const GooglePlacesAutocompleteInput = ({
  source,
  label,
  helperText,
  validate,
  mode,
  onPlaceDetails,
  onManualChange,
  placeholder,
  multiline = false,
  className,
  suggestionHeader,
  disabled,
  readOnly,
  labelVariant = "default",
}: GooglePlacesAutocompleteInputProps) => {
  const resource = useResourceContext({ source });
  const { id, field, isRequired } = useInput({
    source,
    label,
    helperText,
    validate,
    disabled,
    readOnly,
  });

  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{ placeId: string; text: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const query = String(field.value ?? "").trim();
  const placesEnabled = isGooglePlacesEnabled();
  const canShowSuggestions = placesEnabled && query.length >= 3;

  useEffect(() => {
    if (!placesEnabled || query.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      setFetchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const next = await fetchPlacesAutocomplete(
          query,
          mode,
          controller.signal,
        );
        setSuggestions(next);
        setFetchError(
          next.length === 0 ? "No Google results for this search." : null,
        );
      } catch (error) {
        setSuggestions([]);
        if (error instanceof GooglePlacesUnavailableError) {
          setFetchError(error.message);
        } else {
          setFetchError(
            "Could not reach Google Places. You can still type manually.",
          );
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, mode, placesEnabled]);

  const handlePick = async (item: { placeId: string; text: string }) => {
    const displayValue = item.text.split(",")[0]?.trim() || item.text;
    field.onChange(displayValue);
    setOpen(false);

    if (!onPlaceDetails) return;

    setIsFetchingDetails(true);
    try {
      const details = await fetchGooglePlaceDetails(item.placeId);
      if (details) {
        onPlaceDetails(details);
      }
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const defaultPlaceholder =
    mode === "business"
      ? "Search for a business on Google…"
      : "Search for an address on Google…";

  const panelContent = (
    <>
      {suggestionHeader}
      {suggestionHeader ? <div className="my-2 border-t" /> : null}
      <div className="mb-1 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <MapPin className="size-3" />
        Google suggestions
      </div>
      {isLoading ? (
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Searching…
        </div>
      ) : suggestions.length > 0 ? (
        suggestions.map((item) => (
          <button
            key={item.placeId}
            type="button"
            className="mb-0.5 block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60"
            onMouseDown={(event) => {
              event.preventDefault();
              void handlePick(item);
            }}
          >
            {item.text}
          </button>
        ))
      ) : (
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {fetchError ??
            (query.length >= 3
              ? "No results. You can keep typing manually."
              : "Type at least 3 characters.")}
        </div>
      )}
    </>
  );

  const useFloating = labelVariant === "floating" && label !== false;
  const floatingActive = focused || open || String(field.value ?? "").length > 0;
  const inputPlaceholder = useFloating
    ? floatingFieldPlaceholder(floatingActive, placeholder ?? defaultPlaceholder)
    : (placeholder ?? defaultPlaceholder);

  const fieldControl = (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverAnchor asChild>
        <div className="relative w-full">
          {multiline ? (
            <Textarea
              {...field}
              value={field.value ?? ""}
              disabled={disabled || isFetchingDetails}
              readOnly={readOnly}
              rows={2}
              placeholder={inputPlaceholder}
              className={cn(
                "max-h-24 min-h-9 resize-y py-2 leading-snug",
                useFloating &&
                  "min-h-[5.5rem] rounded-md border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0",
              )}
              onFocus={() => {
                setFocused(true);
                if (canShowSuggestions) setOpen(true);
              }}
              onBlur={() => setFocused(false)}
              onChange={(event) => {
                field.onChange(event.target.value);
                onManualChange?.();
                if (event.target.value.trim().length >= 3) {
                  setOpen(true);
                } else {
                  setOpen(false);
                }
              }}
            />
          ) : (
            <Input
              {...field}
              value={field.value ?? ""}
              disabled={disabled || isFetchingDetails}
              readOnly={readOnly}
              placeholder={inputPlaceholder}
              className={cn(
                useFloating &&
                  "h-9 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0",
              )}
              onFocus={() => {
                setFocused(true);
                if (canShowSuggestions) setOpen(true);
              }}
              onBlur={() => {
                setFocused(false);
                field.onBlur();
              }}
              onChange={(event) => {
                field.onChange(event.target.value);
                onManualChange?.();
                if (event.target.value.trim().length >= 3) {
                  setOpen(true);
                } else {
                  setOpen(false);
                }
              }}
            />
          )}
          {isFetchingDetails ? (
            <Loader2
              className={cn(
                "pointer-events-none absolute right-2 size-4 animate-spin text-muted-foreground",
                useFloating ? "top-2.5" : "top-2.5",
              )}
            />
          ) : null}
        </div>
      </PopoverAnchor>
      {open && canShowSuggestions ? (
        <PopoverContent
          className="max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-2"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {panelContent}
        </PopoverContent>
      ) : null}
    </Popover>
  );

  const labelNode =
    label !== false ? (
      <FieldTitle
        label={label}
        source={source}
        resource={resource}
        isRequired={useFloating ? false : isRequired}
      />
    ) : null;

  return (
    <FormField
      id={id}
      name={field.name}
      className={cn(useFloating && "gap-1.5", className)}
    >
      {useFloating ? (
        <FloatingFieldShell
          active={floatingActive}
          label={labelNode}
          htmlFor={id}
          required={isRequired}
          labelAlign={multiline ? "top" : "center"}
          className={multiline ? "min-h-[5.5rem] items-stretch" : undefined}
        >
          <FormControl>{fieldControl}</FormControl>
        </FloatingFieldShell>
      ) : (
        <>
          {labelNode ? <FormLabel>{labelNode}</FormLabel> : null}
          <FormControl>{fieldControl}</FormControl>
        </>
      )}
      <InputHelperText
        helperText={
          helperText ??
          (placesEnabled
            ? mode === "business"
              ? "Pick a result to fill website, phone, and address."
              : "Pick an address or type manually."
            : "Add VITE_GOOGLE_PLACES_API_KEY to .env and restart Vite.")
        }
      />
      <FormError />
    </FormField>
  );
};
