import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  preview: ReactNode;
  recipientCount?: number;
  onConfirm: () => void;
  isPending?: boolean;
};

export const SendCampaignConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  preview,
  recipientCount,
  onConfirm,
  isPending,
}: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="rounded-lg border bg-muted/30 p-4">{preview}</div>
      {recipientCount != null ? (
        <p className="text-sm text-muted-foreground">
          This will queue <strong>{recipientCount}</strong> recipient
          {recipientCount === 1 ? "" : "s"} for delivery.
        </p>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={isPending}>
          Confirm send
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
