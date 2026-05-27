import { Plus, X } from "lucide-react";
import { email } from "ra-core";
import { useFieldArray, useFormContext } from "react-hook-form";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { SelectInput } from "@/components/admin/select-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Contact } from "@/components/atomic-crm/types";

const CHANNEL_TYPES = [
  { id: "Work", name: "Work" },
  { id: "Home", name: "Home" },
  { id: "Other", name: "Other" },
];

type EmailRow = NonNullable<Contact["email_jsonb"]>[number];
type PhoneRow = NonNullable<Contact["phone_jsonb"]>[number];

type LeadChannelsInputProps = {
  source: "email_jsonb" | "phone_jsonb";
  kind: "email" | "phone";
  label: string;
};

export const LeadChannelsInput = ({
  source,
  kind,
  label,
}: LeadChannelsInputProps) => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: source });

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
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
              <SelectInput
                source={`${source}.${index}.type`}
                label={false}
                optionText="id"
                choices={CHANNEL_TYPES}
                defaultValue="Work"
                helperText={false}
              />
            </div>
            {fields.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground"
                onClick={() => remove(index)}
                aria-label={`Remove ${kind}`}
              >
                <X className="size-4" />
              </Button>
            ) : (
              <span className="size-8 shrink-0" aria-hidden />
            )}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="link"
        className="h-auto gap-1 p-0 text-muted-foreground"
        onClick={() =>
          append(
            (kind === "email"
              ? { email: "", type: "Work" }
              : { number: "", type: "Work" }) satisfies EmailRow | PhoneRow,
          )
        }
      >
        <Plus className="size-4" />
        Add {kind}
      </Button>
    </div>
  );
};
