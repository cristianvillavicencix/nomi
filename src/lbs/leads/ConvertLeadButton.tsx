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
import { isLbsMode } from "@/lbs/productMode";
import { LBS_LEAD_STATUSES } from "@/lbs/navigation";

export const ConvertLeadButton = ({ record }: { record: Contact }) => {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState(record.company_name ?? "");
  const [createDeal, setCreateDeal] = useState(true);
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
      setCreateDeal(true);
    }
  }, [open]);

  const { mutate: convertLead, isPending } = useMutation({
    mutationFn: () =>
      (
        dataProvider as CrmDataProvider & {
          convertLeadToClient: (params: {
            contactId: Contact["id"];
            companyName: string;
            createDeal?: boolean;
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
      }),
    onSuccess: ({ company_id, deal_id }) => {
      if (deal_id != null) {
        notify("Lead converted to client and project created");
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
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
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
                  Also create a project for this client
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recommended. A project is opened in stage{" "}
                  <span className="font-medium">Closed Won</span> so it shows up
                  in Deals right away. You can edit details afterwards.
                </p>
              </div>
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
