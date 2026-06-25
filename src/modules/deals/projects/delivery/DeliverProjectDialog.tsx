import { useNotify } from "ra-core";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeliverProjectFormFields } from "@/modules/deals/projects/delivery/DeliverProjectFormFields";
import {
  useDeliverProjectForm,
  type DeliverProjectManualOverride,
} from "@/modules/deals/projects/delivery/useDeliverProjectForm";
import type { LbsDeal } from "@/modules/types";

type DeliverProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  record: LbsDeal;
  onDelivered?: () => void;
  manualOverride?: DeliverProjectManualOverride;
};

export const DeliverProjectDialog = ({
  open,
  onClose,
  record,
  onDelivered,
  manualOverride,
}: DeliverProjectDialogProps) => {
  const notify = useNotify();
  const form = useDeliverProjectForm({
    record,
    enabled: open,
    manualOverride,
  });

  const handleDeliver = async () => {
    try {
      await form.deliverMutation.mutateAsync();
      notify("Project delivered to client portal", { type: "info" });
      onDelivered?.();
      onClose();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not deliver project",
        { type: "error" },
      );
    }
  };

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

        {form.alreadyDelivered ? (
          <div className="rounded-lg border border-warning/40 bg-warning/15 p-4 text-sm text-warning-foreground">
            This project was already delivered. Revoke the current delivery before
            sending again.
          </div>
        ) : null}

        {manualOverride ? (
          <div className="rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm">
            <p className="font-medium text-warning-foreground">
              Manual override active
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {manualOverride.force_approved_items.length} required item
              {manualOverride.force_approved_items.length === 1 ? "" : "s"}{" "}
              force-approved.
            </p>
            <p className="text-muted-foreground mt-1 line-clamp-3 text-xs italic">
              "{manualOverride.reason}"
            </p>
          </div>
        ) : null}

        <DeliverProjectFormFields
          siteUrl={form.siteUrl}
          onSiteUrlChange={form.setSiteUrl}
          planName={form.planName}
          onPlanNameChange={form.setPlanName}
          hostingProvider={form.hostingProvider}
          onHostingProviderChange={form.setHostingProvider}
          hostingPanelUrl={form.hostingPanelUrl}
          onHostingPanelUrlChange={form.setHostingPanelUrl}
          hostingLocation={form.hostingLocation}
          onHostingLocationChange={form.setHostingLocation}
          hostingManagedBy={form.hostingManagedBy}
          onHostingManagedByChange={form.setHostingManagedBy}
          hostingRenewalDate={form.hostingRenewalDate}
          onHostingRenewalDateChange={form.setHostingRenewalDate}
          domainName={form.domainName}
          onDomainNameChange={form.setDomainName}
          domainRegistrar={form.domainRegistrar}
          onDomainRegistrarChange={form.setDomainRegistrar}
          domainRenewalDate={form.domainRenewalDate}
          onDomainRenewalDateChange={form.setDomainRenewalDate}
          domainManagedBy={form.domainManagedBy}
          onDomainManagedByChange={form.setDomainManagedBy}
          domainDnsServers={form.domainDnsServers}
          onDomainDnsServersChange={form.setDomainDnsServers}
          corporateEmailsText={form.corporateEmailsText}
          onCorporateEmailsTextChange={form.setCorporateEmailsText}
          credentials={form.credentials}
          shareCredentialIds={form.shareCredentialIds}
          onToggleCredential={form.toggleCredential}
          notifyPortal={form.notifyPortal}
          onNotifyPortalChange={form.setNotifyPortal}
          notifyEmail={form.notifyEmail}
          onNotifyEmailChange={form.setNotifyEmail}
          confirmed={form.confirmed}
          onConfirmedChange={form.setConfirmed}
        />

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              !form.canSubmit || form.deliverMutation.isPending
            }
            onClick={() => void handleDeliver()}
          >
            <Rocket className="size-4" />
            {form.deliverMutation.isPending ? "Delivering…" : "Confirm delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
