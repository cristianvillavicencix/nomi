import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetOne,
  useNotify,
} from "ra-core";
import { useFormContext } from "react-hook-form";
import { Eye, Loader2, Save } from "lucide-react";
import { TextInput } from "@/components/admin/text-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { InvoiceOnlinePaymentSetupDialog } from "@/modules/billing/InvoiceOnlinePaymentSetupDialog";
import {
  defaultProposalOnlinePaymentSetup,
  depositPercentFromOnlinePaymentSetup,
  parseProposalOnlinePaymentSetup,
  type OnlinePaymentSetup,
} from "@/modules/billing/onlinePaymentSetupBridge";
import { describeInvoiceOnlinePaymentSummary } from "@/modules/billing/invoiceRemainderSchedule";
import type {
  Proposal,
  ProposalLineItem,
  ProposalPaymentSchedule,
} from "@/modules/types";
import { ProposalCrmLinksCard } from "@/modules/proposals/ProposalCrmLinksCard";
import { ProposalCartPanel } from "@/modules/proposals/ProposalCartPanel";
import { ProposalCatalogPanel } from "@/modules/proposals/ProposalCatalogPanel";
import { DEFAULT_VALIDITY_DAYS } from "@/modules/proposals/proposalCommercialConstants";
import {
  calculateProposalTotals,
  computeValidUntil,
  type ProposalLineDraft,
} from "@/modules/proposals/proposalCommercialUtils";
import { saveProposalCommercial } from "@/modules/proposals/saveProposalCommercial";
import { isValidRecordId } from "@/lib/isValidRecordId";

export const PROPOSAL_BUILDER_FORM_ID = "proposal-builder-form";

type ProposalFormValues = {
  title: string;
  company_id: unknown;
  contact_id: unknown;
  deal_id: unknown;
  notes: string;
  validity_days: number;
};

const ProposalBuilderFields = ({
  lines,
  setLines,
  onlinePaymentSetup,
  setOnlinePaymentSetup,
  isSaving,
  proposalId,
  proposalStatus,
}: {
  lines: ProposalLineDraft[];
  setLines: (lines: ProposalLineDraft[]) => void;
  onlinePaymentSetup: OnlinePaymentSetup;
  setOnlinePaymentSetup: (value: OnlinePaymentSetup) => void;
  isSaving: boolean;
  proposalId?: string | number;
  proposalStatus?: Proposal["status"];
}) => {
  const { watch, setValue } = useFormContext<ProposalFormValues>();
  const validityDays = watch("validity_days") ?? DEFAULT_VALIDITY_DAYS;
  const companyId = watch("company_id");
  const title = watch("title");
  const [paymentSetupOpen, setPaymentSetupOpen] = useState(false);

  const anchorDate = useMemo(
    () => computeValidUntil(validityDays),
    [validityDays],
  );
  const issueDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId! },
    { enabled: isValidRecordId(companyId) },
  );

  useEffect(() => {
    if (!title?.trim() && company?.name) {
      setValue("title", `Proposal – ${company.name}`);
    }
  }, [company?.name, setValue, title]);

  const depositPercent =
    depositPercentFromOnlinePaymentSetup(onlinePaymentSetup);
  const totals = useMemo(
    () => calculateProposalTotals(lines, depositPercent),
    [lines, depositPercent],
  );

  const paymentSummary = useMemo(
    () =>
      describeInvoiceOnlinePaymentSummary({
        paymentMode: onlinePaymentSetup.paymentMode,
        depositPercent: onlinePaymentSetup.depositPercent,
        total: totals.oneTimeTotal,
        remainderSchedule: onlinePaymentSetup.remainderSchedule,
      }),
    [onlinePaymentSetup, totals.oneTimeTotal],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <Badge variant="secondary">Draft</Badge>
        {proposalId ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to={`/proposals/${proposalId}/preview`}>
              <Eye className="size-4" />
              Draft & review
            </Link>
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save draft
        </Button>
      </div>

      <TextInput source="title" className="sr-only" label={false} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,33fr)_minmax(0,17fr)]">
        <div className="min-h-0 lg:max-h-full lg:overflow-y-auto lg:overscroll-contain lg:pr-0.5">
          <ProposalCatalogPanel lines={lines} onChange={setLines} />
        </div>
        <div className="min-h-0 space-y-3 lg:max-h-full lg:overflow-y-auto lg:overscroll-contain lg:pl-0.5">
          <ProposalCrmLinksCard />
          <ProposalCartPanel
            lines={lines}
            onChange={setLines}
            totals={totals}
            onlinePaymentSetup={onlinePaymentSetup}
            paymentSummary={paymentSummary}
            onConfigurePayment={() => setPaymentSetupOpen(true)}
            isSaving={isSaving}
            proposalStatus={proposalStatus}
          />
        </div>
      </div>

      <InvoiceOnlinePaymentSetupDialog
        open={paymentSetupOpen}
        onOpenChange={setPaymentSetupOpen}
        total={totals.oneTimeTotal}
        issueDate={issueDate}
        dueDate={anchorDate}
        value={onlinePaymentSetup}
        context="proposal"
        onApply={(next) => {
          setOnlinePaymentSetup(next);
          setPaymentSetupOpen(false);
        }}
      />
    </div>
  );
};

