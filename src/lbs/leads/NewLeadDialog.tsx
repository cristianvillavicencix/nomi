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

  const handleClose = () => onOpenChange(false);

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

      notify("Lead created", { type: "info" });
      refresh();
      handleClose();
      if (contact?.id != null) {
        navigate(`/leads/${contact.id}/show`);
      }
    } catch {
      notify("Failed to create lead", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-xl md:max-w-2xl",
          isMobile &&
            "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
        )}
      >
        <Form
          key={open ? "new-lead-open" : "new-lead-closed"}
          className="flex min-h-0 flex-1 flex-col"
          defaultValues={defaultNewLeadFormValues(identity?.id)}
          onSubmit={handleSubmit}
        >
          <NewLeadDialogFields
            isMobile={isMobile}
            isSaving={isSaving}
            onCancel={handleClose}
          />
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const NewLeadDialogFields = ({
  isMobile,
  isSaving,
  onCancel,
}: {
  isMobile: boolean;
  isSaving: boolean;
  onCancel: () => void;
}) => {
  const leadType = useWatch<NewLeadFormValues, "lead_type">({ name: "lead_type" });
  const addPrimaryContact = useWatch<NewLeadFormValues, "add_primary_contact">({
    name: "add_primary_contact",
  });

  const showCompany = leadType === "business";
  const showContact =
    leadType === "individual" ||
    (leadType === "business" && addPrimaryContact);

  return (
    <>
      <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
        <DialogTitle>Nuevo lead</DialogTitle>
        <DialogDescription>
          Tipo de lead, empresa o contacto, origen y asignación.
        </DialogDescription>
        <DialogClose
          className="absolute top-3.5 right-3.5 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
          disabled={isSaving}
        >
          <X className="size-4" />
          <span className="sr-only">Cerrar</span>
        </DialogClose>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4">
          <LeadTypeToggle />

          {showCompany ? (
            <LeadFormSection title="Empresa" collapsible={false}>
              <LeadCompanySection />
            </LeadFormSection>
          ) : null}

          {showContact ? (
            <LeadFormSection title="Contacto" collapsible={false}>
              <LeadContactSection />
            </LeadFormSection>
          ) : null}

          <LeadFormSection title="Información del lead" collapsible={false}>
            <LeadInfoSection />
          </LeadFormSection>

          <LeadFormSection title="Notas" defaultOpen={false}>
            <TextInput
              source="background"
              label="Notas"
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
          onClick={onCancel}
          disabled={isSaving}
          className={isMobile ? "w-full" : ""}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving} className={isMobile ? "w-full" : ""}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creando…
            </>
          ) : (
            "Crear lead"
          )}
        </Button>
      </DialogFooter>
    </>
  );
};
