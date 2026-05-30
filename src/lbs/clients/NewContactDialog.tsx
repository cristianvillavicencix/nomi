import { useState } from "react";
import {
  CreateBase,
  Form,
  useGetIdentity,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import { Loader2, X } from "lucide-react";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { TextInput } from "@/components/admin/text-input";
import { ReferenceInput } from "@/components/admin/reference-input";
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
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { AutocompleteCompanyInput } from "@/components/atomic-crm/companies/AutocompleteCompanyInput";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_CLIENT_STATUS } from "@/lbs/navigation";
import { splitClientFullName } from "@/lbs/clients/ClientCreateForm";
import { useNavigate } from "react-router";
import { getPersonShowPath } from "@/lbs/routing";

type NewContactDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type NewContactFormValues = {
  full_name: string;
  email: string;
  phone: string;
  company_id: Identifier | null;
};

export const NewContactDialog = ({
  open,
  onOpenChange,
}: NewContactDialogProps) => {
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-lg",
          isMobile &&
            "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
        )}
      >
        <CreateBase
          resource="contacts"
          redirect={false}
          transform={(values: NewContactFormValues): Partial<Contact> => {
            const { firstName, lastName } = splitClientFullName(
              values.full_name ?? "",
            );
            const now = new Date().toISOString();
            return {
              first_name: firstName,
              last_name: lastName || firstName,
              company_id: values.company_id ?? undefined,
              status: LBS_CLIENT_STATUS,
              organization_member_id: identity?.id,
              email_jsonb: values.email?.trim()
                ? [{ email: values.email.trim(), type: "Work" }]
                : [],
              phone_jsonb: values.phone?.trim()
                ? [{ number: values.phone.trim(), type: "Work" }]
                : [],
              first_seen: now,
              last_seen: now,
              tags: [],
            };
          }}
          mutationOptions={{
            onMutate: () => setIsSaving(true),
            onSuccess: (contact) => {
              notify("Contacto creado", { type: "info" });
              refresh();
              handleClose();
              if (contact?.id != null) {
                navigate(getPersonShowPath(contact as Contact));
              }
            },
            onError: () => {
              notify("No se pudo crear el contacto", { type: "error" });
            },
            onSettled: () => setIsSaving(false),
          }}
        >
          <Form
            key={open ? "new-contact-open" : "new-contact-closed"}
            className="flex min-h-0 flex-1 flex-col"
            defaultValues={{
              full_name: "",
              email: "",
              phone: "",
              company_id: null,
            }}
          >
            <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
              <DialogTitle>Nuevo contacto</DialogTitle>
              <DialogDescription>
                Persona vinculada a una empresa cliente.
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
              <div className="space-y-4">
                <TextInput
                  source="full_name"
                  label="Nombre completo"
                  validate={(value) =>
                    value?.trim() ? undefined : "Obligatorio"
                  }
                  helperText={false}
                />
                <EmailInput source="email" label="Correo" helperText={false} />
                <PhoneInput source="phone" label="Teléfono" helperText={false} />
                <ReferenceInput
                  reference="companies"
                  source="company_id"
                  label="Empresa"
                  perPage={10}
                >
                  <AutocompleteCompanyInput
                    validate={(value) =>
                      value != null && value !== "" ? undefined : "Obligatorio"
                    }
                  />
                </ReferenceInput>
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
                onClick={handleClose}
                disabled={isSaving}
                className={isMobile ? "w-full" : ""}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className={isMobile ? "w-full" : ""}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creando…
                  </>
                ) : (
                  "Crear contacto"
                )}
              </Button>
            </DialogFooter>
          </Form>
        </CreateBase>
      </DialogContent>
    </Dialog>
  );
};
