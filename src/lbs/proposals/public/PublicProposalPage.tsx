import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchPublicProposal,
  acceptPublicProposal,
  signPublicProposalContract,
  type PublicProposalPayload,
} from "@/lbs/proposals/public/publicProposalApi";

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

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

const PublicProposalContent = ({
  token,
  payload,
  onRefresh,
}: {
  token: string;
  payload: PublicProposalPayload;
  onRefresh: () => void;
}) => {
  const { proposal, line_items, installments, contract, organization } =
    payload;
  const currency = proposal.currency ?? "USD";
  const [signatoryName, setSignatoryName] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [confirmDeposit, setConfirmDeposit] = useState(true);

  const acceptMutation = useMutation({
    mutationFn: () => acceptPublicProposal(proposal.id, token),
    onSuccess: () => onRefresh(),
  });

  const signMutation = useMutation({
    mutationFn: () =>
      signPublicProposalContract({
        proposalId: proposal.id,
        token,
        signatoryName: signatoryName.trim(),
        confirmDeposit,
      }),
    onSuccess: () => onRefresh(),
  });

  const isAccepted = !!proposal.accepted_at;
  const isSigned = !!contract?.signed_at;
  const depositPaid = !!contract?.deposit_paid_at;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-2 text-center">
        {organization.logo_url ? (
          <img
            src={organization.logo_url}
            alt={organization.name}
            className="mx-auto h-12 object-contain"
          />
        ) : null}
        <h1 className="text-2xl font-semibold">{proposal.title}</h1>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {proposal.proposal_number ? (
            <Badge variant="secondary">{proposal.proposal_number}</Badge>
          ) : null}
          <Badge variant="outline" className="capitalize">
            {proposal.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Valid until {formatDate(proposal.valid_until)} · Total{" "}
          {formatMoney(proposal.amount ?? 0, currency)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {line_items.map((item, index) => (
            <div
              key={`${item.description}-${index}`}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <div>
                <div>{item.description}</div>
                {item.billing_type === "recurring" ? (
                  <div className="text-xs text-muted-foreground">
                    Recurring · {item.billing_interval ?? "monthly"}
                  </div>
                ) : null}
              </div>
              <div className="text-muted-foreground">
                {item.quantity ?? 1} × {formatMoney(item.unit_price ?? 0, currency)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Deposit (50%)</span>
            <span>{formatMoney(proposal.deposit_amount ?? 0, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Balance</span>
            <span>{formatMoney(proposal.balance_amount ?? 0, currency)}</span>
          </div>
          {installments.map((row) => (
            <div key={row.installment_number} className="flex justify-between">
              <span>
                {row.label} · {formatDate(row.due_date)}
              </span>
              <span>{formatMoney(row.amount, currency)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {!isAccepted ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accept proposal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              By accepting, you agree to the services and payment schedule
              above. A contract will be generated for your signature.
            </p>
            <Button
              className="w-full"
              disabled={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
            >
              {acceptMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Accept proposal
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isAccepted && contract?.terms_snapshot && !isSigned ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/20 p-4 text-xs whitespace-pre-wrap">
              {contract.terms_snapshot}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signatory-name">Full legal name</Label>
              <Input
                id="signatory-name"
                value={signatoryName}
                onChange={(event) => setSignatoryName(event.target.value)}
                placeholder="Your full name"
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={agreedTerms}
                onCheckedChange={(checked) => setAgreedTerms(checked === true)}
              />
              <span>I have read and agree to the terms and conditions.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={confirmDeposit}
                onCheckedChange={(checked) =>
                  setConfirmDeposit(checked === true)
                }
              />
              <span>
                I confirm the 50% deposit ({formatMoney(proposal.deposit_amount ?? 0, currency)})
                will be paid per the agreed method.
              </span>
            </label>
            <Button
              className="w-full"
              disabled={
                signMutation.isPending ||
                !signatoryName.trim() ||
                !agreedTerms
              }
              onClick={() => signMutation.mutate()}
            >
              {signMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Sign contract
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isSigned ? (
        <Card>
          <CardContent className="py-6 text-center text-sm">
            <p className="font-medium text-green-700">
              Contract signed on {formatDate(contract?.signed_at?.slice(0, 10))}
            </p>
            {depositPaid ? (
              <p className="mt-2 text-muted-foreground">
                Deposit confirmation recorded. Our team will follow up shortly.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {proposal.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {proposal.notes}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export const PublicProposalPage = () => {
  const { token = "" } = useParams();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["public-proposal", token],
    queryFn: () => fetchPublicProposal(token),
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Invalid proposal link.
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-2/3 mx-auto" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        This proposal link is invalid or has expired.
      </div>
    );
  }

  return (
    <PublicProposalContent
      token={token}
      payload={data}
      onRefresh={() => void refetch()}
    />
  );
};