export const ProposalBuilderForm = ({
  proposalId,
}: {
  proposalId?: string | number;
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 1);

  const [lines, setLines] = useState<ProposalLineDraft[]>([]);
  const [onlinePaymentSetup, setOnlinePaymentSetup] =
    useState<OnlinePaymentSetup>(() =>
      defaultProposalOnlinePaymentSetup(
        computeValidUntil(DEFAULT_VALIDITY_DAYS),
      ),
    );
  const [isSaving, setIsSaving] = useState(false);

  const { data: proposal, isPending: isProposalPending } = useGetOne<Proposal>(
    "proposals",
    { id: proposalId! },
    { enabled: isValidRecordId(proposalId) },
  );

  const { data: existingLines = [], isPending: isLinesPending } =
    useGetList<ProposalLineItem>(
      "proposal_line_items",
      {
        filter: { "proposal_id@eq": proposalId },
        pagination: { page: 1, perPage: 500 },
        sort: { field: "sort_order", order: "ASC" },
      },
      { enabled: isValidRecordId(proposalId) },
    );

  const { data: schedules = [], isPending: isSchedulesPending } =
    useGetList<ProposalPaymentSchedule>(
      "proposal_payment_schedules",
      {
        filter: { "proposal_id@eq": proposalId },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: isValidRecordId(proposalId) },
    );

  useEffect(() => {
    if (!isValidRecordId(proposalId)) return;
    if (isProposalPending || isLinesPending || isSchedulesPending) return;

    if (existingLines.length > 0) {
      setLines(
        existingLines.map((line, index) => ({
          key: `line-${line.id}`,
          description: line.description,
          quantity: line.quantity ?? 1,
          unit_price: line.unit_price ?? 0,
          billing_type: line.billing_type ?? "one_time",
          billing_interval: line.billing_interval ?? null,
          package_id: line.package_id ? Number(line.package_id) : null,
          addon_id: line.addon_id ? Number(line.addon_id) : null,
          sort_order: line.sort_order ?? index,
        })),
      );
    }

    const schedule = schedules[0];
    const anchorDate =
      proposal?.valid_until ??
      schedule?.deposit_due_date ??
      computeValidUntil(proposal?.validity_days ?? DEFAULT_VALIDITY_DAYS);

    setOnlinePaymentSetup(
      parseProposalOnlinePaymentSetup({
        paymentScheduleConfig: proposal?.payment_schedule_config,
        depositPercent: proposal?.deposit_percent ?? 50,
        anchorDate,
      }),
    );
  }, [
    proposalId,
    isProposalPending,
    isLinesPending,
    isSchedulesPending,
    existingLines,
    schedules,
    proposal?.payment_schedule_config,
    proposal?.deposit_percent,
    proposal?.valid_until,
    proposal?.validity_days,
  ]);

  const companyIdFromUrl = searchParams.get("company_id");
  const contactIdFromUrl = searchParams.get("contact_id");
  const dealIdFromUrl = searchParams.get("deal_id");

  if (
    isValidRecordId(proposalId) &&
    (isProposalPending || isLinesPending || isSchedulesPending)
  ) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const defaultValues: ProposalFormValues = {
    title: proposal?.title ?? "",
    company_id:
      proposal?.company_id ??
      (companyIdFromUrl ? Number(companyIdFromUrl) : null),
    contact_id:
      proposal?.contact_id ??
      (contactIdFromUrl ? Number(contactIdFromUrl) : null),
    deal_id:
      proposal?.deal_id ?? (dealIdFromUrl ? Number(dealIdFromUrl) : null),
    notes: proposal?.notes ?? "",
    validity_days: proposal?.validity_days ?? DEFAULT_VALIDITY_DAYS,
  };

  return (
    <Form
      id={PROPOSAL_BUILDER_FORM_ID}
      key={proposalId ?? "create"}
      defaultValues={defaultValues}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={async (values: ProposalFormValues) => {
        const filledLines = lines.filter((line) => line.description.trim());
        if (filledLines.length === 0) {
          notify("Select a base package or add at least one line", {
            type: "warning",
          });
          return;
        }

        if (
          !isValidRecordId(values.company_id) &&
          !isValidRecordId(values.contact_id)
        ) {
          notify("Select a client or lead before saving", { type: "warning" });
          return;
        }

        setIsSaving(true);
        try {
          const { proposal: saved } = await saveProposalCommercial(
              dataProvider,
              {
                orgId,
                proposal: {
                  ...values,
                  organization_member_id: identity?.id ?? null,
                  notes: values.notes?.trim() || null,
                },
                lines: filledLines,
                onlinePaymentSetup,
                validityDays: values.validity_days,
              },
              proposalId ?? null,
            );
          notify("Proposal saved", { type: "success" });
          navigate(`/proposals/${saved.id}/preview`);
        } catch (error) {
          notify(
            error instanceof Error ? error.message : "Failed to save proposal",
            { type: "error" },
          );
        } finally {
          setIsSaving(false);
        }
      }}
    >
      <ProposalBuilderFields
          lines={lines}
          setLines={setLines}
          onlinePaymentSetup={onlinePaymentSetup}
          setOnlinePaymentSetup={setOnlinePaymentSetup}
          isSaving={isSaving}
        proposalId={proposalId}
        proposalStatus={proposal?.status}
      />
    </Form>
  );
};
