import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PREVIEW_SECTIONS = [
  "Introduction — editable welcome copy",
  "What's included — packages and add-ons with descriptions",
  "Investment — one-time vs recurring breakdown, deposit, and installment schedule",
  "Terms & conditions — from your organization template with merged variables",
  "Accept — client acceptance and deposit confirmation",
];

export const ProposalPreviewDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Proposal preview (coming soon)</DialogTitle>
        <DialogDescription>
          The navigable client-facing proposal will include these sections,
          styled like Better Proposals with a side menu:
        </DialogDescription>
      </DialogHeader>
      <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        {PREVIEW_SECTIONS.map((section) => (
          <li key={section}>{section}</li>
        ))}
      </ul>
      <DialogFooter>
        <Button type="button" onClick={() => onOpenChange(false)}>
          Got it
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
