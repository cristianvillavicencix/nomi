import { CompanyCreateDialog } from "@/modules/clients/CompanyCreateDialog";

const NEW_CLIENT_DRAFT_KEY = "lbs:new-client";

type NewClientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const NewClientDialog = ({ open, onOpenChange }: NewClientDialogProps) => (
  <CompanyCreateDialog
    open={open}
    onOpenChange={onOpenChange}
    draftKey={NEW_CLIENT_DRAFT_KEY}
    enableDraft
  />
);
