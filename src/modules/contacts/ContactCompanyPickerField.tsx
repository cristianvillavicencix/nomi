import { useMemo, useState, useEffect } from "react";
import {
  useGetList,
  useGetOne,
  useInput,
  useRecordContext,
  type Identifier,
} from "ra-core";
import { Check, Plus } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { CompanyCreateDialog } from "@/modules/clients/CompanyCreateDialog";
import { getCompanySummaryDetailLines } from "@/modules/clients/companySummary";
import { buildCompanySearchMeta } from "@/modules/shared/referenceAutocompleteOptions";
import {
  PRIMARY_MOVE_CONFIRMED_FIELD,
  clearCompanyDraftFormFields,
  companySectorLabel,
  emptyCompanyDraftFormFields,
  getCompanyDraftFromFormValues,
} from "@/modules/contacts/companyDraft";
import { getClientShowPath } from "@/app/routing";
import {
  EntitySearchGroup,
  EntitySearchOption,
  EntitySearchToolbar,
  SelectedEntityRow,
} from "@/modules/shared/entityPickerUi";
import { isValidRecordId } from "@/lib/isValidRecordId";

const validateCompanySelection = (
  companyId: Identifier | null | undefined,
  values: Record<string, unknown>,
  optional = false,
) => {
  if (companyId != null && companyId !== "") return undefined;
  const draft = getCompanyDraftFromFormValues(values);
  if (draft?.name && draft.sector) return undefined;
  if (draft?.name && !draft.sector) return "Industry is required";
  if (optional) return undefined;
  return "Company is required";
};

