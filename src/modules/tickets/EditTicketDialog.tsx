import { useEffect, useMemo, useState } from "react";
import {
  Form,
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
  useUpdate,
  type Identifier,
} from "ra-core";
import { Loader2, X } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import {
  FormGuardProvider,
  useGuardedDialogClose,
} from "@/components/admin/form-guard";
import { DialogFormSubmitButton } from "@/components/admin/form-guard/DialogFormSubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import {
  contactMatchesId,
  resolveRequesterFromContactAndCompany,
} from "@/modules/tickets/ticketRequester";
import { CONTACT_STATUS_FILTER } from "@/modules/shared/relatedFilters";
import type { Ticket } from "@/modules/types";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const EDIT_TICKET_FORM_ID = "lbs-edit-ticket-form";

const priorityChoices = [
  { id: "low", name: "Low" },
  { id: "normal", name: "Normal" },
  { id: "high", name: "High" },
  { id: "urgent", name: "Urgent" },
];

type EditTicketFormValues = {
  subject: string;
  priority: string;
  company_id: Identifier | null;
  contact_id: Identifier | null;
  requester_email: string;
  requester_name: string;
};

type EditTicketDialogProps = {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export const EditTicketDialog = ({
  ticket,
  open,
  onOpenChange,
  onSaved,
}: EditTicketDialogProps) => {
  const isMobile = useIsMobile();
  const [isSaving, setIsSaving] = useState(false);
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();

  const defaultValues = useMemo(
    (): EditTicketFormValues => ({
      subject: ticket?.subject?.trim() ?? "",
      priority: ticket?.priority?.trim() || "normal",
      company_id: ticket?.company_id ?? null,
      contact_id: ticket?.contact_id ?? null,
      requester_email: ticket?.requester_email?.trim() ?? "",
      requester_name: ticket?.requester_name?.trim() ?? "",
    }),
    [ticket, open],
  );

  const handleSubmit = async (values: EditTicketFormValues) => {
    if (!ticket) return;

    const subject = values.subject.trim();
    if (!subject) {
      notify("Subject is required", { type: "warning" });
      return;
    }

    setIsSaving(true);
    try {
      let contact: Contact | null = null;
      let company: Company | null = null;

      if (values.contact_id != null) {
        const { data } = await dataProvider.getOne<Contact>("contacts", {
          id: values.contact_id,
        });
        contact = data;
      }

      if (values.company_id != null) {
        const { data } = await dataProvider.getOne<Company>("companies", {
          id: values.company_id,
        });
        company = data;
      }

      const resolved = resolveRequesterFromContactAndCompany(contact, company);
      const requesterEmail =
        values.requester_email.trim() || resolved.email || null;
      const requesterName =
        values.requester_name.trim() || resolved.name || null;

      await update(
        "tickets",
        {
          id: ticket.id,
          data: {
            subject,
            priority: values.priority || "normal",
            company_id: values.company_id,
            contact_id: values.contact_id,
            requester_email: requesterEmail,
            requester_name: requesterName,
          },
          previousData: ticket,
        },
        { returnPromise: true },
      );

      refresh();
      onOpenChange(false);
      onSaved?.();
      notify("Ticket updated", { type: "success" });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to update ticket",
        { type: "error" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!open || !ticket) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-2xl",
          isMobile &&
            "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
        )}
      >
        <Form
          id={EDIT_TICKET_FORM_ID}
          key={ticket.id}
          className="flex min-h-0 flex-1 flex-col"
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
        >
          <FormGuardProvider enabled={false}>
            <EditTicketDialogBody
              ticket={ticket}
              isMobile={isMobile}
              isSaving={isSaving}
              onOpenChange={onOpenChange}
            />
          </FormGuardProvider>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const EditTicketDialogBody = ({
  ticket,
  isMobile,
  isSaving,
  onOpenChange,
}: {
  ticket: Ticket;
  isMobile: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const guardedClose = useGuardedDialogClose(onOpenChange);
  const { setValue } = useFormContext<EditTicketFormValues>();
  const companyId = useWatch({ name: "company_id" });
  const contactId = useWatch({ name: "contact_id" });
  const requesterEmail = useWatch({ name: "requester_email" });
  const requesterName = useWatch({ name: "requester_name" });

  const { data: companyContacts = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: {
        "company_id@eq": companyId,
        "status@in": CONTACT_STATUS_FILTER,
      },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: Boolean(companyId), staleTime: 30_000 },
  );

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId ?? "" },
    { enabled: Boolean(companyId) },
  );

  const contactChoices = useMemo(
    () =>
      companyContacts.map((contact) => ({
        id: contact.id,
        name: getContactFullName(contact),
      })),
    [companyContacts],
  );

  const selectedContact = useMemo(
    () =>
      companyContacts.find((contact) => contactMatchesId(contact, contactId)),
    [companyContacts, contactId],
  );

  const recipientFromClient = useMemo(
    () => resolveRequesterFromContactAndCompany(selectedContact ?? null, company),
    [selectedContact, company],
  );

  const contactEmptyText = !companyId
    ? "Select a company first"
    : contactChoices.length === 0
      ? "No contacts for this company"
      : "Select contact";

  useEffect(() => {
    if (!companyId) {
      setValue("contact_id", null);
      return;
    }

    if (
      contactId != null &&
      companyContacts.some((contact) => contactMatchesId(contact, contactId))
    ) {
      return;
    }

    if (companyContacts.length === 1) {
      setValue("contact_id", companyContacts[0].id);
      return;
    }

    const primaryId = company?.primary_contact_id;
    if (primaryId != null) {
      const primaryContact = companyContacts.find((contact) =>
        contactMatchesId(contact, primaryId),
      );
      if (primaryContact) {
        setValue("contact_id", primaryContact.id);
      }
    }
  }, [companyId, contactId, companyContacts, company, setValue]);

  useEffect(() => {
    if (contactId && !selectedContact) return;

    const resolved = resolveRequesterFromContactAndCompany(
      selectedContact ?? null,
      company,
    );

    if (resolved.email) {
      setValue("requester_email", resolved.email, { shouldDirty: true });
    }
    if (resolved.name) {
      setValue("requester_name", resolved.name, { shouldDirty: true });
    }
  }, [contactId, selectedContact, company, setValue]);

  const showManualRecipient = !(
    contactId &&
    selectedContact &&
    (recipientFromClient.email || requesterEmail?.trim())
  );

  const displayName =
    requesterName?.trim() || recipientFromClient.name || "Contact";
  const displayEmail =
    requesterEmail?.trim() || recipientFromClient.email || null;

  return (
    <>
      <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
        <DialogTitle>Edit ticket #{ticket.id}</DialogTitle>
        <DialogDescription>
          Update the subject, client, or contact. Replies are sent to the
          selected contact&apos;s email automatically.
        </DialogDescription>
        <DialogClose
          className="absolute top-3.5 right-3.5 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          disabled={isSaving}
          onClick={(event) => {
            event.preventDefault();
            guardedClose(false);
          }}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4">
          <GooglePlacesAutocompleteInput
            source="subject"
            label="Subject"
            mode="address"
            placeholder="Job site address or search on Google…"
            helperText="Pick a Google address suggestion, or type any subject."
            validate={(value) =>
              typeof value === "string" && value.trim().length > 0
                ? undefined
                : "Subject is required"
            }
            onPlaceDetails={(details) => {
              const address =
                details.formattedAddress?.trim() || details.name?.trim();
              if (address) {
                setValue("subject", address, { shouldDirty: true });
              }
            }}
          />

          <SelectInput
            source="priority"
            label="Priority"
            choices={priorityChoices}
            helperText={false}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <ReferenceInput source="company_id" reference="companies">
              <AutocompleteInput optionText="name" label="Company" helperText={false} />
            </ReferenceInput>
            <SelectInput
              source="contact_id"
              label="Contact"
              choices={contactChoices}
              optionText="name"
              optionValue="id"
              helperText={false}
              disabled={!companyId}
              emptyText={contactEmptyText}
            />
          </div>

          {contactId && selectedContact && displayEmail && !showManualRecipient ? (
            <div className="rounded-lg border bg-muted/25 px-3 py-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reply recipient
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {displayName}
              </p>
              <p className="text-sm text-muted-foreground">{displayEmail}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                When you send a reply on this ticket, it goes to this contact.
                Pick a different contact above to change it.
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-dashed px-3 py-3">
              <p className="text-xs text-muted-foreground">
                {contactId
                  ? "This contact has no email on file. Enter who should receive replies."
                  : "Select a contact, or enter who should receive replies manually."}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  source="requester_name"
                  label="Recipient name"
                  helperText={false}
                />
                <TextInput
                  source="requester_email"
                  label="Recipient email"
                  helperText={false}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <DialogFooter
        className={cn(
          "shrink-0 gap-2 border-t bg-background px-5 py-4 sm:px-6",
          isMobile && "flex-col-reverse",
        )}
      >
        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          className={cn(isMobile && "w-full")}
          onClick={() => guardedClose(false)}
        >
          Cancel
        </Button>
        <DialogFormSubmitButton
          form={EDIT_TICKET_FORM_ID}
          disabled={isSaving}
          className={cn("rounded-full px-5", isMobile && "w-full")}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </DialogFormSubmitButton>
      </DialogFooter>
    </>
  );
};
