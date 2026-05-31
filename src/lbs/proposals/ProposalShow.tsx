import { useMutation } from "@tanstack/react-query";
import {
  ShowBase,
  useDataProvider,
  useGetList,
  useNotify,
  useRefresh,
  useShowContext,
} from "ra-core";
import { Link, useNavigate, useParams } from "react-router";
import { Pencil } from "lucide-react";
import { ReferenceField } from "@/components/admin/reference-field";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { ShareRecordModal } from "@/components/atomic-crm/settings/ShareRecordModal";
import { AuthorBadge } from "@/components/atomic-crm/accountability/AuthorBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { ProposalPageShell } from "@/lbs/proposals/ProposalPageShell";
import { ProposalSendActions } from "@/lbs/proposals/ProposalSendActions";
import type {
  Proposal,
  ProposalLineItem,
  ProposalPaymentInstallment,
} from "@/lbs/types";

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const ProposalShow = () => {
  const { id } = useParams();
  if (!id) return null;

  return (
    <ShowBase resource="proposals" id={id}>
      <ProposalShowContent />
    </ShowBase>
  );
};

const ProposalShowContent = () => {
  const { record, isPending } = useShowContext<Proposal>();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();

  const hasAcceptProposal =
    "acceptProposal" in dataProvider &&
    typeof (dataProvider as CrmDataProvider & { acceptProposal?: unknown })
      .acceptProposal === "function";

  const { mutate: acceptProposal, isPending: isAccepting } = useMutation({
    mutationFn: () =>
      (
        dataProvider as CrmDataProvider & {
          acceptProposal: (params: { id: Proposal["id"] }) => Promise<unknown>;
        }
      ).acceptProposal({ id: record!.id }),
    onSuccess: (result) => {
      notify("Proposal accepted");
      refresh();
      if (result && typeof result === "object" && "deal_id" in result) {
        navigate(`/deals/${(result as { deal_id: number }).deal_id}/show`);
      }
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to accept proposal", { type: "error" });
    },
  });

  const { data: lineItems = [] } = useGetList<ProposalLineItem>(
    "proposal_line_items",
    {
      filter: { "proposal_id@eq": record?.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );

  const { data: installments = [] } = useGetList<ProposalPaymentInstallment>(
    "proposal_payment_installments",
    {
      filter: { "proposal_id@eq": record?.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "installment_number", order: "ASC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );

  if (isPending || !record) return null;

  const canAccept =
    hasAcceptProposal && record.status !== "accepted" && !record.accepted_at;
  const canEdit =
    record.status === "draft" ||
    record.status === "sent" ||
    record.status === "viewed";

  return (
    <ProposalPageShell
      title={record.title}
      actions={
        <>
          <ProposalSendActions
            proposal={record}
            lineItems={lineItems}
            installments={installments}
            onSent={() => refresh()}
          />
          {canEdit ? (
            <Button variant="outline" asChild>
              <Link to={`/proposals/${record.id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
          ) : null}
          <ShareRecordModal
            resourceType="proposals"
            resourceId={record.id}
            orgId={record.org_id}
          />
          {canAccept ? (
            <Button onClick={() => acceptProposal()} disabled={isAccepting}>
              Accept proposal
            </Button>
          ) : null}
        </>
      }
    >
      <div className="max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {record.proposal_number ? (
            <Badge variant="secondary">{record.proposal_number}</Badge>
          ) : null}
          <Badge variant="outline" className="capitalize">
            {record.status?.replace(/-/g, " ") ?? "draft"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            <MoneyText value={record.amount} />
          </span>
          <span className="text-sm text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">
            Created by{" "}
            <AuthorBadge
              memberId={
                record.created_by_member_id ?? record.organization_member_id
              }
            />
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Client</div>
              {record.company_id ? (
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  record={record}
                  link={(companyId) => `/clients/${companyId}/show`}
                />
              ) : (
                "—"
              )}
            </div>
            <div>
              <div className="text-muted-foreground">Contact</div>
              {record.contact_id ? (
                <ReferenceField
                  source="contact_id"
                  reference="contacts_summary"
                  record={record}
                />
              ) : (
                "—"
              )}
            </div>
            <div>
              <div className="text-muted-foreground">Valid until</div>
              <div>
                {formatDate(record.valid_until)}
                {record.validity_days ? ` (${record.validity_days} days)` : ""}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Deposit (50%)</div>
              <div>
                <MoneyText value={record.deposit_amount ?? 0} />
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Balance</div>
              <div>
                <MoneyText value={record.balance_amount ?? 0} />
              </div>
            </div>
            {record.notes ? (
              <div className="sm:col-span-2">
                <div className="text-muted-foreground">Notes</div>
                <div className="whitespace-pre-wrap">{record.notes}</div>
              </div>
            ) : null}
            {record.contract_id ? (
              <div className="sm:col-span-2">
                <div className="text-muted-foreground">Contract</div>
                <Link
                  to={`/contracts/${record.contract_id}/show`}
                  className="link-action"
                >
                  View contract
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Line items</CardTitle>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No line items yet.{" "}
                <Link
                  to={`/proposals/${record.id}/edit`}
                  className="link-action"
                >
                  Edit proposal
                </Link>{" "}
                to add packages and add-ons.
              </p>
            ) : (
              <ul className="space-y-2">
                {lineItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span>{item.description}</span>
                      {item.billing_type === "recurring" ? (
                        <Badge variant="outline" className="text-[10px]">
                          {item.billing_interval ?? "monthly"}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground">
                      {item.quantity ?? 1} ×{" "}
                      <MoneyText value={item.unit_price} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {installments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Payment schedule is generated when you save the proposal in the
                builder.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Label</th>
                      <th className="px-3 py-2 font-medium">Due</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="px-3 py-2">{row.installment_number}</td>
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2">
                          {formatDate(row.due_date)}
                        </td>
                        <td className="px-3 py-2 capitalize">{row.status}</td>
                        <td className="px-3 py-2 text-right">
                          <MoneyText value={row.amount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProposalPageShell>
  );
};
