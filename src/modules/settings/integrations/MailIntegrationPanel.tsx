import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  buildEmailSendersTableData,
  EmailSendersTable,
} from "@/modules/settings/integrations/EmailSendersTable";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import {
  SYSTEM_EMAIL_NAME,
  SYSTEM_EMAIL_SCOPE,
} from "@/modules/settings/integrations/systemEmailCopy";

export const MailIntegrationPanel = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [testEmail, setTestEmail] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
  });

  const testMutation = useMutation({
    mutationFn: () => dataProvider.sendTestTransactionalEmail(testEmail.trim()),
    onSuccess: () => notify("Test email sent", { type: "success" }),
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to send test", {
        type: "error",
      });
    },
  });

  const configured = data?.configured === true;

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading mail settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title={SYSTEM_EMAIL_NAME}
        description={SYSTEM_EMAIL_SCOPE}
        status={configured ? "connected" : "off"}
        meta={
          configured
            ? (data?.general_from_email ?? data?.from_email ?? undefined)
            : "Connect Twilio first (Account tab)"
        }
      />

      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Add your Twilio Account SID and Auth Token under the Twilio tab.
          Authenticate your domain in Twilio Console → Email. Ticket inbox
          (receive, forward, webhook) is under Settings → Tickets.
        </p>
      ) : (
        <EmailSendersTable
          configured={configured}
          data={buildEmailSendersTableData(data!)}
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[240px] flex-1 gap-2">
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={!configured}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!configured || !testEmail.trim() || testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            Send test
          </Button>
        </div>
      </div>
    </div>
  );
};