export const ContactCompanyPickerField = ({
  optional = false,
}: {
  optional?: boolean;
} = {}) => {
  const record = useRecordContext<Contact>();
  const { setValue, clearErrors, register } = useFormContext();

  useEffect(() => {
    register(PRIMARY_MOVE_CONFIRMED_FIELD);
  }, [register]);

  const { field } = useInput({
    source: "company_id",
    validate: (value, values) =>
      validateCompanySelection(
        value,
        values as Record<string, unknown>,
        optional,
      ),
  });

  const moveConfirmed = useWatch({ name: PRIMARY_MOVE_CONFIRMED_FIELD }) as
    | boolean
    | undefined;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyCreateOpen, setCompanyCreateOpen] = useState(false);
  const [companyCreateInitialName, setCompanyCreateInitialName] = useState("");
  const [optimisticCompany, setOptimisticCompany] = useState<Company | null>(
    null,
  );

  const trimmedSearch = searchQuery.trim();
  const shouldFetch = searchOpen && trimmedSearch.length > 0;

  const { data: companies = [], isFetching } = useGetList<Company>(
    "companies",
    {
      filter: trimmedSearch ? { q: trimmedSearch } : {},
      pagination: { page: 1, perPage: 20 },
      sort: { field: "name", order: "ASC" },
    },
    { enabled: shouldFetch },
  );

  const selectedCompanyId = field.value as Identifier | null | undefined;
  const hasSelectedCompany = isValidRecordId(selectedCompanyId);

  const { data: fetchedCompany } = useGetOne<Company>(
    "companies",
    { id: selectedCompanyId! },
    { enabled: hasSelectedCompany },
  );

  const activeCompany = useMemo(() => {
    if (
      optimisticCompany &&
      hasSelectedCompany &&
      String(optimisticCompany.id) === String(selectedCompanyId)
    ) {
      return optimisticCompany;
    }
    return fetchedCompany ?? null;
  }, [
    fetchedCompany,
    hasSelectedCompany,
    optimisticCompany,
    selectedCompanyId,
  ]);

  const originalCompanyId = record?.company_id ?? null;
  const { data: originalCompany } = useGetOne<Company>(
    "companies",
    { id: originalCompanyId! },
    {
      enabled: record?.id != null && isValidRecordId(originalCompanyId),
    },
  );

  const isPrimaryOfOriginal =
    record?.id != null &&
    originalCompany?.primary_contact_id != null &&
    String(originalCompany.primary_contact_id) === String(record.id);

  const companyChanged =
    record?.id != null &&
    hasSelectedCompany &&
    isValidRecordId(originalCompanyId) &&
    String(selectedCompanyId) !== String(originalCompanyId);

  const needsPrimaryMoveConfirm = isPrimaryOfOriginal && companyChanged;

  const selectCompany = (company: Company) => {
    setOptimisticCompany(company);
    field.onChange(company.id);
    clearCompanyDraftFormFields(setValue);
    setValue(PRIMARY_MOVE_CONFIRMED_FIELD, false);
    clearErrors("company_id");
    setSearchOpen(false);
    setSearchQuery("");
    setCompanyCreateOpen(false);
    setCompanyCreateInitialName("");
  };

  const clearSelection = () => {
    setOptimisticCompany(null);
    field.onChange(null);
    clearCompanyDraftFormFields(setValue);
    setValue(PRIMARY_MOVE_CONFIRMED_FIELD, false);
    setCompanyCreateOpen(false);
    setCompanyCreateInitialName("");
    setSearchQuery("");
    setSearchOpen(false);
  };

  const openCompanyCreateDialog = (initialName = "") => {
    setCompanyCreateInitialName(initialName);
    setCompanyCreateOpen(true);
    setSearchOpen(false);
  };

  const rowTitle = activeCompany?.name?.trim() ?? "";
  const rowSubtitle = companySectorLabel(activeCompany?.sector);
  const companyDetails = useMemo(
    () => getCompanySummaryDetailLines(activeCompany),
    [activeCompany],
  );
  const showCompanySummary = hasSelectedCompany;

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Company</Label>

      {showCompanySummary ? (
        <SelectedEntityRow
          title={rowTitle || "Selected company"}
          subtitle={rowSubtitle || undefined}
          details={companyDetails}
          profileHref={
            activeCompany?.id != null
              ? getClientShowPath(activeCompany.id)
              : undefined
          }
          onRemove={clearSelection}
          removeAriaLabel="Remove company"
        />
      ) : (
        <EntitySearchToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchOpen={searchOpen}
          onSearchOpenChange={setSearchOpen}
          searchPlaceholder="Search existing company…"
          addButtonLabel="Add company"
          addButtonIcon={<Plus className="size-4" />}
          onAddClick={() => openCompanyCreateDialog()}
          isFetching={isFetching}
          emptyMessage="Type to search companies."
          emptySearchMessage="No companies match your search."
          groupHeading="Companies"
        >
          {!isFetching && trimmedSearch.length > 0 ? (
            companies.length === 0 ? (
              <EntitySearchGroup heading="Companies">
                <EntitySearchOption
                  label={`Create "${trimmedSearch}" as new company`}
                  onSelect={() => openCompanyCreateDialog(trimmedSearch)}
                />
              </EntitySearchGroup>
            ) : (
              <EntitySearchGroup heading="Companies">
                {companies.map((company) => {
                  const isSelected =
                    hasSelectedCompany &&
                    String(company.id) === String(selectedCompanyId);

                  return (
                    <EntitySearchOption
                      key={String(company.id)}
                      label={company.name}
                      sublabel={buildCompanySearchMeta(company) || undefined}
                      selected={isSelected}
                      onSelect={() => selectCompany(company)}
                    />
                  );
                })}
              </EntitySearchGroup>
            )
          ) : null}
        </EntitySearchToolbar>
      )}

      <CompanyCreateDialog
        open={companyCreateOpen}
        onOpenChange={setCompanyCreateOpen}
        initialCompanyName={companyCreateInitialName}
        enableDraft={false}
        onUseExistingCompany={selectCompany}
        onCreated={({ company, companyId, name, sector }) =>
          selectCompany(
            company ??
              ({
                id: companyId,
                name,
                sector: sector ?? "",
              } as Company),
          )
        }
      />

      {needsPrimaryMoveConfirm && !moveConfirmed ? (
        <Alert variant="destructive">
          <AlertTitle>Primary contact will move</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              This contact is the primary contact of{" "}
              <span className="font-medium">{originalCompany?.name}</span>.
              Moving them will leave that company without a primary contact.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setValue(PRIMARY_MOVE_CONFIRMED_FIELD, true)}
            >
              I understand, continue
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {needsPrimaryMoveConfirm && moveConfirmed ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="size-3.5 shrink-0" />
          Primary move acknowledged — save to apply.
        </p>
      ) : null}
    </div>
  );
};

export { emptyCompanyDraftFormFields } from "@/modules/contacts/companyDraft";
