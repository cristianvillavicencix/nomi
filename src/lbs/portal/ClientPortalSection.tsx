import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRefresh,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { useProjectPortalLink } from "@/lbs/portal/useProjectPortalLink";
import type { LbsDeal } from "@/lbs/types";

const randomToken = () =>
  crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

const generateShortCode = (length = 8) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};

export const ClientPortalSection = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider();
  const canEdit = useMemberCapability("crm.pipeline.edit");
  const [email, setEmail] = useState("");
  const { contactId, portalLink } = useProjectPortalLink(record);

  const handleInvite = async () => {
    if (!record.org_id || !contactId) {
      notify("Link a client contact before inviting to the portal", {
        type: "warning",
      });
      return;
    }
    const nextEmail = email.trim();
    if (!nextEmail) {
      notify("Client email is required", { type: "warning" });
      return;
    }
    const token = randomToken();
    const shortCode = generateShortCode();
    try {
      const account = await dataProvider.create("client_portal_accounts", {
        data: {
          org_id: record.org_id,
          contact_id: contactId,
          email: nextEmail,
          invitation_token: token,
          short_code: shortCode,
          invitation_sent_at: new Date().toISOString(),
          active: true,
        },
      });
      await dataProvider.create("client_portal_deal_access", {
        data: {
          org_id: record.org_id,
          portal_account_id: account.data.id,
          deal_id: record.id,
        },
      });
      refresh();
      setEmail("");
      notify("Portal invitation created", { type: "info" });
    } catch {
      notify("Could not create portal invite", { type: "error" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Client portal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {portalLink ? (
          <div className="space-y-2">
            <div className="text-muted-foreground">Share this link with your client</div>
            <Input readOnly value={portalLink} />
          </div>
        ) : (
          <p className="text-muted-foreground">
            Invite your client to a read-only portal with project status and
            shared links.
          </p>
        )}
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              placeholder="client@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="max-w-xs"
            />
            <Button type="button" onClick={handleInvite}>
              {portalLink ? "Create new invite" : "Create invite"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
