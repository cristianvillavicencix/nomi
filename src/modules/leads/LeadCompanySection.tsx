import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { CompanyInlineDraftFields } from "@/modules/contacts/CompanyInlineDraftFields";
import type { PersonFormValues } from "@/modules/contacts/personFormTypes";

const AddPrimaryContactChoice = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) => (
  <div className="space-y-2 rounded-md border border-dashed bg-muted/30 p-3">
    <p className="text-sm font-medium">
      Add a primary contact for this company?
    </p>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "flex-1 rounded-md border px-3 py-2 text-sm",
          value
            ? "border-primary bg-primary/5 font-medium"
            : "border-border hover:bg-muted/50",
        )}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "flex-1 rounded-md border px-3 py-2 text-sm",
          !value
            ? "border-primary bg-primary/5 font-medium"
            : "border-border hover:bg-muted/50",
        )}
      >
        No
      </button>
    </div>
  </div>
);

export const LeadCompanySection = () => {
  const { setValue } = useFormContext<PersonFormValues>();
  const addPrimaryContact = useWatch<PersonFormValues, "add_primary_contact">({
    name: "add_primary_contact",
  });

  return (
    <div className="space-y-3">
      <CompanyInlineDraftFields />
      <AddPrimaryContactChoice
        value={Boolean(addPrimaryContact)}
        onChange={(next) =>
          setValue("add_primary_contact", next, { shouldDirty: true })
        }
      />
    </div>
  );
};
