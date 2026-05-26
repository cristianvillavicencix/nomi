import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useGetOne, useNotify } from "ra-core";
import { useNavigate } from "react-router";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { isLbsMode } from "@/lbs/productMode";
import { LBS_LEAD_STATUSES } from "@/lbs/navigation";
import { lbsProjectTypeChoices } from "@/lbs/deals/lbsProjectConstants";

type LeadContact = Contact & {
  lead_value_estimate?: number | string | null;
};

export const ConvertLeadButton = ({ record }: { record: Contact }) => {
  const lead = record as LeadContact;
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState(record.company_name ?? "");
  const [createDeal, setCreateDeal] = useState(true);
  const [serviceType, setServiceType] = useState<string>(
    record.interested_service ?? "",
  );
  const initialAmount =
    lead.lead_value_estimate != null && lead.lead_value_estimate !== ""
      ? String(lead.lead_value_estimate)
      : "";
  const [amount, setAmount] = useState<string>(initialAmount);
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const navigate = useNavigate();

  const isLead =
    isLbsMode() &&
    record.status != null &&
    (LBS_LEAD_STATUSES as readonly string[]).includes(record.status);

  const hasConvert =
    "convertLeadToClient" in dataProvider &&
    typeof (dataProvider as CrmDataProvider & { convertLeadToClient?: unknown })
      .convertLeadToClient === "function";

  const hasExistingCompany = record.company_id != null;

  const { data: existingCompany } = useGetOne<Company>(
    "companies",
    { id: record.company_id as number },
    { enabled: hasExistingCompany && open },
  );

  const resolvedCompanyName =
    existingCompany?.name ?? record.company_name ?? "";

  useEffect(() => {
    if (hasExistingCompany && resolvedCompanyName) {
      setCompanyName(resolvedCompanyName);
    }
  }, [hasExistingCompany, resolvedCompanyName]);

  useEffect(() => {
    if (open) {
      setServiceType(record.interested_service ?? "");
      setAmount(initialAmount);
      setCreateDeal(true);
    }
  }, [open, record.interested_service, initialAmount]);

  const { mutate: convertLead, isPending } = useMutation({
    mutationFn: () => {
      const parsedAmount = Number.parseFloat(amount);
      return (
        dataProvider as CrmDataProvider & {
          convertLeadToClient: (params: {
            contactId: Contact["id"];
            companyName: string;
            createDeal?: boolean;
            dealOptions?: {
              projectType?: string | null;
              amount?: number | null;
              name?: string | null;
            };
          }) => Promise<{
            company_id: number;
            contact_id: number;
            deal_id: number | null;
          }>;
        }
      ).convertLeadToClient({
        contactId: record.id,
        companyName: hasExistingCompany
          ? resolvedCompanyName || record.company_name || ""
          : companyName,
        createDeal,
        dealOptions: createDeal
          ? {
              projectType: serviceType.trim() ? serviceType : null,
              amount: Number.isFinite(parsedAmount) ? parsedAmount : null,
            }
          : undefined,
      });
    },
    onSuccess: ({ company_id, deal_id }) => {
      if (deal_id != null) {
        notify("Lead converted to client and deal created");
      } else {
        notify("Lead converted to client");
      }
      setOpen(false);
      navigate(`/clients/${company_id}/show`);
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to convert lead", { type: "error" });
    },
  });

  const canSubmit = useMemo(() => {
    if (isPending) return false;
    if (hasExistingCompany) return resolvedCompanyName.trim().length > 0;
    return companyName.trim().length >= 2;
  }, [companyName, hasExistingCompany, isPending, resolvedCompanyName]);

  if (!isLead || !hasConvert) {
    return null;
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Convert to client
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert lead to client</DialogTitle>
            {hasExistingCompany ? (
              <DialogDescription>
                This lead is already linked to{" "}
                <span className="font-medium">
                  {resolvedCompanyName || "an existing company"}
                </span>
                . Converting promotes it to a client and sets this contact as
                the primary.
              </DialogDescription>
            ) : (
              <DialogDescription>
                A new client company will be created and linked to this contact.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            {!hasExistingCompany ? (
              <div className="space-y-2">
                <Label htmlFor="company-name">Client company name</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
            ) : null}
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="create-deal"
                  checked={createDeal}
                  onCheckedChange={(value) => setCreateDeal(value === true)}
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="create-deal"
                    className="cursor-pointer font-medium"
                  >
                    Create initial deal for this client
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    A deal in stage{" "}
                    <span className="font-medium">Closed Won</span> will be
                    created and linked to this client.
                  </p>
                </div>
              </div>
              {createDeal ? (
                <div className="grid gap-3 pl-7 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="service-type">Service type</Label>
                    <Select
                      value={serviceType}
                      onValueChange={(value) => setServiceType(value)}
                    >
                      <SelectTrigger id="service-type">
                        <SelectValue placeholder="Choose a service" />
                      </SelectTrigger>
                      <SelectContent>
                        {lbsProjectTypeChoices.map((choice) => (
                          <SelectItem key={choice.value} value={choice.value}>
                            {choice.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="deal-amount">Estimated amount ($)</Label>
                    <Input
                      id="deal-amount"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={1}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => convertLead()} disabled={!canSubmit}>
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
