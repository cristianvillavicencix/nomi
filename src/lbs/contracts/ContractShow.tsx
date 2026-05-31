import { ShowBase, useShowContext } from "ra-core";
import { useParams } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { ShareRecordModal } from "@/components/atomic-crm/settings/ShareRecordModal";
import { AuthorBadge } from "@/components/atomic-crm/accountability/AuthorBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Contract } from "@/lbs/types";

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

export const ContractShow = () => {
  const { id } = useParams();
  if (!id) return null;

  return (
    <ShowBase resource="contracts" id={id}>
      <ContractShowContent />
    </ShowBase>
  );
};

const ContractShowContent = () => {
  const { record, isPending } = useShowContext<Contract>();

  if (isPending || !record) return null;

  return (
    <div className="mt-2 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{record.title}</h1>
          <Badge variant="outline" className="mt-2 capitalize">
            {record.status?.replace(/-/g, " ") ?? "draft"}
          </Badge>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Created by:</span>
            <AuthorBadge
              memberId={
                record.created_by_member_id ?? record.organization_member_id
              }
            />
          </div>
        </div>
        <ShareRecordModal
          resourceType="contracts"
          resourceId={record.id}
          orgId={record.org_id}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contract details</CardTitle>
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
            <div className="text-muted-foreground">Proposal</div>
            {record.proposal_id ? (
              <ReferenceField
                source="proposal_id"
                reference="proposals"
                record={record}
                link={(proposalId) => `/proposals/${proposalId}/show`}
              />
            ) : (
              "—"
            )}
          </div>
          <div>
            <div className="text-muted-foreground">Project</div>
            {record.deal_id ? (
              <ReferenceField
                source="deal_id"
                reference="deals"
                record={record}
                link={(dealId) => `/deals/${dealId}/show`}
              />
            ) : (
              "—"
            )}
          </div>
          <div>
            <div className="text-muted-foreground">Expires</div>
            <div>{formatDate(record.expires_at)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Signed</div>
            <div>
              {record.signed_at
                ? new Date(record.signed_at).toLocaleString()
                : "Not signed"}
            </div>
            {record.signatory_name ? (
              <div className="text-xs text-muted-foreground">
                Signed by {record.signatory_name}
              </div>
            ) : null}
          </div>
          {record.deposit_paid_at ? (
            <div>
              <div className="text-muted-foreground">Deposit paid</div>
              <div>{new Date(record.deposit_paid_at).toLocaleString()}</div>
            </div>
          ) : null}
          {record.notes ? (
            <div className="sm:col-span-2">
              <div className="text-muted-foreground">Notes</div>
              <div className="whitespace-pre-wrap">{record.notes}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {record.terms_snapshot ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Terms {record.terms_version ? `(v${record.terms_version})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[480px] overflow-y-auto rounded-md border bg-muted/20 p-4 text-sm whitespace-pre-wrap">
              {record.terms_snapshot}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
