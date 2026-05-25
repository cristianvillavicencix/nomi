import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useGetList, useDataProvider, useNotify } from "ra-core";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { DEFAULT_INCLUDED_PAGES } from "@/lbs/portal/portalTypes";
import { parseDomainFromUrl } from "@/lbs/portal/portalResourceUtils";
import type { DealAccessEntry, LbsDeal, ProjectDelivery } from "@/lbs/types";

type DeliverProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  record: LbsDeal;
  onDelivered?: () => void;
};

export const DeliverProjectDialog = ({
  open,
  onClose,
  record,
  onDelivered,
}: DeliverProjectDialogProps) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const brief =
    record.website_brief && typeof record.website_brief === "object"
      ? record.website_brief
      : {};

  const [siteUrl, setSiteUrl] = useState("");
  const [planName, setPlanName] = useState("");
  const [hostingRenewalDate, setHostingRenewalDate] = useState("");
  const [includedPages, setIncludedPages] = useState<string[]>(DEFAULT_INCLUDED_PAGES);
  const [maintenanceMonths, setMaintenanceMonths] = useState("3");
  const [confirmed, setConfirmed] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPortal, setNotifyPortal] = useState(true);
  const [shareCredentialIds, setShareCredentialIds] = useState<number[]>([]);
  const [domainName, setDomainName] = useState("");
  const [domainRegistrar, setDomainRegistrar] = useState("");
  const [domainRenewalDate, setDomainRenewalDate] = useState("");
  const [domainManagedBy, setDomainManagedBy] = useState<"lbs" | "client">("lbs");
  const [domainDnsServers, setDomainDnsServers] = useState("");
  const [corporateEmailsText, setCorporateEmailsText] = useState("");

  const { data: existingDeliveries = [] } = useGetList<ProjectDelivery>(
    "project_deliveries",
    {
      filter: { "deal_id@eq": record.id, "revoked_at@is": null },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "delivered_at", order: "DESC" },
    },
    { enabled: open && !!record.id },
  );
  const existingDelivery = existingDeliveries[0];

  const { data: credentials = [] } = useGetList<DealAccessEntry>(
    "deal_access_entries",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "portal_sort_order", order: "ASC" },
    },
    { enabled: open && !!record.id },
  );

  useEffect(() => {
    if (!open) return;
    const initialSiteUrl = String(record.production_url ?? "").trim();
    setSiteUrl(initialSiteUrl);
    setPlanName("");
    setHostingRenewalDate("");
    setIncludedPages(DEFAULT_INCLUDED_PAGES);
    setMaintenanceMonths("3");
    setConfirmed(false);
    setNotifyEmail(true);
    setNotifyPortal(true);
    setShareCredentialIds(credentials.map((entry) => Number(entry.id)));
    setDomainName(parseDomainFromUrl(initialSiteUrl));
    setDomainRegistrar("");
    setDomainRenewalDate("");
    setDomainManagedBy("lbs");
    setDomainDnsServers("");
    setCorporateEmailsText("");
  }, [credentials, open, record.production_url]);

  const deliverMutation = useMutation({
    mutationFn: () => {
      const corporateEmails = corporateEmailsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((email) => ({ email }));

      return dataProvider.deliverProject({
        deal_id: Number(record.id),
        site_url: siteUrl.trim(),
        plan_name: planName.trim() || undefined,
        project_start_date: record.created_at
          ? String(record.created_at).slice(0, 10)
          : undefined,
        hosting_renewal_date: hostingRenewalDate.trim() || undefined,
        site_language: String(brief.site_language ?? "").trim() || undefined,
        included_pages: includedPages,
        maintenance_plan: {
          free_months: Number(maintenanceMonths) || 0,
          support_channels: ["whatsapp", "email"],
        },
        notify_email: notifyEmail,
        notify_portal: notifyPortal,
        share_credential_entry_ids: shareCredentialIds,
        domain: {
          domain: domainName.trim() || undefined,
          registrar: domainRegistrar.trim() || undefined,
          renewal_date: domainRenewalDate.trim() || undefined,
          managed_by: domainManagedBy,
          dns_servers: domainDnsServers
            .split(/[\n,]+/)
            .map((entry) => entry.trim())
            .filter(Boolean),
        },
        corporate_emails: corporateEmails,
        checklist_snapshot: {
          logo_uploaded: true,
          backup_uploaded: false,
          tutorial_ready: false,
        },
      });
    },
    onSuccess: () => {
      notify("Project delivered to client portal", { type: "info" });
      onDelivered?.();
      onClose();
    },
    onError: (error: Error) => {
      notify(error.message || "Could not deliver project", { type: "error" });
    },
  });

  const togglePage = (page: string) => {
    setIncludedPages((current) =>
      current.includes(page)
        ? current.filter((entry) => entry !== page)
        : [...current, page],
    );
  };

  const toggleCredential = (entryId: number) => {
    setShareCredentialIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId],
    );
  };

  const alreadyDelivered = Boolean(existingDelivery);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deliver project to client</DialogTitle>
          <DialogDescription>
            Unlocks <strong>Mi Sitio Web</strong> in the client portal and records
            the handoff checklist for {record.name}.
          </DialogDescription>
        </DialogHeader>

        {alreadyDelivered ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            This project was already delivered. Revoke the current delivery before
            sending again.
          </div>
        ) : null}

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <Label htmlFor="delivery-site-url">Live site URL</Label>
            <Input
              id="delivery-site-url"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
              placeholder="www.clientdomain.com"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="delivery-plan">Plan delivered</Label>
              <Input
                id="delivery-plan"
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                placeholder="WebPlus Essentials"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-hosting-renewal">Hosting renewal date</Label>
              <Input
                id="delivery-hosting-renewal"
                type="date"
                value={hostingRenewalDate}
                onChange={(event) => setHostingRenewalDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Included pages</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEFAULT_INCLUDED_PAGES.map((page) => (
                <label key={page} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={includedPages.includes(page)}
                    onCheckedChange={() => togglePage(page)}
                  />
                  {page}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery-maintenance">Free maintenance (months)</Label>
            <Input
              id="delivery-maintenance"
              type="number"
              min={0}
              value={maintenanceMonths}
              onChange={(event) => setMaintenanceMonths(event.target.value)}
            />
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <div>
              <Label className="text-base">Domain & DNS</Label>
              <p className="text-xs text-muted-foreground">
                Shown in the client portal under Domain & DNS.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delivery-domain">Domain</Label>
                <Input
                  id="delivery-domain"
                  value={domainName}
                  onChange={(event) => setDomainName(event.target.value)}
                  placeholder="clientdomain.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery-registrar">Registrar</Label>
                <Input
                  id="delivery-registrar"
                  value={domainRegistrar}
                  onChange={(event) => setDomainRegistrar(event.target.value)}
                  placeholder="GoDaddy, Namecheap…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery-domain-renewal">Domain renewal date</Label>
                <Input
                  id="delivery-domain-renewal"
                  type="date"
                  value={domainRenewalDate}
                  onChange={(event) => setDomainRenewalDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery-domain-managed">Managed by</Label>
                <select
                  id="delivery-domain-managed"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  value={domainManagedBy}
                  onChange={(event) =>
                    setDomainManagedBy(event.target.value as "lbs" | "client")
                  }
                >
                  <option value="lbs">LBS</option>
                  <option value="client">Client</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-dns">DNS servers (one per line or comma-separated)</Label>
              <textarea
                id="delivery-dns"
                className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
                value={domainDnsServers}
                onChange={(event) => setDomainDnsServers(event.target.value)}
                placeholder="ns1.example.com&#10;ns2.example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery-corporate-emails">Corporate emails (optional)</Label>
            <textarea
              id="delivery-corporate-emails"
              className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              value={corporateEmailsText}
              onChange={(event) => setCorporateEmailsText(event.target.value)}
              placeholder="info@clientdomain.com&#10;support@clientdomain.com"
            />
          </div>

          {credentials.length > 0 ? (
            <div className="space-y-2">
              <Label>Share credentials with client</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                {credentials.map((entry) => (
                  <label key={entry.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={shareCredentialIds.includes(Number(entry.id))}
                      onCheckedChange={() => toggleCredential(Number(entry.id))}
                    />
                    {entry.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notifyPortal} onCheckedChange={(v) => setNotifyPortal(Boolean(v))} />
              Notify client inside portal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notifyEmail} onCheckedChange={(v) => setNotifyEmail(Boolean(v))} />
              Send delivery email (Phase 2)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(Boolean(v))} />
              I reviewed everything and it is ready to deliver
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!confirmed || !siteUrl.trim() || alreadyDelivered || deliverMutation.isPending}
            onClick={() => deliverMutation.mutate()}
          >
            <Rocket className="size-4" />
            {deliverMutation.isPending ? "Delivering…" : "Confirm delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
