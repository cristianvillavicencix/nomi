import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader2, UserCheck, UserPlus, UserRoundPlus } from "lucide-react";
import { useNotify, useRefresh, useUpdate } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact } from "@/components/atomic-crm/types";
import {
  CONFIDENCE_LABELS,
  buildEnrichedContactChannels,
  contactNeedsChannelEnrichment,
  formatContactChannels,
  getContactDisplayLabel,
  type CreateDuplicateMatch,
  type PendingContactChannels,
} from "@/modules/contacts/contactDuplicateUtils";
import { getLeadShowPath } from "@/app/routing";
import { cn } from "@/lib/utils";

export type ContactDuplicateResolveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: CreateDuplicateMatch[];
  pending: PendingContactChannels;
  onUseExisting: (contact: Contact) => void;
  onCreateAnyway: () => Promise<void>;
};

export const ContactDuplicateResolveDialog = ({
  open,
  onOpenChange,
  matches,
  pending,
  onUseExisting,
  onCreateAnyway,
}: ContactDuplicateResolveDialogProps) => {
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [selectedId, setSelectedId] = useState<string | number>(
    matches[0]?.contact.id,
  );
  const [isBusy, setIsBusy] = useState(false);

  const selected = useMemo(
    () => matches.find((match) => match.contact.id === selectedId)?.contact,
    [matches, selectedId],
  );

  const selectedMatch = useMemo(
    () => matches.find((match) => match.contact.id === selectedId),
    [matches, selectedId],
  );

  const canEnrich =
    selected != null &&
    contactNeedsChannelEnrichment(selected, {
      email: pending.email,
      phone: pending.phone,
    });

  const handleUseExisting = () => {
    if (!selected) return;
    onUseExisting(selected);
    onOpenChange(false);
  };

  const handleEnrichAndUse = async () => {
    if (!selected) return;
    setIsBusy(true);
    try {
      const channels = buildEnrichedContactChannels(selected, {
        email: pending.email,
        phone: pending.phone,
      });
      const { data } = await update(
        "contacts",
        {
          id: selected.id,
          data: channels,
          previousData: selected,
        },
        { returnPromise: true },
      );
      notify("Contact updated", { type: "info" });
      refresh();
      onUseExisting((data ?? selected) as Contact);
      onOpenChange(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not update contact",
        { type: "error" },
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateAnyway = async () => {
    setIsBusy(true);
    try {
      await onCreateAnyway();
      onOpenChange(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not create contact",
        { type: "error" },
      );
    } finally {
      setIsBusy(false);
    }
  };

  if (!open) return null;

  const topConfidence = selectedMatch?.confidence ?? matches[0]?.confidence;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>Existing contact found</DialogTitle>
          <DialogDescription>
            Someone in the CRM already uses this email or phone. Choose whether
            to reuse them, add missing info, or create a separate contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          {topConfidence ? (
            <ConfidenceBadge confidence={topConfidence} />
          ) : null}
          {selectedMatch?.reason ? (
            <p className="text-sm text-muted-foreground">{selectedMatch.reason}</p>
          ) : null}

          <ul className="space-y-2">
            {matches.map((match) => {
              const checked = match.contact.id === selectedId;
              const badge = CONFIDENCE_LABELS[match.confidence];
              return (
                <li
                  key={match.contact.id}
                  className={cn(
                    "rounded-md border p-3",
                    checked ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      className="mt-1"
                      checked={checked}
                      onChange={() => setSelectedId(match.contact.id)}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={getLeadShowPath(match.contact.id)}
                          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {getContactDisplayLabel(match.contact)}
                        </Link>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatContactChannels(match.contact)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Matched on {match.matchedOn.join(" and ")}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <DialogFooter className="flex-col gap-2 border-t px-6 py-4 sm:flex-col sm:items-stretch">
          <Button
            type="button"
            disabled={isBusy || !selected}
            onClick={handleUseExisting}
          >
            <UserCheck className="size-4" />
            Use existing contact
          </Button>
          {canEnrich ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy || !selected}
              onClick={() => void handleEnrichAndUse()}
            >
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserRoundPlus className="size-4" />
              )}
              Add missing email/phone to selected
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => void handleCreateAnyway()}
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Create new contact anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ConfidenceBadge = ({
  confidence,
}: {
  confidence: keyof typeof CONFIDENCE_LABELS;
}) => {
  const badge = CONFIDENCE_LABELS[confidence];
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        badge.className,
      )}
    >
      {badge.label}
    </span>
  );
};
