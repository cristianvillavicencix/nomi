import { Plus, Trash2 } from "lucide-react";
import { email } from "ra-core";
import { useFieldArray, useFormContext } from "react-hook-form";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { SelectInput } from "@/components/admin/select-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Contact } from "@/components/atomic-crm/types";

type EmailRow = NonNullable<Contact["email_jsonb"]>[number];
type PhoneRow = NonNullable<Contact["phone_jsonb"]>[number];

type ChannelTypeChoice = { id: string; name: string };

type LeadChannelsInputProps = {
  source: "email_jsonb" | "phone_jsonb";
  kind: "email" | "phone";
  label: string;
  typeChoices: readonly ChannelTypeChoice[];
};

const ACTION_SLOT = "size-8 shrink-0";
const ACTION_COL = "flex h-9 w-[4.5rem] shrink-0 items-center justify-end gap-0.5";

export const LeadChannelsInput = ({
  source,
  kind,
  label,
  typeChoices,
}: LeadChannelsInputProps) => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: source });

  const appendChannel = () =>
    append(
      (kind === "email"
        ? { email: "", type: "Work" }
        : { number: "", type: "Work" }) satisfies EmailRow | PhoneRow,
    );

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
            typeChoices={typeChoices}
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
  typeChoices,
  canRemove,
  showAdd,
  onAdd,
  onRemove,
}: {
  source: "email_jsonb" | "phone_jsonb";
  index: number;
  kind: "email" | "phone";
  typeChoices: readonly ChannelTypeChoice[];
  canRemove: boolean;
  showAdd: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) => (
  <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_4.5rem] gap-2">
    <div className="min-w-0">
      {kind === "email" ? (
        <EmailInput
          source={`${source}.${index}.email`}
          label={false}
          placeholder="Email"
          helperText={false}
          validate={email()}
        />
      ) : (
        <PhoneInput
          source={`${source}.${index}.number`}
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
      choices={[...typeChoices]}
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
