import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import { useNavigate } from "react-router";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact } from "@/components/atomic-crm/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

  const { mutate: convertLead, isPending } = useMutation({
    mutationFn: () =>
      (
        dataProvider as CrmDataProvider & {
          convertLeadToClient: (params: {
            contactId: Contact["id"];
            companyName: string;
          }) => Promise<{ company_id: number }>;
        }
      ).convertLeadToClient({
        contactId: record.id,
        companyName,
      }),
    onSuccess: ({ company_id }) => {
      notify("Lead converted to client");
      setOpen(false);
      navigate(`/clients/${company_id}/show`);
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to convert lead", { type: "error" });
    },
  });

  if (!isLead || !hasConvert || record.company_id != null) {
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
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="company-name">Client company name</Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => convertLead()}
              disabled={isPending || companyName.trim().length < 2}
            >
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
