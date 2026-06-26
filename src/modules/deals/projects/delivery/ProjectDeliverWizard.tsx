import { useMemo, useState } from "react";
import {
  useCreate,
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import {
  AlertTriangle,
  ChevronLeft,
  Copy,
  ExternalLink,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ProjectDeliveryEmailPreview } from "@/modules/deals/projects/delivery/ProjectDeliveryEmailPreview";
import { ProjectDeliveryMaintenanceStep } from "@/modules/deals/projects/delivery/ProjectDeliveryMaintenanceStep";
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
  type MaintenanceScheduleMode,
} from "@/modules/deals/projects/delivery/projectMaintenanceReview";
import { useDeliverProjectForm } from "@/modules/deals/projects/delivery/useDeliverProjectForm";
import { useProjectPortalLink } from "@/modules/portal/useProjectPortalLink";
import type {
  ClientPortalAccount,
  DealResource,
  LbsDeal,
} from "@/modules/types";

const WIZARD_STEPS = ["analysis", "maintenance", "confirm", "email"] as const;
type WizardStep = (typeof WIZARD_STEPS)[number];

const randomToken = () =>
  crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

const generateShortCode = (length = 8) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};

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
  const [step, setStep] = useState<WizardStep>("analysis");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [manualOverride, setManualOverride] =
    useState<ManualOverridePayload | null>(null);
  const [scheduleMode, setScheduleMode] =
    useState<MaintenanceScheduleMode>("auto");
  const [scheduleFreeMonths, setScheduleFreeMonths] = useState(3);
  const [manualReviewDate, setManualReviewDate] = useState(
    computeAutoMaintenanceReviewDate(3),
  );
  const [portalShortCode, setPortalShortCode] = useState<string | null>(null);
  const [analysisSkipped, setAnalysisSkipped] = useState(false);

  const { contactId, portalLink } = useProjectPortalLink(record);
  const briefProgress = useMemo(
    () => getProjectBriefProgress(record),
    [record],
  );

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
    isPending: checklistPending,
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

  const { total: credentialsCount = 0, isPending: credentialsPending } =
    useGetList(
      "deal_access_entries",
      {
        filter: { "deal_id@eq": record.id },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: open && !!record.id },
    );

  const { total: resourcesCount = 0, isPending: resourcesPending } =
    useGetList<DealResource>(
      "deal_resources",
      {
        filter: { "deal_id@eq": record.id },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: open && !!record.id },
    );

  const analysisLoading =
    checklistPending || credentialsPending || resourcesPending;

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

  const maintenanceReviewDate =
    scheduleMode === "manual" && manualReviewDate
      ? manualReviewDate
      : computeAutoMaintenanceReviewDate(scheduleFreeMonths);

  const form = useDeliverProjectForm({
    record,
    enabled: open,
    defaultMaintenanceMonths: scheduleFreeMonths,
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

  const resetWizard = () => {
    setStep("analysis");
    setManualOverride(null);
    setScheduleMode("auto");
    setScheduleFreeMonths(3);
    setManualReviewDate(computeAutoMaintenanceReviewDate(3));
    setPortalShortCode(null);
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
    try {
      await ensurePortalAccount();
      await form.deliverMutation.mutateAsync();
      await scheduleMaintenanceReview();
      notify("Project delivered to client portal", { type: "info" });
      refresh();
      handleClose();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not deliver project",
        { type: "error" },
      );
    }
  };

  const stepTitle: Record<WizardStep, string> = {
    analysis: "Analyzing project before delivery…",
    maintenance: "Schedule next review",
    confirm: "Confirm delivery details",
    email: "Review client email",
  };

  const stepDescription: Record<WizardStep, string> = {
    analysis: "Check readiness across brief, security, files, and portal.",
    maintenance:
      "Set when the team should run the next web maintenance review.",
    confirm: `Handoff settings for ${record.name}.`,
    email: "Preview what the client will receive after delivery.",
  };

  const goNext = () => {
    if (step === "analysis") {
      if (analysisBlocked) {
        notify(formatDeliveryAnalysisBlockerMessage(analysisItems), {
          type: "warning",
          autoHideDuration: 8000,
        });
        return;
      }
      setStep("maintenance");
    } else if (step === "maintenance") {
      form.setMaintenanceMonths(String(scheduleFreeMonths));
      setStep("confirm");
    } else if (step === "confirm") {
      if (!form.canSubmit) {
        notify(
          form.submitBlockers.length > 0
            ? `Still required: ${form.submitBlockers.join(". ")}`
            : "Complete required fields and confirm readiness",
          { type: "warning", autoHideDuration: 8000 },
        );
        return;
      }
      setStep("email");
    }
  };

  const goBack = () => {
    if (step === "email") setStep("confirm");
    else if (step === "confirm") setStep("maintenance");
    else if (step === "maintenance") setStep("analysis");
  };

  const analysisBlocked =
    !analysisSkipped && hasBlockingDeliveryAnalysis(analysisItems);
  const blockingAnalysisItems = useMemo(
    () => getBlockingDeliveryAnalysisItems(analysisItems),
    [analysisItems],
  );

  if (!open) return null;

  if (form.alreadyDelivered) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Portal access</DialogTitle>
            <DialogDescription>
              This project was already delivered. To give the client access
              again, share the portal link below — you do not need to run
              delivery twice.
            </DialogDescription>
          </DialogHeader>

          {portalLink ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Client portal link</p>
                <Input readOnly value={portalLink} className="text-xs" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(portalLink);
                    notify("Portal link copied", { type: "info" });
                  }}
                >
                  <Copy className="size-4" />
                  Copy link
                </Button>
                <Button type="button" variant="outline" asChild>
                  <a
                    href={portalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    Open portal
                  </a>
                </Button>
              </div>
              {clientEmail && clientEmail !== "—" ? (
                <p className="text-xs text-muted-foreground">
                  Portal account email: {clientEmail}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-warning/40 bg-warning/15 p-4 text-sm text-warning-foreground">
              No portal account is linked yet. Link a client contact, then
              create a portal invite from the project menu before sharing
              access.
            </div>
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
          setStep("maintenance");
        }}
      />
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{stepTitle[step]}</DialogTitle>
            <DialogDescription>{stepDescription[step]}</DialogDescription>
          </DialogHeader>

          {manualOverride ? (
            <div className="rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm">
              <p className="font-medium text-warning-foreground">
                Manual override active
              </p>
              <p className="text-muted-foreground mt-1 text-xs italic">
                "{manualOverride.reason}"
              </p>
            </div>
          ) : null}

          {step === "analysis" ? (
            <ProjectDeliveryAnalysisStep
              items={analysisItems}
              isLoading={analysisLoading}
              analysisSkipped={analysisSkipped}
              onSkipAnalysis={() => setAnalysisSkipped(true)}
            />
          ) : null}

          {step === "analysis" && analysisBlocked ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Fix these before continuing:</p>
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

          {step === "confirm" &&
          !form.canSubmit &&
          form.submitBlockers.length > 0 ? (
            <div className="rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm text-warning-foreground">
              <p className="font-medium">Still required on this step:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {form.submitBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {step === "maintenance" ? (
            <ProjectDeliveryMaintenanceStep
              mode={scheduleMode}
              onModeChange={setScheduleMode}
              freeMonths={scheduleFreeMonths}
              onFreeMonthsChange={setScheduleFreeMonths}
              manualDate={manualReviewDate}
              onManualDateChange={setManualReviewDate}
            />
          ) : null}

          {step === "confirm" ? (
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
          ) : null}

          {step === "email" ? (
            <ProjectDeliveryEmailPreview
              record={record}
              clientEmail={clientEmail !== "—" ? clientEmail : ""}
              portalShortCode={resolvedShortCode}
              siteUrl={form.siteUrl}
              notifyEmail={form.notifyEmail}
            />
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              {step !== "analysis" ? (
                <Button type="button" variant="ghost" onClick={goBack}>
                  <ChevronLeft className="size-4" />
                  Back
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {step === "analysis" && pendingChecklistCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOverrideOpen(true)}
                >
                  <AlertTriangle className="size-4" />
                  Deliver anyway
                </Button>
              ) : null}
              {step === "email" ? (
                <Button
                  type="button"
                  disabled={
                    form.alreadyDelivered || form.deliverMutation.isPending
                  }
                  onClick={() => void handleDeliver()}
                >
                  <Rocket className="size-4" />
                  {form.deliverMutation.isPending
                    ? "Delivering…"
                    : "Confirm delivery"}
                </Button>
              ) : (
                <Button type="button" onClick={goNext}>
                  <Rocket className="size-4" />
                  Continue delivery
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
