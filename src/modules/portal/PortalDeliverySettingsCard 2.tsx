import { useEffect, useState } from "react";
import { useGetList, useNotify, useRefresh, useUpdate } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  buildPortalHostingMetaPayload,
  readPortalHostingMeta,
} from "@/modules/portal/portalDeliveryMeta";
import type { LbsDeal, ProjectDelivery } from "@/modules/types";

type PortalDeliverySettingsCardProps = {
  record: LbsDeal;
};

export const PortalDeliverySettingsCard = ({
  record,
}: PortalDeliverySettingsCardProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate();
  const canEdit = useMemberCapability("crm.pipeline.edit");

  const { data: deliveries = [] } = useGetList<ProjectDelivery>(
    "project_deliveries",
    {
      filter: { "deal_id@eq": record.id, "revoked_at@is": null },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "delivered_at", order: "DESC" },
    },
    { enabled: !!record.id },
  );

  const delivery = deliveries[0];
  const hostingMeta = readPortalHostingMeta(delivery);

  const [hostingProvider, setHostingProvider] = useState("");
  const [hostingPanelUrl, setHostingPanelUrl] = useState("");
  const [hostingLocation, setHostingLocation] = useState("");
  const [hostingManagedBy, setHostingManagedBy] = useState<"lbs" | "client">(
    "lbs",
  );
  const [hostingRenewalDate, setHostingRenewalDate] = useState("");
  const [domainRegistrar, setDomainRegistrar] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!delivery) return;
    const meta = readPortalHostingMeta(delivery);
    setHostingProvider(meta.provider ?? "");
    setHostingPanelUrl(meta.panel_url ?? "");
    setHostingLocation(meta.location ?? "");
    setHostingManagedBy(meta.managed_by === "client" ? "client" : "lbs");
    setHostingRenewalDate(
      String(delivery.hosting_renewal_date ?? "").slice(0, 10),
    );
    const domainInfo =
      delivery.domain_info && typeof delivery.domain_info === "object"
        ? (delivery.domain_info as Record<string, unknown>)
        : {};
    setDomainRegistrar(
      typeof domainInfo.registrar === "string" ? domainInfo.registrar : "",
    );
  }, [delivery]);

  if (!delivery?.id) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await update(
        "project_deliveries",
        {
          id: delivery.id,
          data: {
            hosting_renewal_date: hostingRenewalDate.trim() || null,
            domain_info: {
              ...(delivery.domain_info &&
              typeof delivery.domain_info === "object"
                ? delivery.domain_info
                : {}),
              hosting: buildPortalHostingMetaPayload({
                provider: hostingProvider,
                panel_url: hostingPanelUrl,
                managed_by: hostingManagedBy,
                location: hostingLocation,
              }),
              registrar: domainRegistrar.trim() || null,
            },
          },
          previousData: delivery,
        },
        { mutationMode: "pessimistic" },
      );
      refresh();
      notify("Portal hosting and domain details updated", { type: "info" });
    } catch {
      notify("Could not update portal delivery details", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Portal hosting & domain</h3>
        <p className="text-xs text-muted-foreground">
          Edit what the client sees on the Hosting and Domain tabs.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="portal-hosting-provider">Hosting provider</Label>
          <Input
            id="portal-hosting-provider"
            value={hostingProvider}
            onChange={(event) => setHostingProvider(event.target.value)}
            disabled={!canEdit}
            placeholder={hostingMeta.provider ?? "Hostinger"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="portal-hosting-location">Server location</Label>
          <Input
            id="portal-hosting-location"
            value={hostingLocation}
            onChange={(event) => setHostingLocation(event.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="portal-hosting-panel">Hosting panel URL</Label>
          <Input
            id="portal-hosting-panel"
            value={hostingPanelUrl}
            onChange={(event) => setHostingPanelUrl(event.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="portal-hosting-renewal">Hosting renewal</Label>
          <Input
            id="portal-hosting-renewal"
            type="date"
            value={hostingRenewalDate}
            onChange={(event) => setHostingRenewalDate(event.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label>Hosting managed by</Label>
          <Select
            value={hostingManagedBy}
            onValueChange={(value) =>
              setHostingManagedBy(value as "lbs" | "client")
            }
            disabled={!canEdit}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lbs">LBS</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="portal-domain-registrar">Domain registrar</Label>
          <Input
            id="portal-domain-registrar"
            value={domainRegistrar}
            onChange={(event) => setDomainRegistrar(event.target.value)}
            disabled={!canEdit}
          />
        </div>
      </div>

      {canEdit ? (
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save portal details"}
        </Button>
      ) : null}
    </div>
  );
};
