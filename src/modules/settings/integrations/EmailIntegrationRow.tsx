import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { useEffect, useState } from "react";

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
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  IntegrationListRow,
} from "@/modules/settings/integrations/IntegrationListRow";
import { IntegrationTestDialog } from "@/modules/settings/integrations/IntegrationTestDialog";
import {
  SYSTEM_EMAIL_NAME,
  SYSTEM_EMAIL_SCOPE,
} from "@/modules/settings/integrations/systemEmailCopy";
import { EmailSenderBreakdown } from "@/modules/settings/integrations/EmailSenderBreakdown";

export const EmailIntegrationRow = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [generalFromEmail, setGeneralFromEmail] = useState("");
  const [billingFromEmail, setBillingFromEmail] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
  });

  useEffect(() => {
    if (!editOpen || !data) return;
    setGeneralFromEmail(data.reply_to ?? "");
    setBillingFromEmail(data.billing_from ?? "");
  }, [editOpen, data]);

  const handleEditOpen = (open: boolean) => {
    setEditOpen(open);
    if (open) {
      void queryClient.invalidateQueries({ queryKey: ["email-delivery-settings"] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const general = generalFromEmail.trim() || null;
      const billing = billingFromEmail.trim() || null;
      return dataProvider.updateEmailDeliverySettings({
        general_from_email: general,
        billing_from_email: billing,
        reply_to: general,
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["email-delivery-settings"], saved);
      setGeneralFromEmail(saved.reply_to ?? "");
      setBillingFromEmail(saved.billing_from ?? "");
      notify("Email settings saved", { type: "success" });
      setEditOpen(false);
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to save", {
        type: "error",
      });
    },
  });

  const configured = data?.configured === true;
  const status = configured ? ("connected" as const) : ("off" as const);

  const subtitle = configured
    ? [
        data?.general_from_email ?? data?.from_email,
        data?.billing_from_email
          ? `Billing: ${data.billing_from_email}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : `${SYSTEM_EMAIL_SCOPE} · uses Twilio`;

  return (
    <>
      <IntegrationListRow
        name={SYSTEM_EMAIL_NAME}
        subtitle={isPending ? "Loading…" : subtitle}
        status={status}
        toggles={null}
        onConnect={() => handleEditOpen(true)}
        onEdit={() => handleEditOpen(true)}
        onTest={() => setTestOpen(true)}
        testDisabled={!configured}
      />

      <Dialog open={editOpen} onOpenChange={handleEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{SYSTEM_EMAIL_NAME}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{SYSTEM_EMAIL_SCOPE}.</p>
          {!configured ? (
            <p className="text-sm text-muted-foreground">
              Connect Twilio first (Account SID + Auth Token). Authenticate your
              domain in Twilio Console → Email.
            </p>
          ) : (
            <EmailSenderBreakdown
              billingFromPreview={data?.billing_from_email ?? null}
              generalFromPreview={data?.general_from_email ?? data?.from_email ?? null}
              ticketInboxEmail={data?.ticket_inbound?.support_email ?? null}
            />
          )}
          <div className="space-y-2">
            <Label htmlFor="email-general-from">
              General sender (portal, meetings)
            </Label>
            <Input
              id="email-general-from"
              type="email"
              value={generalFromEmail}
              onChange={(e) => setGeneralFromEmail(e.target.value)}
              placeholder="info@lbs.bz"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-billing-from">
              Billing sender (invoices, payments)
            </Label>
            <Input
              id="email-billing-from"
              type="email"
              value={billingFromEmail}
              onChange={(e) => setBillingFromEmail(e.target.value)}
              placeholder="billing@lbs.bz"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave billing empty to use Twilio secret{" "}
              <span className="font-mono">TWILIO_EMAIL_FROM</span> or{" "}
              <span className="font-mono">billing@lbs.bz</span>. Replies to
              invoice mail go to the general sender above.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!configured || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IntegrationTestDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        title="Test email"
        label="Send test to"
        placeholder="you@company.com"
        inputType="email"
        onSend={async (email) => {
          await dataProvider.sendTestTransactionalEmail(email);
          notify("Test email sent", { type: "success" });
        }}
      />
    </>
  );
};
