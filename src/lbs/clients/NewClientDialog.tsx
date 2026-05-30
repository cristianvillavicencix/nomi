import { Form } from "ra-core";
import { useNavigate } from "react-router";
import { Loader2, X } from "lucide-react";
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
import {
  ClientCreateFormFields,
  type ClientCreateFormValues,
} from "@/lbs/clients/ClientCreateForm";
import { emptyClientFormValues } from "@/lbs/clients/clientFormValues";
import { getClientShowPath } from "@/lbs/routing";
import { useCreateClientSubmit } from "@/lbs/clients/useCreateClientSubmit";

type NewClientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const NewClientDialog = ({ open, onOpenChange }: NewClientDialogProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { submitClientCreate, isSaving } = useCreateClientSubmit();

  const handleClose = () => onOpenChange(false);

  const handleSubmit = async (values: ClientCreateFormValues) => {
    const companyId = await submitClientCreate(values);
    if (companyId == null) return;
    handleClose();
    navigate(getClientShowPath(companyId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92vh,44rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-xl md:max-w-3xl",
          isMobile &&
            "top-auto bottom-0 left-1/2 max-h-[92vh] translate-x-[-50%] translate-y-0 rounded-b-none rounded-t-2xl",
        )}
      >
        <Form
          key={open ? "new-client-open" : "new-client-closed"}
          className="flex min-h-0 flex-1 flex-col"
          defaultValues={emptyClientFormValues()}
          onSubmit={handleSubmit}
        >
          <DialogHeader className="relative shrink-0 space-y-1 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
            <DialogTitle>Nueva empresa</DialogTitle>
            <DialogDescription>
              Datos del negocio, contacto principal y facturación.
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
            <ClientCreateFormFields />
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
                  Guardando…
                </>
              ) : (
                "Crear empresa"
              )}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
