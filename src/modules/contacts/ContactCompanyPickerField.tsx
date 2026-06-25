import { useMemo, useState, useEffect } from "react";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useGetOne,
  useInput,
  useNotify,
  useRecordContext,
  useRefresh,
  type Identifier,
} from "ra-core";
import { Building2, Check, Loader2 } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { CompanyInlineDraftFields } from "@/modules/contacts/CompanyInlineDraftFields";
import {
  COMPANY_DRAFT_FIELD_NAMES,
  COMPANY_DRAFT_NAME_FIELD,
  PRIMARY_MOVE_CONFIRMED_FIELD,
  clearCompanyDraftFormFields,
  companyDraftToCreateData,
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
) => {
  if (companyId != null && companyId !== "") return undefined;
  const draft = getCompanyDraftFromFormValues(values);
  if (draft?.name && draft.sector) return undefined;
  if (draft?.name && !draft.sector) return "Industry is required";
  return "Company is required";
};

export const ContactCompanyPickerField = () => {
  const record = useRecordContext<Contact>();
  const { setValue, clearErrors, register, getValues } = useFormContext();
  const [create] = useCreate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();

  useEffect(() => {
    register(PRIMARY_MOVE_CONFIRMED_FIELD);
    for (const field of COMPANY_DRAFT_FIELD_NAMES) {
      register(field);
    }
  }, [register]);

  const { field } = useInput({
    source: "company_id",
    validate: validateCompanySelection,
  });

  const moveConfirmed = useWatch({ name: PRIMARY_MOVE_CONFIRMED_FIELD }) as
    | boolean
    | undefined;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [panelInitialName, setPanelInitialName] = useState("");
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
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
  }, [fetchedCompany, hasSelectedCompany, optimisticCompany, selectedCompanyId]);

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
    setShowAddCompany(false);
    setPanelInitialName("");
  };

  const clearSelection = () => {
    setOptimisticCompany(null);
    field.onChange(null);
    clearCompanyDraftFormFields(setValue);
    setValue(PRIMARY_MOVE_CONFIRMED_FIELD, false);
    setShowAddCompany(false);
    setPanelInitialName("");
  };

  const openAddCompanyPanel = (initialName = "") => {
    clearCompanyDraftFormFields(setValue);
    setPanelInitialName(initialName);
    if (initialName) {
      setValue(COMPANY_DRAFT_NAME_FIELD, initialName, { shouldDirty: true });
    }
    setShowAddCompany(true);
    setSearchOpen(false);
  };

  const handleCreateCompany = async () => {
    const draft = getCompanyDraftFromFormValues(getValues());
    if (!draft?.name?.trim()) {
      notify("Company name is required", { type: "warning" });
      return;
    }
    if (!draft.sector?.trim()) {
      notify("Industry is required", { type: "warning" });
      return;
    }

    setIsCreatingCompany(true);
    try {
      const created = (await create(
        "companies",
        {
          data: companyDraftToCreateData(draft, identity?.id),
        },
        { returnPromise: true },
      )) as Company;

      if (!created?.id) {
        throw new Error("Failed to create company");
      }

      refresh();
      selectCompany(created);
      notify("Company created", { type: "info" });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to create company",
        { type: "error" },
      );
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const rowTitle = activeCompany?.name?.trim() ?? "";
  const rowSubtitle = companySectorLabel(activeCompany?.sector);
  const hasSelection = hasSelectedCompany && Boolean(rowTitle);

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
        onAddClick={() => openAddCompanyPanel()}
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
                onSelect={() => openAddCompanyPanel(trimmedSearch)}
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
          initialName={panelInitialName}
          isCreating={isCreatingCompany}
          onCreate={handleCreateCompany}
          onCancel={() => {
            setShowAddCompany(false);
            setPanelInitialName("");
            clearCompanyDraftFormFields(setValue);
          }}
        />
      ) : null}

      {hasSelection ? (
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
  initialName,
  isCreating,
  onCreate,
  onCancel,
}: {
  initialName: string;
  isCreating: boolean;
  onCreate: () => void;
  onCancel: () => void;
}) => {
  const { setValue } = useFormContext();

  useEffect(() => {
    if (!initialName) return;
    setValue(COMPANY_DRAFT_NAME_FIELD, initialName, { shouldDirty: true });
  }, [initialName, setValue]);

  return (
    <div className="space-y-3 rounded-md border bg-muted/10 p-3">
      <p className="text-sm font-medium">New company</p>
      <CompanyInlineDraftFields />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isCreating}
          onClick={onCreate}
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create company"
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isCreating}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The company is saved immediately and linked to this contact. You can
        finish and save the contact when ready.
      </p>
    </div>
  );
};

export { emptyCompanyDraftFormFields };
