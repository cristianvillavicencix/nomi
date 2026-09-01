import { useEffect } from "react";
import type { ClipboardEventHandler, FocusEvent } from "react";
import { Plus, Star, X } from "lucide-react";
import {
  useFieldArray,
  useFormContext,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { IconButton } from "@/components/ui/icon-button";
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

const ChannelValueInput = ({
  kind,
  source,
  label,
  onFirstEmailBlur,
  onFirstEmailPaste,
}: {
  kind: "email" | "phone";
  source: string;
  label: string;
  onFirstEmailBlur?: ProgressiveMultiChannelInputProps<FieldValues>["onFirstEmailBlur"];
  onFirstEmailPaste?: ProgressiveMultiChannelInputProps<FieldValues>["onFirstEmailPaste"];
}) => {
  const shared = {
    source,
    label,
    helperText: false as const,
    labelVariant: "floating" as const,
    className: "min-w-0 flex-1",
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

  return (
    <div className="space-y-3">
      {fields.map((field, index) => {
        const valueSource = `${String(source)}.${index}.${valueKey}`;
        const isLast = index === fields.length - 1;
        const isPrimary = index === 0;

        return (
          <div key={field.id} className="flex min-w-0 items-center gap-1">
            <div className="min-w-0 flex-1">
              <ChannelValueInput
                kind={kind}
                source={valueSource}
                label={label}
                onFirstEmailBlur={index === 0 ? onFirstEmailBlur : undefined}
                onFirstEmailPaste={index === 0 ? onFirstEmailPaste : undefined}
              />
            </div>

            <IconButton
              type="button"
              className={cn(
                "size-9 shrink-0",
                isPrimary
                  ? "text-amber-500"
                  : "text-muted-foreground hover:text-amber-500",
              )}
              aria-label={isPrimary ? "Primary" : "Set as primary"}
              title={isPrimary ? "Primary" : "Set as primary"}
              disabled={isPrimary && !multi}
              onClick={() => makePrimary(index)}
            >
              <Star
                className={cn("size-4", isPrimary && "fill-current")}
              />
            </IconButton>

            {multi ? (
              <IconButton
                type="button"
                className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(index)}
                aria-label={`Remove ${kind}`}
                title={`Remove ${kind}`}
              >
                <X className="size-4" />
              </IconButton>
            ) : null}

            {isLast ? (
              <IconButton
                type="button"
                variant="secondary"
                className="size-9 shrink-0"
                onClick={appendRow}
                aria-label={addLabel}
                title={addLabel}
              >
                <Plus className="size-4" />
              </IconButton>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
