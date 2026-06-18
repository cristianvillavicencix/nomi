import { useEffect, useMemo, useState } from "react";
import {
  Form,
  useCreate,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import { Link, useNavigate } from "react-router";
import { Loader2, X } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
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
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  getContactEmail,
  getContactFullName,
} from "@/modules/clients/clientShowUtils";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";
import { TicketDescriptionComposer } from "@/modules/tickets/TicketDescriptionComposer";
import { CONTACT_STATUS_FILTER } from "@/modules/shared/relatedFilters";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const NEW_TICKET_FORM_ID = "lbs-new-ticket-form";

const statusChoices = [
  { id: "new", name: "New" },
  { id: "open", name: "Open" },
  { id: "waiting", name: "Waiting" },
  { id: "resolved", name: "Resolved" },
];

const priorityChoices = [
  { id: "low", name: "Low" },
  { id: "normal", name: "Normal" },
  { id: "high", name: "High" },
  { id: "urgent", name: "Urgent" },
];

type NewTicketFormValues = {
  subject: string;
  status: string;
  priority: string;
  company_id: Identifier | null;
  contact_id: Identifier | null;
  description: string;
};

type NewTicketDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompanyId?: Identifier | null;
  defaultContactId?: Identifier | null;
  onCreated?: (ticketId: Identifier) => void;
};

export const NewTicketDialog = ({
  open,
  onOpenChange,
  defaultCompanyId = null,
  defaultContactId = null,
  onCreated,
}: NewTicketDialogProps) => {
  const isMobile = useIsMobile();
  const [isSaving, setIsSaving] = useState(false);
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [create] = useCreate();

  const defaultValues = useMemo(
    (): NewTicketFormValues => ({
      subject: "",
      status: "new",
      priority: "normal",
      company_id: defaultCompanyId ?? null,
      contact_id: defaultContactId ?? null,
      description: "",
    }),
    [defaultCompanyId, defaultContactId, open],
  );

  const handleSubmit = async (values: NewTicketFormValues) => {
    const subject = values.subject.trim();
    if (!subject) {
      notify("Subject is required", { type: "warning" });
      return;
    }

    setIsSaving(true);
    try {
      let requesterEmail: string | null = null;
      let requesterName: string | null = null;

      if (values.contact_id != null) {
        const { data: contact } = await dataProvider.getOne<Contact>(
          "contacts",
          { id: values.contact_id },
        );
        requesterEmail = getContactEmail(contact) || null;
        requesterName = getContactFullName(contact) || null;
      }

      const ticket = (await create(
        "tickets",
        {
          data: {
            subject,
            status: values.status || "new",
            priority: values.priority || "normal",
            company_id: values.company_id,
            contact_id: values.contact_id,
            organization_member_id: identity?.id,
            inbox_address: DEFAULT_TICKET_INBOX_EMAIL,
            requester_email: requesterEmail,
            requester_name: requesterName,
          },
        },
        { returnPromise: true },
      )) as { id: Identifier };

      const description = values.description.trim();
      if (description && ticket?.id != null) {
        await dataProvider.replyTicket({
          ticketId: ticket.id,
          body: description,
          isInternalNote: true,
        });
      }

      refresh();
      onOpenChange(false);
      onCreated?.(ticket.id);

      notify(
        <span>
          Ticket created.{" "}
          <Link
            to={`/tickets/${ticket.id}/show`}
            className="font-medium underline underline-offset-2"
          >
            Open ticket
          </Link>
        </span>,
        { type: "info", autoHideDuration: 8000 },
      );

      navigate(`/tickets/${ticket.id}/show`);
    } catch (error) {
      console.error("[NewTicketDialog] create failed", error);
      notify(
        error instanceof Error ? error.message : "Failed to create ticket",
        { type: "error" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

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
          id={NEW_TICKET_FORM_ID}
          className="flex min-h-0 flex-1 flex-col"
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
        >
          <FormGuardProvider enabled={false}>
            <NewTicketDialogBody
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

const NewTicketDialogBody = ({
  isMobile,
  isSaving,
  onOpenChange,
}: {
  isMobile: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const guardedClose = useGuardedDialogClose(onOpenChange);
  const { setValue } = useFormContext<NewTicketFormValues>();
  const companyId = useWatch({ name: "company_id" });
  const contactId = useWatch({ name: "contact_id" });
  const subject = useWatch({ name: "subject" });

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

  const contactChoices = useMemo(
    () =>
      companyContacts.map((contact) => ({
        id: contact.id,
        name: getContactFullName(contact),
      })),
    [companyContacts],
  );

  const selectedContact = useMemo(
    () => companyContacts.find((contact) => contact.id === contactId),
    [companyContacts, contactId],
  );

  const templateContext = useMemo(
    () => ({
      clientName:
        selectedContact != null
          ? getContactFullName(selectedContact).split(/\s+/)[0] || "there"
          : "there",
      subject: String(subject ?? "").trim() || "your case",
    }),
    [selectedContact, subject],
  );

  useEffect(() => {
    if (!companyId) {
      setValue("contact_id", null);
      return;
    }
    if (
      contactId != null &&
      !companyContacts.some((contact) => contact.id === contactId)
    ) {
      setValue("contact_id", null);
    }
  }, [companyId, contactId, companyContacts, setValue]);

  return (
    <>
      <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
        <DialogTitle>New ticket</DialogTitle>
        <DialogDescription>
          Create a support ticket. Subject is usually the client website — search
          Google or type any URL.
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
            mode="business"
            placeholder="Website URL or search on Google…"
            helperText="Pick a Google business to fill the website, or type any subject."
            validate={(value) =>
              typeof value === "string" && value.trim().length > 0
                ? undefined
                : "Subject is required"
            }
            onPlaceDetails={(details) => {
              const website = details.website?.trim();
              if (website) {
                setValue("subject", website, { shouldDirty: true });
              }
            }}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput
              source="status"
              label="Status"
              choices={statusChoices}
              helperText={false}
            />
            <SelectInput
              source="priority"
              label="Priority"
              choices={priorityChoices}
              helperText={false}
            />
          </div>

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
              helperText={
                companyId
                  ? false
                  : "Select a company to see its contacts"
              }
              disabled={!companyId}
              emptyText={
                companyId ? "No contacts for this company" : "Select a company first"
              }
            />
          </div>

          <TicketDescriptionComposer
            templateContext={templateContext}
            disabled={isSaving}
          />
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
          form={NEW_TICKET_FORM_ID}
          disabled={isSaving}
          className={cn("rounded-full px-5", isMobile && "w-full")}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create ticket"
          )}
        </DialogFormSubmitButton>
      </DialogFooter>
    </>
  );
};
