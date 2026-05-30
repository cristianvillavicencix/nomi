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

const ACTION_SLOT = "size-8 shrink-0";

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

  const appendChannel = () =>
    append({
      value: "",
      type: "Work",
      isPrimary: fields.length === 0,
    } satisfies ClientChannelFormValue);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_6.75rem] items-end gap-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm font-medium">Type</p>
        <span className="sr-only">Actions</span>
      </div>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <ChannelRow
            key={field.id}
            source={source}
            index={index}
            kind={kind}
            canRemove={fields.length > 1}
            showAdd={index === fields.length - 1}
            onAdd={appendChannel}
            onRemove={() => remove(index)}
          />
        ))}
      </div>
    </div>
  );
};

const ChannelRow = ({
  source,
  index,
  kind,
  canRemove,
  showAdd,
  onAdd,
  onRemove,
}: {
  source: ChannelsSource;
  index: number;
  kind: "email" | "phone";
  canRemove: boolean;
  showAdd: boolean;
  onAdd: () => void;
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
    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_6.75rem] items-center gap-2">
      <div className="min-w-0">
        {kind === "email" ? (
          <EmailInput
            source={`${source}.${index}.value`}
            label={false}
            helperText={false}
          />
        ) : (
          <PhoneInput
            source={`${source}.${index}.value`}
            label={false}
            helperText={false}
          />
        )}
      </div>
      <SelectInput
        source={`${source}.${index}.type`}
        label={false}
        choices={[...CHANNEL_TYPE_CHOICES]}
        helperText={false}
      />
      <div className="flex items-center justify-end gap-0.5">
        {showAdd ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(ACTION_SLOT, "text-muted-foreground")}
            onClick={onAdd}
            aria-label={`Add another ${kind}`}
            title={`Add another ${kind}`}
          >
            <Plus className="size-4" />
          </Button>
        ) : (
          <div aria-hidden className={ACTION_SLOT} />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            ACTION_SLOT,
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
            className={cn(
              ACTION_SLOT,
              "text-muted-foreground hover:text-destructive",
            )}
            onClick={onRemove}
            aria-label={`Remove ${kind}`}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : (
          <div aria-hidden className={ACTION_SLOT} />
        )}
      </div>
    </div>
  );
};
