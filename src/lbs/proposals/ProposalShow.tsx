import { useMutation } from "@tanstack/react-query";
import {
  ShowBase,
  useDataProvider,
  useGetList,
  useNotify,
  useRefresh,
  useShowContext,
} from "ra-core";
import { useNavigate, useParams } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Proposal, ProposalLineItem } from "@/lbs/types";

const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value ?? 0),
  );

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

  if (isPending || !record) return null;

  const canAccept =
    hasAcceptProposal && record.status !== "accepted" && !record.accepted_at;

  return (
    <div className="mt-2 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{record.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {record.status?.replace(/-/g, " ") ?? "draft"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatMoney(record.amount)}
            </span>
          </div>
        </div>
        {canAccept ? (
          <Button
            onClick={() => acceptProposal()}
            disabled={isAccepting}
          >
            Accept proposal
          </Button>
        ) : null}
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
            <div>{formatDate(record.valid_until)}</div>
          </div>
          {record.notes ? (
            <div className="sm:col-span-2">
              <div className="text-muted-foreground">Notes</div>
              <div className="whitespace-pre-wrap">{record.notes}</div>
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
              Line items will appear here once added to this proposal.
            </p>
          ) : (
            <ul className="space-y-2">
              {lineItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <span>{item.description}</span>
                  <span className="text-muted-foreground">
                    {item.quantity ?? 1} × {formatMoney(item.unit_price)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
