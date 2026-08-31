import { useEffect, useRef } from "react";
import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { useIsMobile } from "@/hooks/use-mobile";
import { AutocompleteCompanyInput } from "@/components/atomic-crm/companies/AutocompleteCompanyInput";
import {
  isOtherSource,
  isReferralSource,
} from "@/modules/leads/leadFormConstants";

/**
 * Conditional fields for the lead form:
 *  - When source = "Referral" → show contact OR company pickers
 *  - When source = "Other" → free-text origin
 *  - Otherwise → render nothing
 */
export const LeadReferrerInputs = ({
  sourceField = "lead_source",
}: {
  sourceField?: string;
}) => {
  const isMobile = useIsMobile();
  const value = useWatch({ name: sourceField }) as string | null | undefined;
  const { setValue } = useFormContext();
  const previousValue = useRef<string | null | undefined>(value);
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();

  useEffect(() => {
    if (previousValue.current === value) return;
    if (!isReferralSource(value)) {
      setValue("referred_by_contact_id", null, { shouldDirty: true });
      setValue("referred_by_company_id", null, { shouldDirty: true });
    }
    if (!isOtherSource(value)) {
      setValue("lead_source_other", null, { shouldDirty: true });
    }
    previousValue.current = value;
  }, [value, setValue]);

  const handleCreateReferrerContact = async (fullName?: string) => {
    const trimmed = fullName?.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/\s+/);
    const firstName = parts.shift() ?? trimmed;
    const lastName = parts.join(" ");
    try {
      const now = new Date().toISOString();
      const created = await create(
        "contacts",
        {
          data: {
            first_name: firstName,
            last_name: lastName || firstName,
            status: "contact_only",
            organization_member_id: identity?.id,
            first_seen: now,
            last_seen: now,
            tags: [],
          },
        },
        { returnPromise: true },
      );
      return created;
    } catch {
      notify("Could not create referrer contact", { type: "error" });
    }
  };

  if (isReferralSource(value)) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-dashed border-border bg-muted/40 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Who referred this lead? Pick an existing person or company (or create
          a company on the fly).
        </p>
        <ReferenceInput
          source="referred_by_contact_id"
          reference="contacts"
          perPage={20}
          sort={{ field: "last_name", order: "ASC" }}
        >
          <AutocompleteInput
            label="Referrer (person)"
            optionText={(record) =>
              `${record?.first_name ?? ""} ${record?.last_name ?? ""}`.trim() ||
              "Unnamed"
            }
            onCreate={handleCreateReferrerContact}
            createLabel="Start typing to create a new contact"
            createItemLabel="Create %{item}"
            helperText={false}
            modal={isMobile}
            labelVariant="floating"
          />
        </ReferenceInput>
        <ReferenceInput
          source="referred_by_company_id"
          reference="companies"
          perPage={20}
          sort={{ field: "name", order: "ASC" }}
        >
          <AutocompleteCompanyInput labelVariant="floating" />
        </ReferenceInput>
      </div>
    );
  }

  if (isOtherSource(value)) {
    return (
      <TextInput
        source="lead_source_other"
        label="Where did they come from?"
        helperText={false}
        placeholder="e.g. event X, podcast Y"
        labelVariant="floating"
      />
    );
  }

  return null;
};
