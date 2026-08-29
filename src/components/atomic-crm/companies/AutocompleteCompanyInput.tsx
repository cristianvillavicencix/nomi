import { useRef, useState } from "react";
import type { InputProps } from "ra-core";
import type { Company } from "@/components/atomic-crm/types";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CompanyCreateDialog,
  type CompanyCreateDialogResult,
} from "@/modules/clients/CompanyCreateDialog";

type AutocompleteCompanyInputProps = Pick<
  InputProps,
  "validate" | "label" | "helperText" | "source"
> & {
  placeholder?: string;
  emptyText?: string;
  filterToQuery?: (searchText: string) => Record<string, unknown>;
};

type PendingCreate = {
  resolve: (company?: Company) => void;
};

const companyFromCreateResult = (
  result: CompanyCreateDialogResult,
): Company =>
  result.company ??
  ({
    id: result.companyId,
    name: result.name,
    sector: result.sector ?? "",
    primary_contact_id: result.contactId ?? null,
  } as Company);

/**
 * Company/account autocomplete with “Create new account” → full create dialog.
 * Use inside `<ReferenceInput source="…" reference="companies">`.
 */
export const AutocompleteCompanyInput = ({
  validate,
  label,
  helperText = false,
  source,
  placeholder = "Search account…",
  emptyText,
  filterToQuery = (searchText) => ({ q: searchText }),
}: AutocompleteCompanyInputProps) => {
  const isMobile = useIsMobile();
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialName, setCreateInitialName] = useState("");
  const pendingCreateRef = useRef<PendingCreate | null>(null);

  const settlePendingCreate = (company?: Company) => {
    pendingCreateRef.current?.resolve(company);
    pendingCreateRef.current = null;
  };

  const startCreateFromSearch = (name?: string) => {
    setCreateInitialName(name?.trim() ?? "");
    setCreateOpen(true);
    return new Promise<Company | undefined>((resolve) => {
      pendingCreateRef.current = { resolve };
    });
  };

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      queueMicrotask(() => {
        if (pendingCreateRef.current) {
          settlePendingCreate(undefined);
        }
      });
    }
  };

  return (
    <>
      <AutocompleteInput
        source={source}
        optionText="name"
        label={label}
        helperText={helperText}
        placeholder={placeholder}
        emptyText={emptyText}
        filterToQuery={filterToQuery}
        onCreate={startCreateFromSearch}
        createLabel="Create new account"
        validate={validate}
        modal={isMobile}
      />
      <CompanyCreateDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        initialCompanyName={createInitialName}
        enableDraft={false}
        onUseExistingCompany={(company) => {
          settlePendingCreate(company);
          setCreateOpen(false);
        }}
        onCreated={(result) => {
          settlePendingCreate(companyFromCreateResult(result));
        }}
      />
    </>
  );
};
