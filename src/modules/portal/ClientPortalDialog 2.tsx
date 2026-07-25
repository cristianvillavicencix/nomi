import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientPortalSection } from "@/modules/portal/ClientPortalSection";
import type { LbsDeal } from "@/modules/types";

export const ClientPortalDialog = ({
  record,
  open,
  onOpenChange,
}: {
  record: LbsDeal;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Client portal</DialogTitle>
          <DialogDescription>
            Generate a shareable read-only link to give your client visibility
            into this project.
          </DialogDescription>
        </DialogHeader>
        <ClientPortalSection record={record} />
      </DialogContent>
    </Dialog>
  );
};
