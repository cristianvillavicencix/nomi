import { useState } from "react";
import { Loader2, Plus, UserPlus } from "lucide-react";
import {
  Form,
  useCreate,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { ContactDuplicateResolveDialog } from "@/modules/contacts/ContactDuplicateResolveDialog";
import { findMatchingContacts } from "@/modules/contacts/contactDuplicateUtils";
import {
  buildQuickMeetingContactPayload,
  validateQuickMeetingContactForm,
  type QuickMeetingContactFormValues,
} from "@/modules/meetings/buildQuickMeetingContactPayload";

const defaultValues: QuickMeetingContactFormValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
};

export type QuickMeetingContactCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contact: Contact) => void;
  initialName?: string;
  /** Stored on the lead as lead_source_other (default: Quick call). */
  leadSourceOther?: string;
  description?: string;
};

export const QuickMeetingContactCreateDialog = ({
  open,
  onOpenChange,
  onCreated,
  initialName = "",
  leadSourceOther = "Quick call",
  description = "Save and use them for this call",
}: QuickMeetingContactCreateDialogProps) => {
  const [formKey, setFormKey] = useState(0);
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<
    Awaited<ReturnType<typeof findMatchingContacts>>
  >([]);
  const [duplicatePromptOpen, setDuplicatePromptOpen] = useState(false);
  const [pendingValues, setPendingValues] =
    useState<QuickMeetingContactFormValues | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormKey((value) => value + 1);
      setDuplicateMatches([]);
      setDuplicatePromptOpen(false);
      setPendingValues(null);
    }
    onOpenChange(nextOpen);
  };

  const createContact = async (values: QuickMeetingContactFormValues) => {
    const contact = (await create(
      "contacts",
      {
        data: buildQuickMeetingContactPayload(values, identity?.id, {
          leadSourceOther,
        }),
      },
      { returnPromise: true },
    )) as Contact;

    notify("Contact created", { type: "info" });
    refresh();
    onCreated(contact);
    handleOpenChange(false);
  };

  const handleSubmit = async (values: QuickMeetingContactFormValues) => {
    const validationError = validateQuickMeetingContactForm(values);
    if (validationError) {
      notify(validationError, { type: "warning" });
      return;
    }

    setIsSaving(true);
    try {
      const matches = await findMatchingContacts(dataProvider, {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone,
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
        error instanceof Error ? error.message : "Could not create contact",
        { type: "error" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const nameSeed = initialName.trim();
  const seededDefaults: QuickMeetingContactFormValues = nameSeed
    ? {
        ...defaultValues,
        first_name: nameSeed.split(/\s+/)[0] ?? "",
        last_name: nameSeed.split(/\s+/).slice(1).join(" "),
      }
    : defaultValues;

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <Form
            key={`${formKey}-${nameSeed}`}
            defaultValues={seededDefaults}
            onSubmit={handleSubmit}
          >
            <DialogHeader className="border-b px-6 py-4 text-left">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                  <UserPlus className="size-4" />
                </div>
                <div>
                  <DialogTitle>New contact</DialogTitle>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quick-contact-first-name">First name</Label>
                  <TextInput
                    source="first_name"
                    label={false}
                    helperText={false}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-contact-last-name">Last name</Label>
                  <TextInput
                    source="last_name"
                    label={false}
                    helperText={false}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <EmailInput
                  source="email"
                  label={false}
                  helperText={false}
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <PhoneInput
                  source="phone"
                  label={false}
                  helperText={false}
                  placeholder="(555) 555-0100"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Add at least an email or phone number so you can share the video
                link.
              </p>
            </div>

            <DialogFooter className="border-t px-6 py-4 sm:justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Save contact
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
          first_name: pendingValues?.first_name,
          last_name: pendingValues?.last_name,
          email: pendingValues?.email,
          phone: pendingValues?.phone,
        }}
        onUseExisting={(contact) => {
          onCreated(contact);
          handleOpenChange(false);
        }}
        onCreateAnyway={async () => {
          if (!pendingValues) return;
          await createContact(pendingValues);
        }}
      />
    </>
  );
};
