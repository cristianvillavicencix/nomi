import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  buildEmailSendersTableData,
  EmailSendersTable,
} from "@/modules/settings/integrations/EmailSendersTable";
import {
  IntegrationListRow,
} from "@/modules/settings/integrations/IntegrationListRow";
import { IntegrationTestDialog } from "@/modules/settings/integrations/IntegrationTestDialog";
import {
  SYSTEM_EMAIL_NAME,
  SYSTEM_EMAIL_SCOPE,
} from "@/modules/settings/integrations/systemEmailCopy";

export const EmailIntegrationRow = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
  });

  const handleEditOpen = (open: boolean) => {
    setEditOpen(open);
    if (open) {
      void queryClient.invalidateQueries({ queryKey: ["email-delivery-settings"] });
    }
  };

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
            <EmailSendersTable
              configured={configured}
              data={buildEmailSendersTableData(data!)}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Close
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
