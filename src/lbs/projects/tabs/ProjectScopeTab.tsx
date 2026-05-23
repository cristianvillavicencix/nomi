import { useGetList, useGetOne } from "ra-core";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoneyText } from "@/lib/permissions/MoneyText";
import type { LbsDeal, Proposal, ProposalLineItem } from "@/lbs/types";

export const ProjectScopeTab = ({ record }: { record: LbsDeal }) => {
  const proposalId = record.accepted_proposal_id;

  const { data: proposal } = useGetOne<Proposal>(
    "proposals",
    { id: proposalId as number },
    { enabled: proposalId != null },
  );

  const { data: lineItems = [] } = useGetList<ProposalLineItem>(
    "proposal_line_items",
    {
      filter: { "proposal_id@eq": proposalId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
    },
    { enabled: proposalId != null, staleTime: 30_000 },
  );

  if (!proposalId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No accepted proposal linked. Accept a proposal or link one when
          creating the project.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {proposal?.title ?? "Accepted proposal"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="capitalize">
              {proposal?.status ?? "accepted"}
            </Badge>
            <span>
              Amount: <MoneyText value={proposal?.amount ?? record.amount} />
            </span>
            {proposal?.accepted_at ? (
              <span>
                Accepted {new Date(proposal.accepted_at).toLocaleDateString()}
              </span>
            ) : null}
          </div>
          {proposal?.notes ? (
            <p className="whitespace-pre-wrap text-muted-foreground">
              {proposal.notes}
            </p>
          ) : null}
          <Link
            to={`/proposals/${proposalId}/show`}
            className="text-sm link-action"
          >
            View full proposal
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No line items on this proposal.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => {
                  const qty = Number(item.quantity ?? 1);
                  const unit = Number(item.unit_price ?? 0);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{qty}</TableCell>
                      <TableCell className="text-right">
                        <MoneyText value={unit} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyText value={qty * unit} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
