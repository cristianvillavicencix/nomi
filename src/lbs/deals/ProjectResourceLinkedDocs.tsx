import type { ReactNode } from "react";
import { ListChecks } from "lucide-react";
import { useGetList } from "ra-core";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import type { Contract, LbsDeal, Proposal } from "@/lbs/types";
import type { FormSubmissionV2 } from "@/lbs/forms-v2/types";

const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value ?? 0),
  );

const ResourceSection = ({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) => {
  if (count === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Badge variant="secondary">{count}</Badge>
      </div>
      {children}
    </section>
  );
};

const LinkedRecordList = <
  T extends {
    id: unknown;
    title?: string;
    status?: string;
    amount?: number | null;
  },
>({
  items,
  getHref,
  getLabel,
}: {
  items: T[];
  getHref: (item: T) => string;
  getLabel: (item: T) => string;
}) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {items.map((item) => (
      <Link
        key={String(item.id)}
        to={getHref(item)}
        className="flex flex-col justify-between rounded-lg border p-4 text-sm hover:bg-muted/50"
      >
        <div>
          <div className="font-medium">{getLabel(item)}</div>
          {item.status ? (
            <Badge variant="outline" className="mt-2 capitalize">
              {item.status.replace(/-/g, " ")}
            </Badge>
          ) : null}
        </div>
        {"amount" in item && item.amount != null ? (
          <div className="mt-3 text-muted-foreground">
            {formatMoney(item.amount)}
          </div>
        ) : null}
      </Link>
    ))}
  </div>
);

export const ProjectResourceLinkedDocs = ({
  dealId,
}: {
  dealId: LbsDeal["id"];
}) => {
  const { data: proposals = [], isPending: proposalsPending } =
    useGetList<Proposal>(
      "proposals",
      {
        filter: { "deal_id@eq": dealId },
        pagination: { page: 1, perPage: 50 },
        sort: { field: "updated_at", order: "DESC" },
      },
      { staleTime: 30_000 },
    );

  const { data: contracts = [], isPending: contractsPending } =
    useGetList<Contract>(
      "contracts",
      {
        filter: { "deal_id@eq": dealId },
        pagination: { page: 1, perPage: 50 },
        sort: { field: "updated_at", order: "DESC" },
      },
      { staleTime: 30_000 },
    );

  const { data: submissions = [], isPending: submissionsPending } =
    useGetList<FormSubmissionV2>(
      "form_submissions_v2",
      {
        filter: { "deal_id@eq": dealId },
        pagination: { page: 1, perPage: 50 },
        sort: { field: "submitted_at", order: "DESC" },
      },
      { staleTime: 30_000 },
    );

  if (proposalsPending || contractsPending || submissionsPending) return null;

  if (
    proposals.length === 0 &&
    contracts.length === 0 &&
    submissions.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-8">
      <ResourceSection title="Proposals" count={proposals.length}>
        <LinkedRecordList
          items={proposals}
          getHref={(item) => `/proposals/${item.id}/show`}
          getLabel={(item) => item.title}
        />
      </ResourceSection>

      <ResourceSection title="Contracts" count={contracts.length}>
        <LinkedRecordList
          items={contracts}
          getHref={(item) => `/contracts/${item.id}/show`}
          getLabel={(item) => item.title}
        />
      </ResourceSection>

      <ResourceSection title="Form submissions" count={submissions.length}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {submissions.map((submission) => (
            <Link
              key={submission.id}
              to={`/forms-v2/submissions/${submission.id}`}
              className="flex items-center justify-between rounded-lg border p-4 text-sm hover:bg-muted/50"
            >
              <div>
                <div className="font-medium">
                  Form submission #{submission.id}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {submission.submitted_at
                    ? new Date(submission.submitted_at).toLocaleString()
                    : "—"}
                </div>
              </div>
              <ListChecks className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </ResourceSection>
    </div>
  );
};

export const useProjectLinkedDocsCount = (dealId: LbsDeal["id"]) => {
  const { total: proposalsCount = 0 } = useGetList<Proposal>(
    "proposals",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const { total: contractsCount = 0 } = useGetList<Contract>(
    "contracts",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const { total: formSubmissionsCount = 0 } = useGetList<FormSubmission>(
    "form_submissions",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  return proposalsCount + contractsCount + formSubmissionsCount;
};
