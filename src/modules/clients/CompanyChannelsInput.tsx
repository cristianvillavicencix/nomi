import { Plus, Trash2 } from "lucide-react";
import { email } from "ra-core";
import { useEffect } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { SelectInput } from "@/components/admin/select-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientCreateFormValues } from "@/modules/clients/ClientCreateForm";
import { COMPANY_CHANNEL_TYPE_CHOICES } from "@/modules/clients/clientChannels";

type CompanyChannelsInputProps = {
  source: "company_emails" | "company_phones";
  kind: "email" | "phone";
  label: string;
};

const ACTION_SLOT = "size-8 shrink-0";
const ACTION_COL =
  "flex h-9 w-[4.5rem] shrink-0 items-center justify-end gap-0.5";

/** Multi email/phone rows with type + add — matches New contact channel UI. */
export const CompanyChannelsInput = ({
  source,
  kind,
  label,
}: CompanyChannelsInputProps) => {
  const { control, setValue } = useFormContext<ClientCreateFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: source });

  useEffect(() => {
    fields.forEach((_, index) => {
      setValue(`${source}.${index}.isPrimary`, index === 0, {
        shouldDirty: true,
      });
    });
  }, [fields.length, setValue, source]);

  const appendChannel = () =>
    append({
      value: "",
      type: "Work",
      isPrimary: fields.length === 0,
    });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_4.5rem] items-end gap-2">
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
  source: "company_emails" | "company_phones";
  index: number;
  kind: "email" | "phone";
  canRemove: boolean;
  showAdd: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) => (
  <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_4.5rem] gap-2">
    <div className="min-w-0">
      {kind === "email" ? (
        <EmailInput
          source={`${source}.${index}.value`}
          label={false}
          placeholder="Email"
          helperText={false}
          validate={email()}
        />
      ) : (
        <PhoneInput
          source={`${source}.${index}.value`}
          label={false}
          placeholder="(xxx) xxx-xxxx"
          helperText={false}
        />
      )}
    </div>
    <SelectInput
      source={`${source}.${index}.type`}
      label={false}
      optionText="id"
      choices={[...COMPANY_CHANNEL_TYPE_CHOICES]}
      defaultValue="Work"
      helperText={false}
    />
    <div className={ACTION_COL}>
      {showAdd ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(ACTION_SLOT, "text-muted-foreground")}
          onClick={onAdd}
          aria-label={`Add ${kind}`}
          title={`Add ${kind}`}
        >
          <Plus className="size-4" />
        </Button>
      ) : (
        <div aria-hidden className={ACTION_SLOT} />
      )}
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
