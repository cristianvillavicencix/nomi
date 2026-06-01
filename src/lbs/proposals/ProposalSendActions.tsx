import { useMutation } from "@tanstack/react-query";
import { Copy, Download, Loader2, Mail, MessageSquare, Send } from "lucide-react";
import { useDataProvider, useGetIdentity, useNotify } from "ra-core";
import { useState } from "react";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
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
import { exportProposalPdf } from "@/lbs/proposals/proposalPdfExport";
import { useProposalRecipient } from "@/lbs/proposals/useProposalRecipient";
import { contactHasSmsPhone } from "@/lbs/messages/messageContactUtils";
import { useSendClientSms } from "@/lbs/messages/useClientSms";
import { useMessagingEnabled } from "@/lbs/messages/useMessagingEnabled";
import { mailtoHref } from "@/lib/linking";
import type {
  Proposal,
  ProposalLineItem,
  ProposalPaymentInstallment,
} from "@/lbs/types";

const defaultShareMessage = (proposal: Proposal, recipientName: string) =>
  `Hi ${recipientName}, please review your proposal "${proposal.title}" from Latinos Business Support.`;

export const ProposalSendActions = ({
  proposal,
  lineItems,
  installments,
  onSent,
}: {
  proposal: Proposal;
  lineItems: ProposalLineItem[];
  installments: ProposalPaymentInstallment[];
  onSent?: () => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const { data: identity } = useGetIdentity();
  const recipient = useProposalRecipient(proposal);
  const sendClientSms = useSendClientSms();
  const { smsEnabled } = useMessagingEnabled();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [clientUrl, setClientUrl] = useState("");
  const [shareMessage, setShareMessage] = useState(() =>
    defaultShareMessage(proposal, recipient.recipientName),
  );
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);

  const canSend =
    "sendProposal" in dataProvider &&
    typeof (dataProvider as CrmDataProvider & { sendProposal?: unknown })
      .sendProposal === "function" &&
    canUseCrmPermission(
      identity as Parameters<typeof canUseCrmPermission>[0],
      "proposals.send",
    );

  const canSms =
    smsEnabled &&
    recipient.contactId != null &&
    recipient.contact != null &&
    contactHasSmsPhone(recipient.contact);

  const { mutate: sendProposal, isPending: isSending } = useMutation({
    mutationFn: () =>
      (
        dataProvider as CrmDataProvider & {
          sendProposal: (params: { id: Proposal["id"] }) => Promise<{
            url: string;
            short_url: string;
          }>;
        }
      ).sendProposal({ id: proposal.id }),
    onSuccess: (result) => {
      const url = result.short_url || result.url;
      setClientUrl(
        url.startsWith("http") ? url : `${window.location.origin}${url}`,
      );
      setLinkDialogOpen(true);
      notify("Proposal sent to client", { type: "success" });
      onSent?.();
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to send proposal", { type: "error" });
    },
  });

  const copyLink = async () => {
    if (!clientUrl) return;
    await navigator.clipboard.writeText(clientUrl);
    notify("Link copied", { type: "info" });
  };

  const handleEmail = () => {
    const email = recipient.recipientEmail?.trim().toLowerCase();
    if (!email || !mailtoHref(email)) {
      notify("No email address for this contact", { type: "warning" });
      return;
    }
    if (!clientUrl) {
      notify("Generate the link first", { type: "warning" });
      return;
    }
    const subject = encodeURIComponent(
      `Proposal: ${proposal.title}${proposal.proposal_number ? ` (${proposal.proposal_number})` : ""}`,
    );
    const body = encodeURIComponent(
      `${shareMessage.trim()}\n\n${clientUrl}`,
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handleSms = async () => {
    if (!recipient.contactId) {
      notify("No contact phone available for SMS", { type: "warning" });
      return;
    }
    if (!clientUrl) {
      notify("Generate the link first", { type: "warning" });
      return;
    }
    setIsSendingSms(true);
    try {
      const body = `${shareMessage.trim()}\n\n${clientUrl}`.trim();
      await sendClientSms({
        contactId: recipient.contactId,
        dealId: recipient.dealId,
        body,
      });
      notify("Proposal link sent via SMS", { type: "success" });
      setLinkDialogOpen(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to send SMS",
        { type: "error" },
      );
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportProposalPdf({ proposal, lineItems, installments });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to export PDF",
        { type: "error" },
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const alreadySent =
    proposal.status === "sent" ||
    proposal.status === "viewed" ||
    proposal.status === "accepted" ||
    !!proposal.sent_at;

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={!canSend || isSending || proposal.status === "accepted"}
        onClick={() => sendProposal()}
      >
        {isSending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        {alreadySent ? "Resend" : "Send to client"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isExportingPdf}
        onClick={() => void handleExportPdf()}
      >
        {isExportingPdf ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        PDF
      </Button>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share proposal with client</DialogTitle>
            <DialogDescription>
              Send the link by SMS or email, or copy it. Your client can review,
              accept, sign, and confirm the deposit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proposal-share-message">Message</Label>
              <Textarea
                id="proposal-share-message"
                rows={3}
                value={shareMessage}
                onChange={(event) => setShareMessage(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposal-client-url">Client link</Label>
              <div className="flex gap-2">
                <Input id="proposal-client-url" readOnly value={clientUrl} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyLink()}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLinkDialogOpen(false)}
            >
              Done
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyLink()}
              >
                <Copy className="size-4" />
                Copy link
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!recipient.recipientEmail}
                onClick={handleEmail}
              >
                <Mail className="size-4" />
                Email
              </Button>
              <Button
                type="button"
                disabled={!canSms || isSendingSms}
                onClick={() => void handleSms()}
              >
                {isSendingSms ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageSquare className="size-4" />
                )}
                Send SMS
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
