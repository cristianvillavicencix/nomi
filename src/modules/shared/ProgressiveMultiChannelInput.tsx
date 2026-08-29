import { useEffect, useMemo } from "react";
import type { ClipboardEventHandler, FocusEvent } from "react";
import { Star, X } from "lucide-react";
import { useInput } from "ra-core";
import {
  useFieldArray,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ProgressiveChannelTypeChoice = {
  id: string;
  name: string;
};

export type ProgressiveMultiChannelInputProps<T extends FieldValues> = {
  source: Path<T>;
  kind: "email" | "phone";
  label: string;
  valueKey: "value" | "email" | "number";
  typeChoices: readonly ProgressiveChannelTypeChoice[];
  addLabel: string;
  onFirstEmailBlur?: (
    event?: FocusEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => void;
  onFirstEmailPaste?: ClipboardEventHandler<
    HTMLTextAreaElement | HTMLInputElement
  >;
};

const defaultType = (choices: readonly ProgressiveChannelTypeChoice[]) =>
  choices[0]?.id ?? "Work";

const createEmptyRow = (
  valueKey: "value" | "email" | "number",
  type: string,
  isPrimary = false,
) => {
  if (valueKey === "value") {
    return { value: "", type, isPrimary };
  }
  if (valueKey === "email") {
    return { email: "", type };
  }
  return { number: "", type };
};

const syncCompanyPrimaryFlags = <T extends FieldValues>(
  source: Path<T>,
  rowCount: number,
  setValue: ReturnType<typeof useFormContext<T>>["setValue"],
) => {
  for (let index = 0; index < rowCount; index += 1) {
    setValue(
      `${String(source)}.${index}.isPrimary` as Path<T>,
      (index === 0) as never,
      { shouldDirty: true },
    );
  }
};

/** Flattened input styles when nested inside a shared bordered row. */
const groupedValueFieldClassName =
  "min-w-0 flex-1 gap-0 [&_[data-slot=input]]:h-9 [&_[data-slot=input]]:rounded-none [&_[data-slot=input]]:border-0 [&_[data-slot=input]]:bg-transparent [&_[data-slot=input]]:shadow-none [&_[data-slot=input]]:focus-visible:ring-0";

const ChannelTypeSelect = ({
  source,
  choices,
}: {
  source: string;
  choices: readonly ProgressiveChannelTypeChoice[];
}) => {
  const { field } = useInput({ source });
  const mergedChoices = useMemo(() => {
    const seen = new Set<string>();
    const result: ProgressiveChannelTypeChoice[] = [];
    const add = (id: string, name?: string) => {
      const trimmed = id.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      result.push({ id: trimmed, name: name ?? trimmed });
    };

    for (const choice of choices) {
      add(choice.id, choice.name);
    }
    add(field.value?.toString() ?? "");

    return result;
  }, [choices, field.value]);

  const value = field.value?.toString() || defaultType(mergedChoices);

  return (
    <Select
      key={`channel-type:${value}`}
      value={value}
      onValueChange={field.onChange}
      disabled={field.disabled}
    >
      <SelectTrigger
        className={cn(
          "h-9 w-[6.25rem] shrink-0 rounded-none border-0 border-l border-input",
          "bg-muted/50 px-2.5 text-xs font-medium shadow-none",
          "hover:bg-muted/70 focus:ring-0 focus-visible:ring-0",
          "[&>svg]:size-3.5 [&>svg]:opacity-60",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {mergedChoices.map((choice) => (
          <SelectItem key={choice.id} value={choice.id} className="text-sm">
            {choice.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const ChannelValueInput = ({
  kind,
  source,
  label,
  grouped,
  onFirstEmailBlur,
  onFirstEmailPaste,
}: {
  kind: "email" | "phone";
  source: string;
  label: string | false;
  grouped: boolean;
  onFirstEmailBlur?: ProgressiveMultiChannelInputProps<FieldValues>["onFirstEmailBlur"];
  onFirstEmailPaste?: ProgressiveMultiChannelInputProps<FieldValues>["onFirstEmailPaste"];
}) => {
  const shared = {
    source,
    label,
    helperText: false as const,
    className: grouped ? groupedValueFieldClassName : undefined,
  };

  if (kind === "email") {
    return (
      <EmailInput
        {...shared}
        onBlur={onFirstEmailBlur}
        onPaste={onFirstEmailPaste}
      />
    );
  }

  return <PhoneInput {...shared} />;
};

export const ProgressiveMultiChannelInput = <T extends FieldValues>({
  source,
  kind,
  label,
  valueKey,
  typeChoices,
  addLabel,
  onFirstEmailBlur,
  onFirstEmailPaste,
}: ProgressiveMultiChannelInputProps<T>) => {
  const { control, setValue } = useFormContext<T>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: source as never,
  });

  useEffect(() => {
    if (fields.length === 0) {
      append(
        createEmptyRow(
          valueKey,
          defaultType(typeChoices),
          valueKey === "value",
        ) as never,
      );
    }
  }, [append, fields.length, typeChoices, valueKey]);

  const multi = fields.length > 1;

  const appendRow = () => {
    append(createEmptyRow(valueKey, defaultType(typeChoices)) as never);
  };

  const makePrimary = (index: number) => {
    if (index <= 0) return;
    move(index, 0);
    if (valueKey === "value") {
      syncCompanyPrimaryFlags(source, fields.length, setValue);
    }
  };

  const handleRemove = (index: number) => {
    remove(index);
    if (valueKey === "value" && fields.length > 1) {
      syncCompanyPrimaryFlags(source, fields.length - 1, setValue);
    }
  };

  const primaryControlWidth = "size-9";

  return (
    <div className="space-y-2">
      {multi ? (
        <p className="text-sm font-medium leading-none">{label}</p>
      ) : null}

      <div className="space-y-2">
        {fields.map((field, index) => {
          const valueSource = `${String(source)}.${index}.${valueKey}`;
          const typeSource = `${String(source)}.${index}.type`;

          if (!multi) {
            return (
              <ChannelValueInput
                key={field.id}
                kind={kind}
                source={valueSource}
                label={label}
                grouped={false}
                onFirstEmailBlur={index === 0 ? onFirstEmailBlur : undefined}
                onFirstEmailPaste={index === 0 ? onFirstEmailPaste : undefined}
              />
            );
          }

          return (
            <div key={field.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex min-w-0 flex-1 overflow-hidden rounded-md border border-input bg-background shadow-xs",
                  "transition-[color,box-shadow]",
                  "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
                )}
              >
                <ChannelValueInput
                  kind={kind}
                  source={valueSource}
                  label={false}
                  grouped
                  onFirstEmailBlur={index === 0 ? onFirstEmailBlur : undefined}
                  onFirstEmailPaste={
                    index === 0 ? onFirstEmailPaste : undefined
                  }
                />
                <ChannelTypeSelect source={typeSource} choices={typeChoices} />
              </div>

              <div className="flex h-9 shrink-0 items-center gap-1">
                {index === 0 ? (
                  <IconButton
                    type="button"
                    className={cn(primaryControlWidth, "text-amber-500")}
                    aria-label="Primary"
                    title="Primary"
                    disabled
                  >
                    <Star className="size-4 fill-current" />
                  </IconButton>
                ) : (
                  <IconButton
                    type="button"
                    className={cn(
                      primaryControlWidth,
                      "text-muted-foreground hover:text-amber-500",
                    )}
                    aria-label="Set as primary"
                    title="Set as primary"
                    onClick={() => makePrimary(index)}
                  >
                    <Star className="size-4" />
                  </IconButton>
                )}
                <IconButton
                  className={cn(primaryControlWidth, "text-muted-foreground hover:text-destructive")}
                  onClick={() => handleRemove(index)}
                  aria-label={`Remove ${kind}`}
                >
                  <X className="size-4" />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0 text-muted-foreground"
        onClick={appendRow}
      >
        {addLabel}
      </Button>
    </div>
  );
};
