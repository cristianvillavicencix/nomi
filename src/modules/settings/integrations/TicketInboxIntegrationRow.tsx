import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { IntegrationListRow } from "@/modules/settings/integrations/IntegrationListRow";
import { TicketEmailInboundSetupCard } from "@/modules/settings/TicketEmailInboundSetupCard";
import { TicketInboxReplySignatureSection } from "@/modules/settings/TicketInboxReplySignatureSection";
import { TicketInboxReplyTemplatesSection } from "@/modules/settings/TicketInboxReplyTemplatesSection";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";

export const TicketInboxIntegrationRow = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
  });

  const inboxEmail =
    data?.ticket_inbound?.support_email?.trim() || DEFAULT_TICKET_INBOX_EMAIL;
  const inboundReady = data?.ticket_inbound?.webhook_configured === true;

  const status = inboundReady ? ("connected" as const) : ("partial" as const);

  return (
    <>
      <IntegrationListRow
        name="Ticket inbox"
        subtitle={
          isPending
            ? "Loading…"
            : `${inboxEmail} · Ticket replies & inbound email`
        }
        status={status}
        toggles={null}
        onConnect={() => setEditOpen(true)}
        onEdit={() => setEditOpen(true)}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket inbox</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Outbound ticket replies are sent from{" "}
            <span className="font-medium text-foreground">{inboxEmail}</span>.
            Clients can write to this address; configure DNS and SendGrid
            inbound below.
          </p>
          <TicketEmailInboundSetupCard setup={data?.ticket_inbound ?? null} />
          <TicketInboxReplySignatureSection />
          <TicketInboxReplyTemplatesSection />
          <div className="flex justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
