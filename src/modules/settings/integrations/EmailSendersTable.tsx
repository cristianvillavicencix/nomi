import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { EmailDeliverySettings } from "@/modules/settings/EmailDeliverySettingsSection";
import {
  DEFAULT_ORG_EMAIL_DOMAIN,
  validateOrgSenderEmail,
} from "@/modules/settings/integrations/emailSenderDomain";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";

const parseDisplayEmail = (value: string) => {
  const angle = value.match(/<([^>]+)>/);
  return (angle?.[1] ?? value).trim();
};

type RowConfig = {
  id: SenderChannel;
  purpose: string;
  purposeHint?: string;
  getAddress: (data: EmailSendersTableData) => string;
  getEnabled: (data: EmailSendersTableData) => boolean;
  editLabel: string;
  dnsNote?: boolean;
};

export type EmailSendersTableData = {
  generalFromEmail: string | null;
  billingFromEmail: string | null;
  ticketInboxEmail: string | null;
  generalEmailEnabled: boolean;
  billingEmailEnabled: boolean;
  ticketInboxEnabled: boolean;
};

export type SenderChannel = "billing" | "general" | "ticket";

type Props = {
  configured: boolean;
  data: EmailSendersTableData;
  /** Which sender rows to show. Defaults to system email only (billing + general). */
  channels?: SenderChannel[];
};

const ALL_ROWS: RowConfig[] = [
  {
    id: "billing",
    purpose: "Invoices & payment links",
    purposeHint:
      "Sender address (Mail). Card checkout: Integrations → Stripe.",
    getAddress: (data) =>
      parseDisplayEmail(data.billingFromEmail?.trim() || "Not configured"),
    getEnabled: (data) => data.billingEmailEnabled,
    editLabel: "Billing sender",
  },
  {
    id: "general",
    purpose: "Portal access codes & meetings",
    getAddress: (data) =>
      parseDisplayEmail(data.generalFromEmail?.trim() || "Not configured"),
    getEnabled: (data) => data.generalEmailEnabled,
    editLabel: "General sender",
  },
  {
    id: "ticket",
    purpose: "Ticket replies (outbound)",
    getAddress: (data) =>
      parseDisplayEmail(
        data.ticketInboxEmail?.trim() || DEFAULT_TICKET_INBOX_EMAIL,
      ),
    getEnabled: (data) => data.ticketInboxEnabled,
    editLabel: "Ticket inbox address",
    dnsNote: true,
  },
];

export const buildEmailSendersTableData = (
  settings: EmailDeliverySettings,
): EmailSendersTableData => ({
  generalFromEmail:
    settings.general_from_email ?? settings.from_email ?? settings.reply_to,
  billingFromEmail: settings.billing_from_email ?? settings.billing_from,
  ticketInboxEmail: settings.ticket_inbound?.support_email ?? null,
  generalEmailEnabled: settings.general_email_enabled !== false,
  billingEmailEnabled: settings.billing_email_enabled !== false,
  ticketInboxEnabled: settings.ticket_inbound?.is_active !== false,
});

