import { useEffect, useMemo, useState } from "react";
import { Link2, Loader2, UserPlus } from "lucide-react";
import { useDataProvider, useNotify, useRefresh, useUpdate } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact, Conversation } from "@/modules/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { ContactDuplicateResolveDialog } from "@/modules/contacts/ContactDuplicateResolveDialog";
import {
  findContactsByPhone,
  type CreateDuplicateMatch,
} from "@/modules/contacts/contactDuplicateUtils";
import { ContactFormDialog } from "@/modules/contacts/ContactFormDialog";
import { LBS_LEAD_SOURCE_OTHER } from "@/modules/leads/leadFormConstants";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";
import { cn } from "@/lib/utils";

const buildContactCreateDefaultsFromSms = (phoneE164: string) => ({
  phone_jsonb: [{ number: phoneE164, type: "Mobile" as const }],
  status: "lead",
  lead_stage: "new",
  lead_source: LBS_LEAD_SOURCE_OTHER,
  lead_source_other: "SMS",
});

type SaveSmsContactDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneE164: string;
  conversation?: Conversation | null;
  onSaved: (contact: Contact) => void;
};

export const SaveSmsContactDialog = ({
  open,
  onOpenChange,
  phoneE164,
  conversation,
  onSaved,
}: SaveSmsContactDialogProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [matches, setMatches] = useState<CreateDuplicateMatch[]>([]);
  const [pickExistingOpen, setPickExistingOpen] = useState(false);
  const [createFormOpen, setCreateFormOpen] = useState(false);

  const phoneLabel = formatUsPhoneDisplayFromAny(phoneE164);
  const createDefaults = useMemo(
    () => buildContactCreateDefaultsFromSms(phoneE164),
    [phoneE164],
  );

  const resetFlow = () => {
    setMatches([]);
    setPickExistingOpen(false);
    setCreateFormOpen(false);
    setIsLoadingMatches(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetFlow();
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoadingMatches(true);
    void findContactsByPhone(dataProvider, phoneE164, phoneLabel)
      .then((nextMatches) => {
        if (!cancelled) {
          setMatches(nextMatches);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingMatches(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataProvider, open, phoneE164, phoneLabel]);

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

  const finishWithContact = async (contact: Contact, message: string) => {
    await linkConversationToContact(contact);
    notify(message, { type: "info" });
    refresh();
    onSaved(contact);
    handleOpenChange(false);
  };

  const hasExistingMatches = matches.length > 0;
  const choiceDialogOpen = open && !pickExistingOpen && !createFormOpen;

  return (
    <>
      <Dialog open={choiceDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b px-6 py-4 text-left">
            <DialogTitle>Save contact</DialogTitle>
            <DialogDescription>
              Is {phoneLabel} already in your CRM, or is this a new contact?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Phone
              </p>
              <p className="mt-1 text-sm font-medium">{phoneLabel}</p>
            </div>

            {isLoadingMatches ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Checking for existing contacts…
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={!hasExistingMatches}
                  onClick={() => setPickExistingOpen(true)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    hasExistingMatches
                      ? "hover:border-primary/40 hover:bg-muted/40"
                      : "cursor-not-allowed opacity-60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Link2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        Link to existing contact
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {hasExistingMatches
                          ? `${matches.length} contact${matches.length === 1 ? "" : "s"} already use this number`
                          : "No contact with this number was found"}
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateFormOpen(true)}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                      <UserPlus className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Create new contact</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Open the full contact form with this phone prefilled
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactDuplicateResolveDialog
        open={pickExistingOpen}
        onOpenChange={setPickExistingOpen}
        matches={matches}
        pending={{
          phone: phoneLabel,
        }}
        onUseExisting={(contact) => {
          void finishWithContact(contact, "Linked to existing contact");
        }}
        onCreateAnyway={async () => {
          setPickExistingOpen(false);
          setCreateFormOpen(true);
        }}
      />

      <ContactFormDialog
        open={createFormOpen}
        onOpenChange={setCreateFormOpen}
        navigateOnCreate={false}
        createDefaults={createDefaults}
        title="Create contact from SMS"
        description={`Add ${phoneLabel} using the standard contact form.`}
        submitLabel="Create and link contact"
        onCreated={(contact) => {
          void finishWithContact(contact, "Contact created");
        }}
      />
    </>
  );
};
