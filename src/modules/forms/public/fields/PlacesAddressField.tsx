import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  FloatingFieldShell,
  floatingFieldControlClassName,
  floatingFieldPlaceholder,
} from "@/components/ui/floating-field";
import { cn } from "@/lib/utils";
import {
  enrichPlaceSuggestionsWithAddresses,
  fetchPlacesAutocomplete,
  isGooglePlacesEnabled,
  type GooglePlaceSuggestion,
} from "@/lib/googlePlaces";

/** Controlled address field with Google Places suggestions (public forms). */
export const PlacesAddressField = ({
  id: idProp,
  label = "Business address",
  value,
  onChange,
  required,
  disabled,
}: {
  id?: string;
  label?: string;
  value: unknown;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
}) => {
  const autoId = useId();
  const id = idProp ?? autoId;
  const parentValue = value == null ? "" : String(value);

  // Local draft keeps typing stable (avoids reversed digits when the popover opens).
  const [draft, setDraft] = useState(parentValue);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(false);

  const placesEnabled = isGooglePlacesEnabled();
  const trimmed = draft.trim();
  const active = focused || draft.trim().length > 0;

  // Sync from parent only when not focused (e.g. form prefill / external reset).
  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(parentValue);
    }
  }, [parentValue]);

  useEffect(() => {
    if (!placesEnabled || trimmed.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      void fetchPlacesAutocomplete(trimmed, "address", controller.signal)
        .then((results) =>
          enrichPlaceSuggestionsWithAddresses(results, controller.signal),
        )
        .then((results) => {
          if (controller.signal.aborted) return;
          setSuggestions(results);
          setOpen(results.length > 0 && focusedRef.current);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [placesEnabled, trimmed]);

  const selectSuggestion = (item: GooglePlaceSuggestion) => {
    setIsFetchingDetails(true);
    const next = item.text;
    setDraft(next);
    onChange(next);
    setOpen(false);
    setSuggestions([]);
    setIsFetchingDetails(false);
    // Keep focus without remounting; move caret to end on next tick
    window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const len = next.length;
      el.setSelectionRange(len, len);
    });
  };

  const handleChange = (next: string) => {
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="relative w-full">
      <FloatingFieldShell
        active={active}
        label={label}
        htmlFor={id}
        required={required}
        className="pr-9"
      >
        <Input
          ref={inputRef}
          id={id}
          value={draft}
          disabled={disabled}
          className={cn(floatingFieldControlClassName, "pl-9")}
          placeholder={floatingFieldPlaceholder(
            active,
            placesEnabled ? "Address or ZIP code…" : "Street, city, or ZIP",
          )}
          autoComplete="off"
          spellCheck={false}
          onFocus={() => {
            focusedRef.current = true;
            setFocused(true);
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            // Delay so suggestion mousedown can fire first
            window.setTimeout(() => {
              focusedRef.current = false;
              setFocused(false);
              setOpen(false);
            }, 150);
          }}
          onChange={(event) => handleChange(event.target.value)}
        />
      </FloatingFieldShell>
      <MapPin className="pointer-events-none absolute top-1/2 left-3 z-20 size-4 -translate-y-1/2 text-muted-foreground" />
      {isLoading || isFetchingDetails ? (
        <Loader2 className="absolute top-1/2 right-3 z-20 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}

      {/* Anchor sits under the field so opening the popover never remounts the input */}
      <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="h-0 w-full" aria-hidden />
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-1"
          align="start"
          side="bottom"
          sideOffset={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <ul className="max-h-56 overflow-auto">
            {suggestions.map((item) => (
              <li key={item.placeId}>
                <button
                  type="button"
                  className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectSuggestion(item);
                  }}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
};
