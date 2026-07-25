import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, useNotify } from "ra-core";
import { Copy, Loader2, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  BillToClientSearch,
  type BillToSelection,
} from "@/modules/billing/BillToClientSearch";
import { resolveBookingShareUrl } from "@/modules/booking/bookingFormatUtils";
import { contactHasSmsPhone } from "@/modules/messages/messageContactUtils";
import { useSendClientSms } from "@/modules/messages/useClientSms";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";

type BookNowShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const BookNowShareDialog = ({
  open,
  onOpenChange,
}: BookNowShareDialogProps) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const sendClientSms = useSendClientSms();
  const { smsEnabled } = useMessagingEnabled();

  const [recipient, setRecipient] = useState<BillToSelection | null>(null);
  const [customMessage, setCustomMessage] = useState(
    "Book a time with us using this link:",
  );
  const [generatedUrl, setGeneratedUrl] = useState("");

  useEffect(() => {
    if (!open) {
      setRecipient(null);
      setGeneratedUrl("");
      setCustomMessage("Book a time with us using this link:");
    }
  }, [open]);

  const selectedContact = recipient?.contact ?? null;
  const canSendSms =
    smsEnabled &&
    selectedContact != null &&
    contactHasSmsPhone(selectedContact);

  const previewMessage = useMemo(() => {
    const url = generatedUrl || `${window.location.origin}/b/example`;
    return `${customMessage.trim()}\n\n${url}`.trim();
  }, [customMessage, generatedUrl]);

  const generateMutation = useMutation({
    mutationFn: () =>
      dataProvider.generateBookingLink({
        contactId: recipient?.contactId ?? null,
        companyId: recipient?.companyId ?? null,
        dealId: null,
        organizationMemberId: identity?.id != null ? Number(identity.id) : null,
        expiresInDays: 30,
        baseUrl: window.location.origin,
      }),
    onSuccess: (result) => {
      setGeneratedUrl(resolveBookingShareUrl(result, window.location.origin));
    },
    onError: (error) => {
      notify(
        error instanceof Error
          ? error.message
          : "Failed to generate booking link",
        { type: "error" },
      );
    },
  });

  const ensureLink = async () => {
    if (generatedUrl) return generatedUrl;
    const result = await generateMutation.mutateAsync();
    const url = resolveBookingShareUrl(result, window.location.origin);
    setGeneratedUrl(url);
    return url;
  };

  const handleCopy = async () => {
    const url = await ensureLink();
    await navigator.clipboard.writeText(url);
    notify("Booking link copied", { type: "info" });
  };

  const handleSms = async () => {
    if (!selectedContact?.id) {
      notify("Select a contact with a phone number to send SMS", {
        type: "warning",
      });
      return;
    }
    const url = await ensureLink();
    const body = `${customMessage.trim()}\n${url}`.trim();
    await sendClientSms({
      contactId: selectedContact.id,
      companyId: recipient?.companyId ?? selectedContact.company_id ?? null,
      body,
    });
    notify("Booking link sent via SMS", { type: "info" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book now</DialogTitle>
          <DialogDescription>
            Generate a booking link. Optionally attach a contact so their
            details are prefilled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Contact (optional)</Label>
              {recipient ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setRecipient(null);
                    setGeneratedUrl("");
                  }}
                >
                  <X className="mr-1 size-3" />
                  Generic link
                </Button>
              ) : null}
            </div>
            <BillToClientSearch value={recipient} onChange={setRecipient} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="book-now-message">Message</Label>
            <Textarea
              id="book-now-message"
              value={customMessage}
              onChange={(event) => setCustomMessage(event.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
              {previewMessage}
            </div>
          </div>

          {generatedUrl ? (
            <div className="space-y-2">
              <Label>Generated link</Label>
              <Input readOnly value={generatedUrl} />
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={generateMutation.isPending}
              onClick={() => void handleCopy()}
            >
              {generateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy link
            </Button>
            {smsEnabled ? (
              <Button
                type="button"
                disabled={generateMutation.isPending || !canSendSms}
                onClick={() => void handleSms()}
              >
                <MessageSquare className="size-4" />
                Send SMS
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
