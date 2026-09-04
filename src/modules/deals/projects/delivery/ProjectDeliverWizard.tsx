import { useMemo, useState } from "react";
import {
  useCreate,
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { AlertTriangle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact } from "@/components/atomic-crm/types";
import { getContactEmail } from "@/modules/clients/clientShowUtils";
import { getProjectBriefProgress } from "@/modules/deals/projectBriefProgress";
import { resolveProjectDeploymentUrls } from "@/modules/deals/projects/projectDeploymentUrls";
import { DeliverProjectFormFields } from "@/modules/deals/projects/delivery/DeliverProjectFormFields";
import { ProjectDeliveryAnalysisStep } from "@/modules/deals/projects/delivery/ProjectDeliveryAnalysisStep";
import { ProjectDeliveryDoneActions } from "@/modules/deals/projects/delivery/ProjectDeliveryDoneActions";
import {
  buildProjectDeliveryAnalysis,
  formatDeliveryAnalysisBlockerMessage,
  getBlockingDeliveryAnalysisItems,
  hasBlockingDeliveryAnalysis,
} from "@/modules/deals/projects/delivery/projectDeliveryAnalysis";
import {
  ManualDeliveryOverrideDialog,
  type ManualOverridePayload,
} from "@/modules/deals/projects/delivery/ManualDeliveryOverrideDialog";
import {
  computeAutoMaintenanceReviewDate,
  MAINTENANCE_REVIEW_MILESTONE_TITLE,
} from "@/modules/deals/projects/delivery/projectMaintenanceReview";
import { useDeliverProjectForm } from "@/modules/deals/projects/delivery/useDeliverProjectForm";
import { useProjectPortalLink, getProjectPortalShortUrl } from "@/modules/portal/useProjectPortalLink";
import type {
  ClientPortalAccount,
  DealResource,
  LbsDeal,
  ProjectDelivery,
} from "@/modules/types";

const randomToken = () =>
  crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

const generateShortCode = (length = 8) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};

type WizardPhase = "form" | "done";

type ProjectDeliverWizardProps = {
  open: boolean;
  onClose: () => void;
  record: LbsDeal;
};

