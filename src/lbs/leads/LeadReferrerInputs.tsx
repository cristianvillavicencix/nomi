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
} from "@/lbs/leads/leadFormConstants";

/**
 * Conditional fields for the lead form:
 *  - When source = "Referido" → show 2 pickers (contact OR company) so the
 *    user can attribute the referral to an existing person/company; the
 *    company picker also supports inline creation.
 *  - When source = "Otro" → show a free-text field to capture the actual
 *    origin.
 *  - Otherwise → render nothing.
 *
 * On every change to lead_source we also clear the now-irrelevant fields so
 * stale values cannot survive the form submit (e.g. user picks "Referido",
 * selects a referrer, switches to "Sitio web", and we must not persist the
 * referrer id any more).
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
            status: "contact",
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
      notify("No pude crear el contacto referidor", { type: "error" });
    }
  };

  if (isReferralSource(value)) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-dashed border-border bg-muted/40 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          ¿Quién refirió este lead? Selecciona la persona o la empresa que ya
          existe en el CRM (o crea la empresa al vuelo).
        </p>
        <ReferenceInput
          source="referred_by_contact_id"
          reference="contacts"
          perPage={20}
          sort={{ field: "last_name", order: "ASC" }}
        >
          <AutocompleteInput
            label="Referrer (persona)"
            optionText={(record) =>
              `${record?.first_name ?? ""} ${record?.last_name ?? ""}`.trim() ||
              "Unnamed"
            }
            onCreate={handleCreateReferrerContact}
            createLabel="Empieza a escribir para crear un nuevo contacto"
            createItemLabel="Crear %{item}"
            helperText={false}
            modal={isMobile}
          />
        </ReferenceInput>
        <ReferenceInput
          source="referred_by_company_id"
          reference="companies"
          perPage={20}
          sort={{ field: "name", order: "ASC" }}
        >
          <AutocompleteCompanyInput />
        </ReferenceInput>
      </div>
    );
  }

  if (isOtherSource(value)) {
    return (
      <TextInput
        source="lead_source_other"
        label="¿De dónde vino? Especifica"
        helperText={false}
        placeholder="Por ejemplo: evento X, podcast Y, etc."
      />
    );
  }

  return null;
};
