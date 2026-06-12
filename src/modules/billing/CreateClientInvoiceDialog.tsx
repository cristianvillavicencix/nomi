import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useGetMany,
  useGetOne,
  useNotify,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company } from "@/components/atomic-crm/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import type {
  ClientInvoice,
  Proposal,
  ProposalPaymentInstallment,
} from "@/modules/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyText } from "@/lib/permissions/MoneyText";

export type IssueClientInvoiceInput = {
  installmentId?: number;
  proposalId?: number;
  amount?: number;
  dueDate?: string;
  description?: string;
};

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatUsd = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);

const proposalOptionLabel = (proposal: Proposal) => {
  const number = proposal.proposal_number
    ? `#${proposal.proposal_number} · `
    : "";
  return `${number}${proposal.title}`;
};

type CreateClientInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  defaultProposalId?: number | string | null;
};

export const CreateClientInvoiceDialog = ({
  open,
  onOpenChange,
  onCreated,
  defaultProposalId = null,
}: CreateClientInvoiceDialogProps) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [proposalId, setProposalId] = useState("");
  const [installmentId, setInstallmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  const { data: proposals = [] } = useGetList<Proposal>("proposals", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "updated_at", order: "DESC" },
  });

  const { data: proposal } = useGetOne<Proposal>(
    "proposals",
    { id: proposalId },
    { enabled: Boolean(proposalId) },
  );

  const { data: installments = [] } = useGetList<ProposalPaymentInstallment>(
    "proposal_payment_installments",
    {
      filter: proposalId ? { "proposal_id@eq": proposalId } : {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "installment_number", order: "ASC" },
    },
    { enabled: Boolean(proposalId) },
  );

  const { data: existingInvoices = [] } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      filter: proposalId ? { "proposal_id@eq": proposalId } : {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: Boolean(proposalId) },
  );

  const invoicedInstallmentIds = useMemo(
    () =>
      new Set(
        existingInvoices
          .map((row) => row.installment_id)
          .filter(Boolean)
          .map(String),
      ),
    [existingInvoices],
  );

  const availableInstallments = useMemo(
    () =>
      installments.filter(
        (row) => !invoicedInstallmentIds.has(String(row.id)),
      ),
    [installments, invoicedInstallmentIds],
  );

  const companyIds = useMemo(
    () =>
      proposal?.company_id != null ? [proposal.company_id] : [],
    [proposal?.company_id],
  );

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );

  const company = companies[0] ?? null;

  useEffect(() => {
    if (!open) return;
    setProposalId(defaultProposalId ? String(defaultProposalId) : "");
    setInstallmentId("");
  }, [open, defaultProposalId]);

  useEffect(() => {
    if (!proposal) return;

    if (availableInstallments.length > 0) {
      const selected =
        availableInstallments.find((row) => String(row.id) === installmentId) ??
        availableInstallments[0];
      if (String(selected.id) !== installmentId) {
        setInstallmentId(String(selected.id));
      }
      setAmount(String(selected.amount ?? ""));
      setDueDate(selected.due_date ?? addDays(today, 30));
      setDescription(selected.label ?? `Invoice for ${proposal.title}`);
      return;
    }

    setInstallmentId("");
    const defaultAmount =
      Number(proposal.deposit_amount) > 0
        ? proposal.deposit_amount
        : proposal.amount ?? proposal.one_time_total ?? 0;
    setAmount(String(defaultAmount ?? ""));
    const defaultDue =
      proposal.valid_until && proposal.valid_until >= today
        ? proposal.valid_until
        : addDays(today, 30);
    setDueDate(defaultDue);
    const label = proposal.proposal_number
      ? `#${proposal.proposal_number} — ${proposal.title}`
      : proposal.title;
    setDescription(`Invoice for ${label}`);
  }, [
    proposal,
    availableInstallments,
    installmentId,
    today,
  ]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!proposalId) throw new Error("Select a proposal");
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a valid amount");
      }
      if (!dueDate) throw new Error("Enter a due date");
      if (!description.trim()) throw new Error("Enter a description");

      const payload: IssueClientInvoiceInput = {
        amount: parsedAmount,
        dueDate,
        description: description.trim(),
      };
      if (installmentId) {
        payload.installmentId = Number(installmentId);
      } else {
        payload.proposalId = Number(proposalId);
      }

      return dataProvider.issueClientInvoice(payload);
    },
    onSuccess: () => {
      notify("Invoice created", { type: "success" });
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error: Error) => {
      notify(error.message || "Could not create invoice", { type: "error" });
    },
  });

  const canSubmit =
    Boolean(proposalId) &&
    Boolean(amount) &&
    Boolean(dueDate) &&
    Boolean(description.trim());

  const lockedToInstallment = Boolean(installmentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create invoice</DialogTitle>
          <DialogDescription>
            Pick a proposal to pre-fill client, amount, and due date from its
            payment schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoice-proposal">Proposal</Label>
            <Select
              value={proposalId || undefined}
              onValueChange={(value) => {
                setProposalId(value);
                setInstallmentId("");
              }}
            >
              <SelectTrigger id="invoice-proposal">
                <SelectValue placeholder="Select proposal" />
              </SelectTrigger>
              <SelectContent>
                {proposals.map((row) => (
                  <SelectItem key={row.id} value={String(row.id)}>
                    {proposalOptionLabel(row)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {proposal ? (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <div className="text-muted-foreground">Bill to</div>
              <div className="font-medium">{company?.name ?? "—"}</div>
              <div className="mt-1 text-muted-foreground">
                Total proposal: <MoneyText value={proposal.amount} /> · Deposit:{" "}
                <MoneyText value={proposal.deposit_amount} />
              </div>
            </div>
          ) : null}

          {proposal && availableInstallments.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="invoice-installment">Payment installment</Label>
              <Select
                value={installmentId || undefined}
                onValueChange={setInstallmentId}
              >
                <SelectTrigger id="invoice-installment">
                  <SelectValue placeholder="Select installment" />
                </SelectTrigger>
                <SelectContent>
                  {availableInstallments.map((row) => (
                    <SelectItem key={row.id} value={String(row.id)}>
                      {row.label} · {formatUsd(row.amount)} · due{" "}
                      {formatBillingDate(row.due_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {proposal && installments.length > 0 && availableInstallments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All installments on this proposal already have invoices.
            </p>
          ) : null}

          {proposal ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice-amount">Amount</Label>
                  <Input
                    id="invoice-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    readOnly={lockedToInstallment}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-due">Due date</Label>
                  <Input
                    id="invoice-due"
                    type="date"
                    value={dueDate}
                    readOnly={lockedToInstallment}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-description">Description</Label>
                <Input
                  id="invoice-description"
                  value={description}
                  readOnly={lockedToInstallment}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Create invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const CreateClientInvoiceButton = ({
  defaultProposalId,
  onCreated,
}: {
  defaultProposalId?: number | string | null;
  onCreated?: () => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        From proposal
      </Button>
      <CreateClientInvoiceDialog
        open={open}
        onOpenChange={setOpen}
        defaultProposalId={defaultProposalId}
        onCreated={onCreated}
      />
    </>
  );
};
