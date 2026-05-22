import { useEffect, useMemo, useState } from "react";
import { useGetList, type Identifier } from "ra-core";
import { MessageSquarePlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact, Conversation } from "@/lbs/types";
import { useOpenClientSms } from "@/lbs/messages/useClientSms";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";

const getContactLabel = (contact: Contact) =>
  `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
  contact.email_jsonb?.[0]?.email ||
  `Contact #${contact.id}`;

const getContactPhoneLabel = (contact: Contact) => {
  const phone = contact.phone_jsonb?.[0]?.number;
  return phone ? formatUsPhoneDisplayFromAny(phone) : "No phone";
};

export const NewClientSmsDialog = ({
  open,
  onOpenChange,
  onConversationCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversation: Conversation) => void;
}) => {
  const [selectedContactId, setSelectedContactId] = useState<Identifier | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { openClientSms } = useOpenClientSms();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedContactId(null);
    }
  }, [open]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const { data: contacts = [], isPending } = useGetList<Contact>(
    "contacts",
    {
      filter: debouncedQuery ? { q: debouncedQuery } : {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: open, staleTime: 15_000 },
  );

  const smsContacts = useMemo(
    () => contacts.filter((contact) => (contact.phone_jsonb?.length ?? 0) > 0),
    [contacts],
  );

  const handleCreate = async () => {
    const contact = smsContacts.find(
      (entry) => String(entry.id) === String(selectedContactId),
    );
    if (!contact) return;

    setIsCreating(true);
    try {
      const conversation = await openClientSms(contact);
      onConversationCreated(conversation);
      onOpenChange(false);
      setSelectedContactId(null);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Text a client</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Choose a client contact with a phone number to start an SMS thread.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, company, email, or phone..."
            className="bg-muted/40 pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border bg-muted/20 p-1">
          {isPending ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</p>
          ) : smsContacts.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {debouncedQuery
                ? "No contacts match your search."
                : "No contacts with phone numbers yet."}
            </p>
          ) : (
            smsContacts.map((contact) => {
              const label = getContactLabel(contact);
              const isSelected = String(contact.id) === String(selectedContactId);

              return (
                <button
                  key={String(contact.id)}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-background ${
                    isSelected ? "bg-background shadow-sm" : ""
                  }`}
                  onClick={() => setSelectedContactId(contact.id)}
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">
                    {label
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {getContactPhoneLabel(contact)}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!selectedContactId || isCreating}
          >
            Start SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const NewClientSmsButton = ({
  onConversationCreated,
  className,
}: {
  onConversationCreated: (conversation: Conversation) => void;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={className}
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="size-4" />
        Text client
      </Button>
      <NewClientSmsDialog
        open={open}
        onOpenChange={setOpen}
        onConversationCreated={onConversationCreated}
      />
    </>
  );
};
