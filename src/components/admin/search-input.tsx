import { useCallback } from "react";
import { useTranslate } from "ra-core";
import { useWatch, useFormContext } from "react-hook-form";
import { Search, X } from "lucide-react";
import type { TextInputProps } from "@/components/admin/text-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Text input with a search icon on the left and clear (X) when there is text.
 *
 * It automatically uses the 'q' source for full-text search by default.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/searchinput/ SearchInput documentation}
 */
export const SearchInput = (inProps: SearchInputProps) => {
  const { label, className, disableClearable, source = "q", ...rest } = inProps;

  const translate = useTranslate();
  const { setValue } = useFormContext();
  const fieldValue = useWatch({ name: source });
  const hasValue = fieldValue && fieldValue !== "";

  const handleClear = useCallback(() => {
    setValue(source, "", { shouldDirty: true });
  }, [setValue, source]);

  if (label) {
    throw new Error(
      "<SearchInput> isn't designed to be used with a label prop. Use <TextInput> if you need a label.",
    );
  }

  const showClearButton = !disableClearable && hasValue;

  return (
    <div className="relative mt-auto flex flex-grow">
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <TextInput
        source={source}
        label={false}
        helperText={false}
        placeholder={translate("ra.action.search")}
        className={cn("flex-grow", className)}
        inputClassName={cn("pl-9", showClearButton ? "pr-9" : undefined)}
        {...rest}
      />
      {showClearButton ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute top-1/2 right-2 z-10 h-6 w-6 -translate-y-1/2 rounded-full p-0 text-muted-foreground"
          aria-label={translate("ra.action.clear_search", {
            _: "Clear search",
          })}
        >
          <X className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  );
};

export type SearchInputProps = TextInputProps & {
  disableClearable?: boolean;
};
