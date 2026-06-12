import { Copy } from "lucide-react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const InvoiceShareLinkDialog = ({
  open,
  onOpenChange,
  shareUrl,
  invoiceNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  invoiceNumber?: string;
}) => {
  const notify = useNotify();

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    notify("Link copied", { type: "info" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share invoice</DialogTitle>
          <DialogDescription>
            {invoiceNumber
              ? `Share invoice ${invoiceNumber} with your client using this link.`
              : "Share this invoice with your client using the link below."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="invoice-share-url">Client link</Label>
          <div className="flex gap-2">
            <Input id="invoice-share-url" readOnly value={shareUrl} />
            <Button type="button" variant="outline" onClick={() => void copyLink()}>
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
          <Button type="button" onClick={() => void copyLink()}>
            <Copy className="size-4" />
            Copy link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
