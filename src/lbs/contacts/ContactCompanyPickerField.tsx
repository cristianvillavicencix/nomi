import { useMemo, useState, useEffect } from "react";
import {
  useGetList,
  useGetOne,
  useInput,
  useRecordContext,
  type Identifier,
} from "ra-core";
import { Building2, Check } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  COMPANY_DRAFT_NAME_FIELD,
  COMPANY_DRAFT_SECTOR_FIELD,
  PRIMARY_MOVE_CONFIRMED_FIELD,
  companySectorLabel,
  getCompanyDraftFromFormValues,
} from "@/lbs/contacts/companyDraft";
import { LBS_COMPANY_INDUSTRY_CHOICES } from "@/lbs/leads/leadFormConstants";
import { getClientShowPath } from "@/lbs/routing";
import {
  EntitySearchGroup,
  EntitySearchOption,
  EntitySearchToolbar,
  SelectedEntityRow,
} from "@/lbs/shared/entityPickerUi";
import { CommandEmpty } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const validateCompanySelection = (
  companyId: Identifier | null | undefined,
  values: Record<string, unknown>,
) => {
  if (companyId != null && companyId !== "") return undefined;
  const draft = getCompanyDraftFromFormValues(values);
  if (draft?.name && draft.sector) return undefined;
  if (draft?.name && !draft.sector) return "Industry is required";
  return "Company is required";
};