export const ProjectDeliverWizard = ({
  open,
  onClose,
  record,
}: ProjectDeliverWizardProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider();
  const [create] = useCreate();
  const [phase, setPhase] = useState<WizardPhase>("form");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [manualOverride, setManualOverride] =
    useState<ManualOverridePayload | null>(null);
  const [maintenanceMonths, setMaintenanceMonths] = useState(3);
  const [portalShortCode, setPortalShortCode] = useState<string | null>(null);
  const [completedDelivery, setCompletedDelivery] =
    useState<ProjectDelivery | null>(null);
  const [analysisSkipped, setAnalysisSkipped] = useState(false);

  const { contactId, portalLink } = useProjectPortalLink(record);
  const briefProgress = useMemo(
    () => getProjectBriefProgress(record),
    [record],
  );
  const maintenanceReviewDate =
    computeAutoMaintenanceReviewDate(maintenanceMonths);

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId! },
    { enabled: open && contactId != null },
  );

  const { data: portalAccounts = [] } = useGetList<ClientPortalAccount>(
    "client_portal_accounts",
    {
      filter: contactId ? { "contact_id@eq": contactId } : { id: -1 },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
    },
    { enabled: open && !!contactId },
  );

  const {
    total: pendingChecklistCount = 0,
    data: pendingChecklistItems = [],
  } = useGetList<{ id: number; label: string }>(
    "deal_launch_checklist_items",
    {
      filter: {
        "deal_id@eq": record.id,
        "is_required@eq": true,
        "is_completed@eq": false,
      },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "order_index", order: "ASC" },
    },
    { enabled: open && !!record.id },
  );

  const pendingChecklistLabels = useMemo(
    () =>
      pendingChecklistItems
        .map((item) => item.label?.trim())
        .filter((label): label is string => Boolean(label)),
    [pendingChecklistItems],
  );

  const { total: credentialsCount = 0 } = useGetList(
    "deal_access_entries",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: open && !!record.id },
  );

  const { total: resourcesCount = 0 } = useGetList<DealResource>(
    "deal_resources",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: open && !!record.id },
  );

  const deploymentUrls = useMemo(
    () => resolveProjectDeploymentUrls(record),
    [record],
  );

  const analysisItems = useMemo(
    () =>
      buildProjectDeliveryAnalysis({
        briefPercent: briefProgress.percent,
        productionUrl: deploymentUrls.productionUrl,
        credentialsCount,
        pendingChecklistCount,
        pendingChecklistLabels,
        resourcesCount,
        hasPortalAccount: portalAccounts.length > 0,
        hasLinkedContact: contactId != null,
      }),
    [
      briefProgress.percent,
      contactId,
      credentialsCount,
      pendingChecklistCount,
      pendingChecklistLabels,
      portalAccounts.length,
      deploymentUrls.productionUrl,
      resourcesCount,
    ],
  );

  const form = useDeliverProjectForm({
    record,
    enabled: open,
    defaultMaintenanceMonths: maintenanceMonths,
    maintenanceReviewDate,
    manualOverride: manualOverride ?? undefined,
  });

  const clientEmail = contact ? getContactEmail(contact) : "";
  const existingPortalAccount = portalAccounts[0];
  const resolvedShortCode =
    portalShortCode ??
    (typeof existingPortalAccount?.short_code === "string"
      ? existingPortalAccount.short_code
      : null);

  const resolvedPortalLink =
    portalLink ??
    (resolvedShortCode ? getProjectPortalShortUrl(resolvedShortCode) : null);

  const analysisBlocked =
    !analysisSkipped &&
    !manualOverride &&
    hasBlockingDeliveryAnalysis(analysisItems);
  const blockingAnalysisItems = useMemo(
    () => getBlockingDeliveryAnalysisItems(analysisItems),
    [analysisItems],
  );

  const resetWizard = () => {
    setPhase("form");
    setManualOverride(null);
    setMaintenanceMonths(3);
    setPortalShortCode(null);
    setCompletedDelivery(null);
    setAnalysisSkipped(false);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const ensurePortalAccount = async () => {
    if (existingPortalAccount?.id) {
      return existingPortalAccount;
    }
    if (!record.org_id || !contactId) {
      throw new Error("Link a client contact before delivering");
    }
    const email = clientEmail !== "—" ? clientEmail : "";
    if (!email) {
      throw new Error("Client contact needs an email for the portal");
    }
    const token = randomToken();
    const shortCode = generateShortCode();
    const account = await dataProvider.create("client_portal_accounts", {
      data: {
        org_id: record.org_id,
        contact_id: contactId,
        email,
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
    setPortalShortCode(shortCode);
    return account.data as ClientPortalAccount;
  };

  const scheduleMaintenanceReview = async () => {
    if (!record.org_id || !maintenanceReviewDate) return;
    await create(
      "deal_milestones",
      {
        data: {
          org_id: record.org_id,
          deal_id: record.id,
          title: MAINTENANCE_REVIEW_MILESTONE_TITLE,
          description: "Scheduled during project delivery",
          start_date: maintenanceReviewDate,
          due_date: maintenanceReviewDate,
          order_index: 999,
          color: "#22c55e",
        },
      },
      { mutationMode: "pessimistic" },
    );
  };

  const handleDeliver = async () => {
    if (analysisBlocked) {
      notify(formatDeliveryAnalysisBlockerMessage(analysisItems), {
        type: "warning",
        autoHideDuration: 8000,
      });
      return;
    }
    if (!form.canSubmit) {
      notify(
        form.submitBlockers.length > 0
          ? `Still required: ${form.submitBlockers.join(". ")}`
          : "Complete required fields and confirm readiness",
        { type: "warning", autoHideDuration: 8000 },
      );
      return;
    }

    try {
      form.setMaintenanceMonths(String(maintenanceMonths));
      await ensurePortalAccount();
      const result = await form.deliverMutation.mutateAsync();
      await scheduleMaintenanceReview();
      const deliveryFromApi = result?.delivery;
      const delivery: ProjectDelivery = {
        id: deliveryFromApi?.id ?? 0,
        deal_id: record.id,
        delivered_at:
          deliveryFromApi?.delivered_at ?? new Date().toISOString(),
        site_url: form.siteUrl,
        plan_name: form.planName || null,
        delivery_date: new Date().toISOString().slice(0, 10),
      };
      setCompletedDelivery(delivery);
      setPhase("done");
      notify("Project delivered to client portal", { type: "info" });
      refresh();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not deliver project",
        { type: "error" },
      );
    }
  };

  if (!open) return null;

  if (form.alreadyDelivered && phase !== "done") {
    const existing = form.existingDelivery;
    return (
      <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delivery ready</DialogTitle>
            <DialogDescription>
              This project was already delivered. Download, print, or email the
              handoff — or share the portal link again.
            </DialogDescription>
          </DialogHeader>
          {existing ? (
            <ProjectDeliveryDoneActions
              projectName={record.name}
              siteUrl={
                String(existing.site_url ?? form.siteUrl ?? "").trim() ||
                deploymentUrls.productionUrl
              }
              stagingUrl={deploymentUrls.stagingUrl}
              planName={String(existing.plan_name ?? form.planName ?? "")}
              domainName={form.domainName}
              hostingProvider={form.hostingProvider}
              clientEmail={clientEmail !== "—" ? clientEmail : ""}
              portalLink={resolvedPortalLink}
              delivery={existing}
              credentials={form.credentials}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Delivery exists, but details could not be loaded.
            </p>
          )}
          <DialogFooter>
            <Button type="button" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (overrideOpen) {
    return (
      <ManualDeliveryOverrideDialog
        open
        onClose={() => setOverrideOpen(false)}
        dealId={record.id}
        defaultSiteUrl={record.production_url}
        onConfirm={(payload) => {
          setManualOverride({
            reason: payload.reason,
            force_approved_items: payload.force_approved_items,
          });
          setOverrideOpen(false);
          setAnalysisSkipped(true);
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {phase === "done" ? "Delivery sent" : "Deliver website to client"}
          </DialogTitle>
          <DialogDescription>
            {phase === "done"
              ? "Download, print, or email the handoff summary."
              : "Review readiness (including the launch checklist), fill handoff details, then deliver."}
          </DialogDescription>
        </DialogHeader>

        {phase === "form" ? (
          <div className="space-y-4">
            {manualOverride ? (
              <div className="rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm">
                <p className="font-medium text-warning-foreground">
                  Manual override active
                </p>
                <p className="mt-1 text-xs text-muted-foreground italic">
                  "{manualOverride.reason}"
                </p>
              </div>
            ) : null}

            {analysisBlocked ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">Fix these before delivering:</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {blockingAnalysisItems.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium">{item.label}</span>
                      {item.fixHint ? ` — ${item.fixHint}` : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!form.canSubmit && form.submitBlockers.length > 0 ? (
              <div className="rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm text-warning-foreground">
                <p className="font-medium">Still required:</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {form.submitBlockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-lg border border-border p-3">
              <p className="mb-1 text-sm font-medium">Launch checklist & readiness</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Required checklist items and other delivery checks before handoff.
              </p>
              <ProjectDeliveryAnalysisStep
                items={analysisItems}
                analysisSkipped={analysisSkipped}
                onSkipAnalysis={() => setAnalysisSkipped(true)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery-maintenance-months">
                Free maintenance months
              </Label>
              <Input
                id="delivery-maintenance-months"
                type="number"
                min={0}
                max={36}
                value={maintenanceMonths}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setMaintenanceMonths(
                    Number.isFinite(next) ? Math.max(0, Math.min(36, next)) : 0,
                  );
                }}
              />
            </div>

            <DeliverProjectFormFields
              idPrefix="wizard-delivery"
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
          </div>
        ) : completedDelivery ? (
          <ProjectDeliveryDoneActions
            projectName={record.name}
            siteUrl={form.siteUrl}
            stagingUrl={deploymentUrls.stagingUrl}
            planName={form.planName}
            domainName={form.domainName}
            hostingProvider={form.hostingProvider}
            clientEmail={clientEmail !== "—" ? clientEmail : ""}
            portalLink={resolvedPortalLink}
            delivery={completedDelivery}
            credentials={form.credentials}
            emailAlreadyQueued={form.notifyEmail}
          />
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={handleClose}>
            {phase === "done" ? "Close" : "Cancel"}
          </Button>
          {phase === "form" ? (
            <div className="flex flex-wrap gap-2">
              {pendingChecklistCount > 0 || analysisBlocked ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOverrideOpen(true)}
                >
                  <AlertTriangle className="size-4" />
                  Deliver anyway
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={form.deliverMutation.isPending}
                onClick={() => void handleDeliver()}
              >
                <Rocket className="size-4" />
                {form.deliverMutation.isPending
                  ? "Delivering…"
                  : "Deliver to client"}
              </Button>
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
