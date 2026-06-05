import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LeaveWithoutSavingDialogProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  title?: string;
  description?: string;
};

export const LeaveWithoutSavingDialog = ({
  open,
  onStay,
  onLeave,
  title = "Leave without saving?",
  description = "You have unsaved changes. Your draft is saved locally, but leaving now will discard what you entered on this screen unless you stay and continue.",
}: LeaveWithoutSavingDialogProps) => (
  <Dialog open={open} onOpenChange={(next) => !next && onStay()}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onStay}>
          Keep editing
        </Button>
        <Button type="button" variant="destructive" onClick={onLeave}>
          Leave anyway
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
