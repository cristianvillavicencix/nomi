import { useFormContext, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { LeadType } from "./leadFormConstants";
import type { NewLeadFormValues } from "./newLeadFormTypes";

export const LeadTypeToggle = () => {
  const { setValue } = useFormContext<NewLeadFormValues>();
  const leadType = useWatch<NewLeadFormValues, "lead_type">({ name: "lead_type" });

  const setType = (type: LeadType) => {
    setValue("lead_type", type, { shouldDirty: true });
    setValue("add_primary_contact", true, { shouldDirty: true });
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Lead type</Label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setType("individual")}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
            leadType === "individual"
              ? "border-primary bg-primary/5 font-medium"
              : "border-border hover:bg-muted/50",
          )}
        >
          Persona individual
        </button>
        <button
          type="button"
          onClick={() => setType("business")}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
            leadType === "business"
              ? "border-primary bg-primary/5 font-medium"
              : "border-border hover:bg-muted/50",
          )}
        >
          Empresa (B2B)
        </button>
      </div>
    </div>
  );
};
