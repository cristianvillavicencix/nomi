import { FileInput, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type NewProjectChooserDialogProps = {
  open: boolean;
  onManual: () => void;
  onWebForm: () => void;
  onClose: () => void;
};

export const NewProjectChooserDialog = ({
  open,
  onManual,
  onWebForm,
  onClose,
}: NewProjectChooserDialogProps) => (
  <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>
          Create the project yourself or send a web form to the client. When
          they submit the form, the project is created automatically.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 py-2">
        <Button
          type="button"
          variant="outline"
          className="h-auto justify-start gap-3 px-4 py-4 text-left"
          onClick={onManual}
        >
          <FolderKanban className="size-5 shrink-0" />
          <span>
            <span className="block font-medium">Manual</span>
            <span className="block text-sm font-normal text-muted-foreground">
              Enter project details now in the CRM.
            </span>
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto justify-start gap-3 px-4 py-4 text-left"
          onClick={onWebForm}
        >
          <FileInput className="size-5 shrink-0" />
          <span>
            <span className="block font-medium">Web form</span>
            <span className="block text-sm font-normal text-muted-foreground">
              Send a link so the client fills in project requirements.
            </span>
          </span>
        </Button>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
