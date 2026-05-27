import { useEffect, useState, type ReactNode } from "react";
import { FieldTitle, useInput, useResourceContext, type InputProps } from "ra-core";
import { Loader2, MapPin } from "lucide-react";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { Input } from "@/components/ui/input";
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
  const [suggestions, setSuggestions] = useState<
    Array<{ placeId: string; text: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const query = String(field.value ?? "").trim();
  const placesEnabled = isGooglePlacesEnabled();
  const canShowSuggestions = placesEnabled && query.length >= 3;

  useEffect(() => {
    if (!placesEnabled || query.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      setFetchError(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setFetchError(false);
      try {
        const next = await fetchPlacesAutocomplete(query, mode, controller.signal);
        setSuggestions(next);
        setFetchError(next.length === 0);
      } catch {
        setSuggestions([]);
        setFetchError(true);
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
    const displayValue =
      mode === "business" ? item.text.split(",")[0]?.trim() || item.text : item.text;
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
      ? "Busca el negocio en Google…"
      : "Busca la dirección en Google…";

  const panelContent = (
    <>
      {suggestionHeader}
      {suggestionHeader ? <div className="my-2 border-t" /> : null}
      <div className="mb-1 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <MapPin className="size-3" />
        Sugerencias de Google
      </div>
      {isLoading ? (
        <div className="px-2 py-1.5 text-xs text-muted-foreground">Buscando…</div>
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
          {fetchError
            ? "Sin resultados. Si ves 403 en consola, habilita Places API (New) y Places API en Google Cloud."
            : "Escribe al menos 3 caracteres."}
        </div>
      )}
    </>
  );

  return (
    <FormField id={id} name={field.name} className={className}>
      {label !== false ? (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      ) : null}
      <FormControl>
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
                  placeholder={placeholder ?? defaultPlaceholder}
                  className="min-h-9 max-h-24 resize-y py-2 leading-snug"
                  onFocus={() => {
                    if (canShowSuggestions) setOpen(true);
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
              ) : (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  disabled={disabled || isFetchingDetails}
                  readOnly={readOnly}
                  placeholder={placeholder ?? defaultPlaceholder}
                  onFocus={() => {
                    if (canShowSuggestions) setOpen(true);
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
                <Loader2 className="pointer-events-none absolute top-2.5 right-2 size-4 animate-spin text-muted-foreground" />
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
      </FormControl>
      <InputHelperText
        helperText={
          helperText ??
          (placesEnabled
            ? mode === "business"
              ? "Elige un resultado para autocompletar web, teléfono y dirección."
              : "Elige una dirección o escribe manualmente."
            : "Añade VITE_GOOGLE_PLACES_API_KEY en .env y reinicia Vite.")
        }
      />
      <FormError />
    </FormField>
  );
};
