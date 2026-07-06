import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { Sparkles } from "lucide-react";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact } from "@/components/atomic-crm/types";
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
import { getLeadDisplayName } from "@/modules/leads/leadCardUtils";

type ConvertWonLeadDialogProps = {
  lead: Contact | null;
  onClose: () => void;
  onConverted: (companyId: number) => void;
};

/**
 * Lightweight version of <ConvertLeadButton> for the Kanban won flow.
 * The lead has already moved to won when this opens; accepting also promotes
 * it to a client (and optionally a project). Declining keeps it as won.
 */
export const ConvertWonLeadDialog = ({
  lead,
  onClose,
  onConverted,
}: ConvertWonLeadDialogProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [companyName, setCompanyName] = useState("");
  const [createDeal, setCreateDeal] = useState(true);

  const hasExistingCompany = lead?.company_id != null;
  const initialCompanyName = lead?.company_name ?? "";

  useEffect(() => {
    setCompanyName(initialCompanyName);
    setCreateDeal(true);
  }, [initialCompanyName, lead?.id]);

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (!lead) throw new Error("No lead selected");
      const provider = dataProvider as CrmDataProvider & {
        convertLeadToClient: (params: {
          contactId: Contact["id"];
          companyName: string;
          createDeal?: boolean;
        }) => Promise<{
          company_id: number;
          contact_id: number;
          deal_id: number | null;
        }>;
      };
      return provider.convertLeadToClient({
        contactId: lead.id,
        companyName: hasExistingCompany
          ? (lead.company_name ?? companyName)
          : companyName,
        createDeal,
      });
    },
    onSuccess: ({ company_id, deal_id }) => {
      notify(
        deal_id != null
          ? "Lead converted to client and project created"
          : "Lead converted to client",
        { type: "info" },
      );
      onConverted(company_id);
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to convert lead", {
        type: "error",
      });
    },
  });

  const canSubmit = hasExistingCompany ? true : companyName.trim().length >= 2;

  return (
    <Dialog
      open={lead != null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Convert to client?
          </DialogTitle>
          <DialogDescription>
            You marked{" "}
            <span className="font-medium">
              {lead ? getLeadDisplayName(lead) : "this lead"}
            </span>{" "}
            as <span className="font-medium">Won</span>. Promote them to a
            client now?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!hasExistingCompany ? (
            <div className="space-y-2">
              <Label htmlFor="kanban-won-company-name">
                Client company name
              </Label>
              <Input
                id="kanban-won-company-name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Acme Corp"
              />
            </div>
          ) : null}
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id="kanban-won-create-deal"
              checked={createDeal}
              onCheckedChange={(value) => setCreateDeal(value === true)}
            />
            <div className="space-y-1">
              <Label
                htmlFor="kanban-won-create-deal"
                className="cursor-pointer font-medium"
              >
                Also create a project for this client
              </Label>
              <p className="text-xs text-muted-foreground">
                Recommended. The project opens in{" "}
                <span className="font-medium">Closed Won</span> so it shows up
                in Deals right away.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            No, keep as won
          </Button>
          <Button onClick={() => mutate()} disabled={!canSubmit || isPending}>
            {isPending ? "Converting…" : "Yes, convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
