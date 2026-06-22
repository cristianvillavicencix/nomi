import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import {
  Form,
  useCreate,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
  useUpdate,
  type Identifier,
} from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact, Conversation } from "@/modules/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { ContactDuplicateResolveDialog } from "@/modules/contacts/ContactDuplicateResolveDialog";
import { findMatchingContacts } from "@/modules/contacts/contactDuplicateUtils";
import { LBS_LEAD_SOURCE_OTHER } from "@/modules/leads/leadFormConstants";
import { applyLeadAssignmentFields } from "@/modules/leads/leadAssignments";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";

export type SaveSmsContactKind = "lead" | "contact_only";

type SaveSmsContactFormValues = {
  first_name: string;
  last_name: string;
  save_as: SaveSmsContactKind;
};

const SAVE_AS_CHOICES = [
  {
    id: "lead" as const,
    name: "Lead — add to pipeline (New)",
  },
  {
    id: "contact_only" as const,
    name: "Contact only — directory, no pipeline",
  },
];

const buildSmsContactPayload = (
  values: SaveSmsContactFormValues,
  phoneE164: string,
  organizationMemberId?: Identifier | null,
) => {
  const now = new Date().toISOString();
  const displayPhone = formatUsPhoneDisplayFromAny(phoneE164);

  const base = {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email_jsonb: [],
    phone_jsonb: [{ number: displayPhone, type: "Mobile" }],
    company_id: null,
    title: "",
    background: "",
    first_seen: now,
    last_seen: now,
    tags: [],
    organization_member_id: organizationMemberId ?? null,
    assigned_member_ids:
      organizationMemberId != null && organizationMemberId !== ""
        ? [organizationMemberId]
        : [],
  };

  if (values.save_as === "contact_only") {
    return applyLeadAssignmentFields({
      ...base,
      status: "contact_only",
      lead_stage: null,
      lead_source: null,
      lead_source_other: null,
      interested_service: null,
    });
  }

  return applyLeadAssignmentFields({
    ...base,
    status: "lead",
    lead_stage: "new",
    lead_source: LBS_LEAD_SOURCE_OTHER,
    lead_source_other: "SMS",
    interested_service: null,
  });
};

const savedNotifyMessage = (saveAs: SaveSmsContactKind) =>
  saveAs === "lead" ? "Lead created" : "Contact saved";

export const SaveSmsContactDialog = ({
  open,
  onOpenChange,
  phoneE164,
  conversation,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneE164: string;
  conversation?: Conversation | null;
  onSaved: (contact: Contact) => void;
}) => {
  const [formKey, setFormKey] = useState(0);
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();
  const [update] = useUpdate();
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<
    Awaited<ReturnType<typeof findMatchingContacts>>
  >([]);
  const [duplicatePromptOpen, setDuplicatePromptOpen] = useState(false);
  const [pendingValues, setPendingValues] =
    useState<SaveSmsContactFormValues | null>(null);

  const phoneLabel = formatUsPhoneDisplayFromAny(phoneE164);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormKey((value) => value + 1);
      setDuplicateMatches([]);
      setDuplicatePromptOpen(false);
      setPendingValues(null);
    }
    onOpenChange(nextOpen);
  };

  const linkConversationToContact = async (contact: Contact) => {
    if (!conversation?.id) return;
    await update(
      "conversations",
      {
        id: conversation.id,
        data: { contact_id: contact.id },
        previousData: conversation,
      },
      { returnPromise: true },
    );
  };

  const createContact = async (values: SaveSmsContactFormValues) => {
    const contact = (await create(
      "contacts",
      {
        data: buildSmsContactPayload(values, phoneE164, identity?.id),
      },
      { returnPromise: true },
    )) as Contact;

    await linkConversationToContact(contact);
    notify(savedNotifyMessage(values.save_as), { type: "info" });
    refresh();
    onSaved(contact);
    handleOpenChange(false);
  };

  const handleSubmit = async (values: SaveSmsContactFormValues) => {
    if (!values.first_name.trim()) {
      notify("First name is required", { type: "warning" });
      return;
    }

    setIsSaving(true);
    try {
      const matches = await findMatchingContacts(dataProvider, {
        first_name: values.first_name,
        last_name: values.last_name,
        phone: phoneLabel,
      });

      if (matches.length > 0) {
        setPendingValues(values);
        setDuplicateMatches(matches);
        setDuplicatePromptOpen(true);
        return;
      }

      await createContact(values);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not save contact",
        { type: "error" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <Form
            key={`${formKey}-${phoneE164}`}
            defaultValues={{ first_name: "", last_name: "", save_as: "lead" }}
            onSubmit={handleSubmit}
          >
            <DialogHeader className="border-b px-6 py-4 text-left">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                  <UserPlus className="size-4" />
                </div>
                <div>
                  <DialogTitle>Save contact</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Add {phoneLabel} to your contacts
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 px-6 py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Phone
                </p>
                <p className="mt-1 text-sm font-medium">{phoneLabel}</p>
              </div>
              <TextInput source="first_name" label="First name" isRequired />
              <TextInput source="last_name" label="Last name" />
              <RadioButtonGroupInput
                source="save_as"
                label="Save as"
                choices={SAVE_AS_CHOICES}
                helperText="Leads appear in the pipeline. Contact only stays in your directory."
              />
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      <ContactDuplicateResolveDialog
        open={duplicatePromptOpen}
        onOpenChange={setDuplicatePromptOpen}
        matches={duplicateMatches}
        pending={{
          first_name: pendingValues?.first_name ?? "",
          last_name: pendingValues?.last_name ?? "",
          email: "",
          phone: phoneLabel,
        }}
        onUseExisting={async (contact) => {
          await linkConversationToContact(contact);
          notify("Linked to existing contact", { type: "info" });
          refresh();
          onSaved(contact);
          handleOpenChange(false);
        }}
        onCreateAnyway={async () => {
          if (!pendingValues) return;
          setIsSaving(true);
          try {
            await createContact(pendingValues);
          } catch (error) {
            notify(
              error instanceof Error ? error.message : "Could not save contact",
              { type: "error" },
            );
          } finally {
            setIsSaving(false);
          }
        }}
      />
    </>
  );
};
