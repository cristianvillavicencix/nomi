import { Plus, Star, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { SelectInput } from "@/components/admin/select-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientCreateFormValues } from "@/lbs/clients/ClientCreateForm";
import {
  CHANNEL_TYPE_CHOICES,
  type ClientChannelFormValue,
} from "@/lbs/clients/clientChannels";

type ChannelsSource =
  | "company_emails"
  | "company_phones"
  | "primary_emails"
  | "primary_phones";

type ClientChannelsInputProps = {
  source: ChannelsSource;
  kind: "email" | "phone";
  label: string;
};

export const ClientChannelsInput = ({
  source,
  kind,
  label,
}: ClientChannelsInputProps) => {
  const { control } = useFormContext<ClientCreateFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: source,
  });

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <ChannelRow
          key={field.id}
          source={source}
          index={index}
          kind={kind}
          label={index === 0 ? label : false}
          canRemove={fields.length > 1}
          onRemove={() => remove(index)}
        />
      ))}
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-muted-foreground"
        onClick={() =>
          append({
            value: "",
            type: "Work",
            isPrimary: fields.length === 0,
          } satisfies ClientChannelFormValue)
        }
      >
        <Plus className="size-4" />
        Add another {kind}
      </Button>
    </div>
  );
};

const ChannelRow = ({
  source,
  index,
  kind,
  label,
  canRemove,
  onRemove,
}: {
  source: ChannelsSource;
  index: number;
  kind: "email" | "phone";
  label: string | false;
  canRemove: boolean;
  onRemove: () => void;
}) => {
  const { setValue, getValues } = useFormContext<ClientCreateFormValues>();
  const isPrimary = useWatch<ClientCreateFormValues>({
    name: `${source}.${index}.isPrimary`,
  }) as boolean | undefined;

  const setPrimary = () => {
    const current = (getValues(source) ?? []) as ClientChannelFormValue[];
    current.forEach((_, rowIndex) => {
      setValue(`${source}.${rowIndex}.isPrimary`, rowIndex === index, {
        shouldDirty: true,
      });
    });
  };

  return (
    <div className="flex items-end gap-2">
      <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_6.5rem]">
        {kind === "email" ? (
          <EmailInput
            source={`${source}.${index}.value`}
            label={label || false}
            helperText={false}
          />
        ) : (
          <PhoneInput
            source={`${source}.${index}.value`}
            label={label || false}
            helperText={false}
          />
        )}
        <SelectInput
          source={`${source}.${index}.type`}
          label={label ? "Type" : false}
          choices={[...CHANNEL_TYPE_CHOICES]}
          helperText={false}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "mb-0.5 size-8 shrink-0",
          isPrimary
            ? "text-amber-500 hover:text-amber-600"
            : "text-muted-foreground",
        )}
        onClick={setPrimary}
        aria-label={isPrimary ? "Primary" : "Set as primary"}
        title={isPrimary ? "Primary" : "Set as primary"}
      >
        <Star className={cn("size-4", isPrimary && "fill-current")} />
      </Button>
      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mb-0.5 size-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remove ${kind}`}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : (
        <div className="size-8 shrink-0" />
      )}
    </div>
  );
};
