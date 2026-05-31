import { useMutation } from "@tanstack/react-query";
import { Copy, Download, Loader2, Send } from "lucide-react";
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
import { exportProposalPdf } from "@/lbs/proposals/proposalPdfExport";
import type {
  Proposal,
  ProposalLineItem,
  ProposalPaymentInstallment,
} from "@/lbs/types";

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
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [clientUrl, setClientUrl] = useState("");

  const canSend =
    "sendProposal" in dataProvider &&
    typeof (dataProvider as CrmDataProvider & { sendProposal?: unknown })
      .sendProposal === "function" &&
    canUseCrmPermission(
      identity as Parameters<typeof canUseCrmPermission>[0],
      "proposals.send",
    );

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
        onClick={() => exportProposalPdf({ proposal, lineItems, installments })}
      >
        <Download className="size-4" />
        PDF
      </Button>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client proposal link</DialogTitle>
            <DialogDescription>
              Share this link with your client. They can review, accept, sign,
              and confirm the deposit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="proposal-client-url">URL</Label>
            <div className="flex gap-2">
              <Input id="proposal-client-url" readOnly value={clientUrl} />
              <Button
                type="button"
                variant="outline"
                onClick={() => copyLink()}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setLinkDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