export const EmailSendersTable = ({
  configured,
  data,
  channels = ["billing", "general"],
}: Props) => {
  const rows = ALL_ROWS.filter((row) => channels.includes(row.id));
  const tableTitle =
    channels.length === 1 && channels[0] === "ticket"
      ? "Outbound sender"
      : "Who sends what";
  const footerNote =
    channels.length === 1 && channels[0] === "ticket"
      ? `Must use @${DEFAULT_ORG_EMAIL_DOMAIN} and be verified in Twilio Console → Email. Pause stops outbound ticket replies.`
      : `Each address must use @${DEFAULT_ORG_EMAIL_DOMAIN} and be verified in Twilio Console → Email. Pause stops outbound mail for that channel only.`;
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [editingChannel, setEditingChannel] = useState<SenderChannel | null>(
    null,
  );
  const [draftEmail, setDraftEmail] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (
      payload: Parameters<CrmDataProvider["updateEmailDeliverySettings"]>[0],
    ) => dataProvider.updateEmailDeliverySettings(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(["email-delivery-settings"], saved);
      notify("Email sender saved", { type: "success" });
      setEditingChannel(null);
      setDraftEmail("");
      setDraftError(null);
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to save", {
        type: "error",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (
      payload: Parameters<CrmDataProvider["updateEmailDeliverySettings"]>[0],
    ) => dataProvider.updateEmailDeliverySettings(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(["email-delivery-settings"], saved);
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to update", {
        type: "error",
      });
    },
  });

  const openEdit = (channel: SenderChannel) => {
    const row = ALL_ROWS.find((entry) => entry.id === channel);
    if (!row) return;
    setEditingChannel(channel);
    setDraftError(null);
    setDraftEmail(row.getAddress(data));
  };

  const saveEdit = () => {
    if (!editingChannel) return;
    const validationError = validateOrgSenderEmail(draftEmail);
    if (validationError) {
      setDraftError(validationError);
      return;
    }
    const email = draftEmail.trim().toLowerCase();
    if (editingChannel === "billing") {
      saveMutation.mutate({ billing_from_email: email });
      return;
    }
    if (editingChannel === "general") {
      saveMutation.mutate({
        general_from_email: email,
        reply_to: email,
      });
      return;
    }
    saveMutation.mutate({ ticket_inbox_email: email });
  };

  const toggleEnabled = (channel: SenderChannel, enabled: boolean) => {
    if (channel === "billing") {
      toggleMutation.mutate({ billing_email_enabled: enabled });
      return;
    }
    if (channel === "general") {
      toggleMutation.mutate({ general_email_enabled: enabled });
      return;
    }
    toggleMutation.mutate({ ticket_inbox_enabled: enabled });
  };

  const editingRow = ALL_ROWS.find((row) => row.id === editingChannel);
  const originalTicketEmail =
    data.ticketInboxEmail?.trim() || DEFAULT_TICKET_INBOX_EMAIL;
  const ticketEmailChanged =
    editingChannel === "ticket" &&
    draftEmail.trim().toLowerCase() !== originalTicketEmail.toLowerCase();

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">{tableTitle}</p>
        <div className="overflow-hidden rounded-lg border text-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Purpose</th>
                <th className="px-3 py-2 font-medium">From</th>
                <th className="px-3 py-2 font-medium text-right">Send</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const address = row.getAddress(data);
                const enabled = row.getEnabled(data);
                const isPaused = configured && !enabled;

                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2 align-top text-foreground">
                      {row.purpose}
                      {row.purposeHint ? (
                        <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                          {row.purposeHint}
                        </span>
                      ) : null}
                      {isPaused ? (
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          Paused
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-start gap-2">
                        <span
                          className={`font-mono text-[11px] ${
                            isPaused
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }`}
                        >
                          {address}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          disabled={!configured || saveMutation.isPending}
                          onClick={() => openEdit(row.id)}
                          aria-label={`Edit ${row.purpose}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <Switch
                        checked={enabled}
                        disabled={!configured || toggleMutation.isPending}
                        onCheckedChange={(checked) =>
                          toggleEnabled(row.id, checked)
                        }
                        aria-label={`Send ${row.purpose}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {footerNote}
        </p>
      </div>

      <Dialog
        open={editingChannel != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingChannel(null);
            setDraftEmail("");
            setDraftError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRow?.editLabel ?? "Edit sender"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="sender-email">From address</Label>
              <Input
                id="sender-email"
                type="email"
                value={draftEmail}
                onChange={(event) => {
                  setDraftEmail(event.target.value);
                  setDraftError(null);
                }}
                placeholder={`name@${DEFAULT_ORG_EMAIL_DOMAIN}`}
                autoFocus
              />
              {draftError ? (
                <p className="text-xs text-destructive">{draftError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Must be an @{DEFAULT_ORG_EMAIL_DOMAIN} address verified in
                  Twilio.
                </p>
              )}
            </div>
            {editingRow?.dnsNote && ticketEmailChanged ? (
              <Alert>
                <AlertDescription>
                  Changing the ticket inbox address requires updating inbound
                  DNS (MX on the subdomain) and SendGrid inbound parse. Review
                  the setup steps below after saving.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingChannel(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saveMutation.isPending}
              onClick={saveEdit}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
