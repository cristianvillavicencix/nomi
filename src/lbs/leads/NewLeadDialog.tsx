import { useState } from "react";
import {
  Form,
  useCreate,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import { useWatch } from "react-hook-form";
import { useNavigate } from "react-router";
import { TextInput } from "@/components/admin/text-input";
import {
  FormGuardProvider,
  useGuardedDialogClose,
} from "@/components/admin/form-guard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { clearFormDraft } from "@/lib/formPersistence/formDraftStorage";
import type { Company } from "@/components/atomic-crm/types";
import {
  buildCompanyCreateData,
  buildContactCreatePayload,
} from "./buildCreateLeadPayload";
import { LeadCompanySection } from "./LeadCompanySection";
import { LeadContactSection } from "./LeadContactSection";
import { LeadFormSection } from "./LeadFormSection";
import { LeadInfoSection } from "./LeadInfoSection";
import { LeadTypeToggle } from "./LeadTypeToggle";
import {
  defaultNewLeadFormValues,
  type NewLeadFormValues,
} from "./newLeadFormTypes";
import { validateNewLeadForm } from "./newLeadFormValidation";

const NEW_LEAD_DRAFT_KEY = "lbs:new-lead";

type NewLeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const NewLeadDialog = ({ open, onOpenChange }: NewLeadDialogProps) => {
  const isMobile = useIsMobile();
  const [isSaving, setIsSaving] = useState(false);
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [create] = useCreate();

  const handleSubmit = async (values: NewLeadFormValues) => {
    const validation = validateNewLeadForm(values);
    if (!validation.ok) {
      notify(validation.message, { type: "warning" });
      return;
    }

    setIsSaving(true);
    try {
      let companyId: number | string | null = null;
      let companyName = "";

      if (values.lead_type === "business") {
        const created = (await create(
          "companies",
          {
            data: buildCompanyCreateData(values, identity?.id),
          },
          { returnPromise: true },
        )) as Company;
        companyId = created?.id ?? null;
        companyName = values.company_draft_name.trim();
      }

      const payload = buildContactCreatePayload(values, companyId, companyName);
      const contact = await create(
        "contacts",
        { data: payload },
        { returnPromise: true },
      );

      clearFormDraft(NEW_LEAD_DRAFT_KEY);
      notify("Lead created", { type: "info" });
      refresh();
      onOpenChange(false);
      if (contact?.id != null) {
        navigate(`/leads/${contact.id}/show`);
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to create lead",
        { type: "error" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Form
      className="flex min-h-0 flex-1 flex-col"
      defaultValues={defaultNewLeadFormValues(identity?.id)}
      onSubmit={handleSubmit}
    >
      <FormGuardProvider draftKey={NEW_LEAD_DRAFT_KEY} enabled>
        <NewLeadDialogShell
          isMobile={isMobile}
          isSaving={isSaving}
          onOpenChange={onOpenChange}
        />
      </FormGuardProvider>
    </Form>
  );
};

const NewLeadDialogShell = ({
  isMobile,
  isSaving,
  onOpenChange,
}: {
  isMobile: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const guardedClose = useGuardedDialogClose(onOpenChange);
  const leadType = useWatch<NewLeadFormValues, "lead_type">({ name: "lead_type" });
  const addPrimaryContact = useWatch<NewLeadFormValues, "add_primary_contact">({
    name: "add_primary_contact",
  });

  const showCompany = leadType === "business";
  const showContact =
    leadType === "individual" ||
    (leadType === "business" && addPrimaryContact);

  return (
    <Dialog open onOpenChange={guardedClose}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-xl md:max-w-2xl",
          isMobile &&
            "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
        )}
      >
        <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>
            Lead type, company or contact, source, and assignment.
          </DialogDescription>
          <DialogClose
            className="absolute top-3.5 right-3.5 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
            disabled={isSaving}
            onClick={(event) => {
              event.preventDefault();
              guardedClose(false);
            }}
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <LeadTypeToggle />

            {showCompany ? (
              <LeadFormSection title="Company" collapsible={false}>
                <LeadCompanySection />
              </LeadFormSection>
            ) : null}

            {showContact ? (
              <LeadFormSection title="Contact" collapsible={false}>
                <LeadContactSection />
              </LeadFormSection>
            ) : null}

            <LeadFormSection title="Lead details" collapsible={false}>
              <LeadInfoSection />
            </LeadFormSection>

            <LeadFormSection title="Notes" defaultOpen={false}>
              <TextInput
                source="background"
                label="Notes"
                multiline
                helperText={false}
              />
            </LeadFormSection>
          </div>
        </div>

        <DialogFooter
          className={cn(
            "shrink-0 gap-2 border-t bg-muted/30 px-5 py-4 sm:px-6",
            isMobile && "flex-col-reverse sm:flex-col-reverse",
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => guardedClose(false)}
            disabled={isSaving}
            className={isMobile ? "w-full" : ""}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving} className={isMobile ? "w-full" : ""}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create lead"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