export const ContactCompanyPickerField = () => {
  const record = useRecordContext<Contact>();
  const { setValue, clearErrors, register } = useFormContext();

  useEffect(() => {
    register(COMPANY_DRAFT_NAME_FIELD);
    register(COMPANY_DRAFT_SECTOR_FIELD);
    register(PRIMARY_MOVE_CONFIRMED_FIELD);
  }, [register]);
  const { field } = useInput({
    source: "company_id",
    validate: validateCompanySelection,
  });

  const draftName = useWatch({ name: COMPANY_DRAFT_NAME_FIELD }) as
    | string
    | undefined;
  const draftSector = useWatch({ name: COMPANY_DRAFT_SECTOR_FIELD }) as
    | string
    | undefined;
  const moveConfirmed = useWatch({ name: PRIMARY_MOVE_CONFIRMED_FIELD }) as
    | boolean
    | undefined;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddCompany, setShowAddCompany] = useState(false);
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
  const hasDraft = Boolean(draftName?.trim() && draftSector?.trim());
  const hasSelection = selectedCompanyId != null || hasDraft;

  const { data: fetchedCompany } = useGetOne<Company>(
    "companies",
    { id: selectedCompanyId! },
    { enabled: selectedCompanyId != null && !hasDraft },
  );

  const activeCompany = useMemo(() => {
    if (hasDraft) {
      return {
        id: undefined,
        name: draftName!.trim(),
        sector: draftSector!.trim(),
      } satisfies Partial<Company> as Company;
    }
    if (
      optimisticCompany &&
      selectedCompanyId != null &&
      String(optimisticCompany.id) === String(selectedCompanyId)
    ) {
      return optimisticCompany;
    }
    return fetchedCompany ?? null;
  }, [
    draftName,
    draftSector,
    fetchedCompany,
    hasDraft,
    optimisticCompany,
    selectedCompanyId,
  ]);

  const originalCompanyId = record?.company_id ?? null;
  const { data: originalCompany } = useGetOne<Company>(
    "companies",
    { id: originalCompanyId! },
    { enabled: record?.id != null && originalCompanyId != null },
  );

  const isPrimaryOfOriginal =
    record?.id != null &&
    originalCompany?.primary_contact_id != null &&
    String(originalCompany.primary_contact_id) === String(record.id);

  const companyChanged =
    record?.id != null &&
    selectedCompanyId != null &&
    originalCompanyId != null &&
    String(selectedCompanyId) !== String(originalCompanyId) &&
    !hasDraft;

  const needsPrimaryMoveConfirm =
    isPrimaryOfOriginal && (companyChanged || hasDraft);

  const selectCompany = (company: Company) => {
    setOptimisticCompany(company);
    field.onChange(company.id);
    setValue(COMPANY_DRAFT_NAME_FIELD, "");
    setValue(COMPANY_DRAFT_SECTOR_FIELD, "");
    setValue(PRIMARY_MOVE_CONFIRMED_FIELD, false);
    clearErrors("company_id");
    setSearchOpen(false);
    setSearchQuery("");
    setShowAddCompany(false);
  };

  const clearSelection = () => {
    setOptimisticCompany(null);
    field.onChange(null);
    setValue(COMPANY_DRAFT_NAME_FIELD, "");
    setValue(COMPANY_DRAFT_SECTOR_FIELD, "");
    setValue(PRIMARY_MOVE_CONFIRMED_FIELD, false);
    setShowAddCompany(false);
  };

  const applyDraftCompany = (name: string, sector: string) => {
    field.onChange(null);
    setValue(COMPANY_DRAFT_NAME_FIELD, name);
    setValue(COMPANY_DRAFT_SECTOR_FIELD, sector);
    setValue(PRIMARY_MOVE_CONFIRMED_FIELD, false);
    clearErrors("company_id");
    setShowAddCompany(false);
  };

  const rowTitle = activeCompany?.name?.trim() ?? "";
  const rowSubtitle = companySectorLabel(activeCompany?.sector);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Company</Label>

      <EntitySearchToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
        searchPlaceholder="Search companies…"
        addButtonLabel="Add company"
        addButtonIcon={<Building2 className="size-4" />}
        onAddClick={() => setShowAddCompany((open) => !open)}
        isFetching={isFetching}
        emptyMessage="Type to search companies."
        emptySearchMessage="No companies match your search."
        groupHeading="Companies"
      >
        {!isFetching && trimmedSearch.length > 0 ? (
          companies.length === 0 ? (
            <CommandEmpty>No companies match your search.</CommandEmpty>
          ) : (
            <EntitySearchGroup heading="Companies">
              {companies.map((company) => {
                const isSelected =
                  selectedCompanyId != null &&
                  String(company.id) === String(selectedCompanyId);

                return (
                  <EntitySearchOption
                    key={String(company.id)}
                    label={company.name}
                    sublabel={companySectorLabel(company.sector) || undefined}
                    selected={isSelected}
                    onSelect={() => selectCompany(company)}
                  />
                );
              })}
            </EntitySearchGroup>
          )
        ) : null}
      </EntitySearchToolbar>

      {showAddCompany ? (
        <AddCompanyDraftPanel
          onApply={applyDraftCompany}
          onCancel={() => setShowAddCompany(false)}
        />
      ) : null}

      {hasSelection && rowTitle ? (
        <SelectedEntityRow
          title={rowTitle}
          subtitle={rowSubtitle || undefined}
          profileHref={
            activeCompany?.id != null
              ? getClientShowPath(activeCompany.id)
              : undefined
          }
          onRemove={clearSelection}
          removeAriaLabel="Remove company"
        />
      ) : null}

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

const AddCompanyDraftPanel = ({
  onApply,
  onCancel,
}: {
  onApply: (name: string, sector: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const sectorError = name.trim() && !sector.trim();

  return (
    <div className="space-y-3 rounded-md border bg-muted/10 p-3">
      <p className="text-sm font-medium">New company</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-company-draft-name">Business name</Label>
          <input
            id="contact-company-draft-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            )}
            placeholder="Company name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-company-draft-sector">Industry</Label>
          <select
            id="contact-company-draft-sector"
            value={sector}
            onChange={(event) => setSector(event.target.value)}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            )}
          >
            <option value="">Select industry…</option>
            {LBS_COMPANY_INDUSTRY_CHOICES.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.name}
              </option>
            ))}
          </select>
          {sectorError ? (
            <p className="text-xs text-destructive">Industry is required</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!name.trim() || !sector.trim()}
          onClick={() => onApply(name.trim(), sector.trim())}
        >
          Use this company
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Saved with the contact — nothing is written until you save the contact
        form.
      </p>
    </div>
  );
};
