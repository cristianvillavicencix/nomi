import { useState, type ReactNode } from "react";
import type { Identifier } from "ra-core";
import { Plus } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { IconButton } from "@/components/ui/icon-button";
import { QuickMeetingContactCreateDialog } from "@/modules/meetings/QuickMeetingContactCreateDialog";
import {
  useWorkCreateAccountLinkSync,
  WorkCreateAccountLinkInitializer,
} from "@/modules/work/useWorkCreateAccountLinkSync";

const dealOptionText = (choice: {
  name?: string | null;
  id?: number | string;
}) => choice.name?.trim() || `Project #${choice.id}`;

export type WorkCreateAccountLinkFieldsProps = {
  /** When true, primary contact is required (meetings). */
  requireContact?: boolean;
  /** Show quick-add contact button (meetings). */
  showCreateContact?: boolean;
  /** Optional section title; omit for a compact block. */
  title?: string | null;
  /** Table row wrapper for meeting layout. */
  renderRow?: (label: string, children: ReactNode) => ReactNode;
  /** Hide inner field labels when using renderRow. */
  hideFieldLabels?: boolean;
};

export const WorkCreateAccountLinkFields = ({
  requireContact = false,
  showCreateContact = false,
  title = "Link to (optional)",
  renderRow,
  hideFieldLabels = Boolean(renderRow),
}: WorkCreateAccountLinkFieldsProps) => {
  const { setValue } = useFormContext();
  const { companyId, contactChoices } = useWorkCreateAccountLinkSync();
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [createContactSeed, setCreateContactSeed] = useState("");

  const openCreateContact = (searchText?: string) => {
    setCreateContactSeed(searchText?.trim() ?? "");
    setCreateContactOpen(true);
  };

  const contactField = (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <SelectInput
          source="contact_id"
          label={hideFieldLabels ? false : "Primary contact"}
          choices={contactChoices}
          optionText="name"
          optionValue="id"
          helperText={false}
          disabled={!companyId}
          emptyText="None"
          validate={
            requireContact
              ? (value) => (value ? undefined : "Required")
              : undefined
          }
        />
      </div>
      {showCreateContact ? (
        <IconButton
          variant="secondary"
          className={hideFieldLabels ? "mt-0.5 shrink-0" : "mt-6 shrink-0"}
          title="Add new contact"
          aria-label="Add new contact"
          onClick={() => openCreateContact()}
        >
          <Plus className="size-4" />
        </IconButton>
      ) : null}
    </div>
  );

  const accountField = (
    <ReferenceInput source="company_id" reference="companies">
      <AutocompleteInput
        label={hideFieldLabels ? false : "Account"}
        optionText="name"
        helperText={false}
        emptyText="None"
        filterToQuery={(searchText) => ({ q: searchText })}
      />
    </ReferenceInput>
  );

  const projectField = (
    <ReferenceInput
      source="deal_id"
      reference="deals"
      filter={
        companyId
          ? { "company_id@eq": companyId }
          : { "id@eq": -1 }
      }
    >
      <AutocompleteInput
        label={hideFieldLabels ? false : "Project"}
        optionText={dealOptionText}
        helperText={false}
        disabled={!companyId}
        emptyText="None"
        filterToQuery={(searchText) => ({ q: searchText })}
      />
    </ReferenceInput>
  );

  const fields = renderRow ? (
    <>
      {renderRow("Account", accountField)}
      {renderRow(
        requireContact ? "Contact" : "Primary contact",
        contactField,
      )}
      {renderRow("Project", projectField)}
    </>
  ) : (
    <div className="space-y-4">
      {title ? <p className="text-sm font-medium">{title}</p> : null}
      {accountField}
      {contactField}
      {projectField}
    </div>
  );

  return (
    <>
      <WorkCreateAccountLinkInitializer />
      {fields}
      {showCreateContact ? (
        <QuickMeetingContactCreateDialog
          open={createContactOpen}
          onOpenChange={setCreateContactOpen}
          initialName={createContactSeed}
          companyId={companyId ?? null}
          leadSourceOther="Schedule meeting"
          description="Save and select them for this meeting"
          onCreated={(created) => {
            if (created.company_id) {
              setValue("company_id", created.company_id as Identifier, {
                shouldDirty: true,
              });
            }
            setValue("contact_id", created.id as Identifier, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
      ) : null}
    </>
  );
};
