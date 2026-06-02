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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type {
  Proposal,
  ProposalLineItem,
  ProposalPaymentSchedule,
} from "@/lbs/types";
import { ProposalCrmLinksCard } from "@/lbs/proposals/ProposalCrmLinksCard";
import { ProposalCartPanel } from "@/lbs/proposals/ProposalCartPanel";
import { ProposalCatalogPanel } from "@/lbs/proposals/ProposalCatalogPanel";
import {
  DEFAULT_DEPOSIT_PERCENT,
  DEFAULT_VALIDITY_DAYS,
} from "@/lbs/proposals/proposalCommercialConstants";
import {
  calculateProposalTotals,
  computeValidUntil,
  type PaymentScheduleConfig,
  type ProposalLineDraft,
} from "@/lbs/proposals/proposalCommercialUtils";
import { saveProposalCommercial } from "@/lbs/proposals/saveProposalCommercial";

export const PROPOSAL_BUILDER_FORM_ID = "proposal-builder-form";

const defaultScheduleConfig = (): PaymentScheduleConfig => ({
  installment_frequency: "weekly",
  installment_count: 4,
  deposit_due_date: computeValidUntil(DEFAULT_VALIDITY_DAYS),
  balance_start_date: null,
});

type ProposalFormValues = {
  title: string;
  company_id: unknown;
  contact_id: unknown;
  deal_id: unknown;
  notes: string;
  validity_days: number;
  deposit_percent: number;
};

const ProposalBuilderFields = ({
  lines,
  setLines,
  scheduleConfig,
  setScheduleConfig,
  isSaving,
  proposalId,
}: {
  lines: ProposalLineDraft[];
  setLines: (lines: ProposalLineDraft[]) => void;
  scheduleConfig: PaymentScheduleConfig;
  setScheduleConfig: (config: PaymentScheduleConfig) => void;
  isSaving: boolean;
  proposalId?: string | number;
}) => {
  const { watch, setValue } = useFormContext<ProposalFormValues>();
  const depositPercent = watch("deposit_percent") ?? DEFAULT_DEPOSIT_PERCENT;
  const companyId = watch("company_id");
  const title = watch("title");

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId! },
    { enabled: companyId != null && companyId !== "" },
  );

  useEffect(() => {
    if (!title?.trim() && company?.name) {
      setValue("title", `Proposal – ${company.name}`);
    }
  }, [company?.name, setValue, title]);

  const totals = useMemo(
    () => calculateProposalTotals(lines, depositPercent),
    [lines, depositPercent],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
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

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,33fr)_minmax(0,17fr)] lg:items-start">
        <div className="min-w-0 space-y-3">
          <ProposalCrmLinksCard />
          <ProposalCatalogPanel lines={lines} onChange={setLines} />
        </div>
        <div className="min-w-0 lg:sticky lg:top-2 lg:self-start">
          <ProposalCartPanel
          lines={lines}
          onChange={setLines}
          totals={totals}
          depositPercent={depositPercent}
          scheduleConfig={scheduleConfig}
          onScheduleChange={setScheduleConfig}
          isSaving={isSaving}
          />
        </div>
      </div>
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
  const [isSaving, setIsSaving] = useState(false);
  const [lines, setLines] = useState<ProposalLineDraft[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<PaymentScheduleConfig>(
    defaultScheduleConfig,
  );

  const { data: proposal, isPending: isProposalPending } = useGetOne<Proposal>(
    "proposals",
    { id: proposalId! },
    { enabled: proposalId != null },
  );

  const { data: existingLines = [], isPending: isLinesPending } =
    useGetList<ProposalLineItem>(
      "proposal_line_items",
      {
        filter: { "proposal_id@eq": proposalId },
        pagination: { page: 1, perPage: 200 },
        sort: { field: "sort_order", order: "ASC" },
      },
      { enabled: proposalId != null },
    );

  const { data: schedules = [], isPending: isSchedulesPending } =
    useGetList<ProposalPaymentSchedule>(
      "proposal_payment_schedules",
      {
        filter: { "proposal_id@eq": proposalId },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: proposalId != null },
    );

  useEffect(() => {
    if (proposalId == null) return;
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
    const configFromProposal = proposal?.payment_schedule_config as
      | PaymentScheduleConfig
      | undefined;

    setScheduleConfig(
      configFromProposal ??
        (schedule
          ? {
              installment_frequency: schedule.installment_frequency,
              installment_count: schedule.installment_count,
              deposit_due_date: schedule.deposit_due_date,
              balance_start_date: null,
            }
          : defaultScheduleConfig()),
    );
  }, [
    proposalId,
    isProposalPending,
    isLinesPending,
    isSchedulesPending,
    existingLines,
    schedules,
    proposal?.payment_schedule_config,
  ]);

  const companyIdFromUrl = searchParams.get("company_id");
  const contactIdFromUrl = searchParams.get("contact_id");
  const dealIdFromUrl = searchParams.get("deal_id");

  if (
    proposalId != null &&
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
    deposit_percent: proposal?.deposit_percent ?? DEFAULT_DEPOSIT_PERCENT,
  };

  return (
    <>
      <Form
        id={PROPOSAL_BUILDER_FORM_ID}
        key={proposalId ?? "create"}
        defaultValues={defaultValues}
        onSubmit={async (values: ProposalFormValues) => {
          const filledLines = lines.filter((line) => line.description.trim());
          if (filledLines.length === 0) {
            notify("Select a base package or add at least one line", {
              type: "warning",
            });
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
                scheduleConfig,
                validityDays: values.validity_days,
                depositPercent: values.deposit_percent,
              },
              proposalId ?? null,
            );
            notify("Proposal saved", { type: "success" });
            navigate(`/proposals/${saved.id}/preview`);
          } catch (error) {
            notify(
              error instanceof Error
                ? error.message
                : "Failed to save proposal",
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
          scheduleConfig={scheduleConfig}
          setScheduleConfig={setScheduleConfig}
          isSaving={isSaving}
          proposalId={proposalId}
        />
      </Form>
    </>
  );
};
