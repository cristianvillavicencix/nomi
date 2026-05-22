import { useMemo, useState } from "react";
import { Copy, ExternalLink, Link2, Mail, Upload } from "lucide-react";
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
import { buildProjectResourcesUrl } from "@/lbs/deals/projectResourceConstants";
import { mailtoHref } from "@/lib/linking";

type SendProjectResourcesDialogProps = {
  open: boolean;
  onClose: () => void;
  dealId: string | number;
  companyId?: string | number | null;
  contactId?: string | number | null;
  clientEmail?: string;
  clientName?: string;
  projectName?: string;
};

export const SendProjectResourcesDialog = ({
  open,
  onClose,
  dealId,
  companyId,
  contactId,
  clientEmail,
  clientName,
  projectName,
}: SendProjectResourcesDialogProps) => {
  const [copied, setCopied] = useState(false);

  const formUrl = useMemo(
    () =>
      buildProjectResourcesUrl(window.location.origin, {
        dealId,
        companyId,
        contactId,
      }),
    [dealId, companyId, contactId],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const emailHref = useMemo(() => {
    if (!formUrl || !clientEmail?.trim()) return "";
    const trimmed = clientEmail.trim().toLowerCase();
    if (!mailtoHref(trimmed)) return "";
    const subject = encodeURIComponent(
      projectName ? `Upload files for ${projectName}` : "Upload project files",
    );
    const body = encodeURIComponent(
      `Hi${clientName ? ` ${clientName}` : ""},\n\nPlease use this link to upload logos, service photos, and other project files. Everything will be organized in our project workspace.\n\n${formUrl}\n\nThank you!`,
    );
    return `mailto:${trimmed}?subject=${subject}&body=${body}`;
  }, [formUrl, clientEmail, clientName, projectName]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request files from client</DialogTitle>
          <DialogDescription>
            Send this link so your client can upload logos, service photos, team
            images, and other assets. Files are saved under Resources, grouped
            by category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Link2 className="mt-0.5 size-4 shrink-0" />
              <div>
                The client form asks for logos, service photos, team images,
                documents, and other project files.
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Upload link</Label>
            <div className="flex gap-2">
              <Input readOnly value={formUrl} />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                <Copy className="size-4" />
                <span className="sr-only">Copy link</span>
              </Button>
              <Button type="button" variant="outline" size="icon" asChild>
                <a href={formUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  <span className="sr-only">Open link</span>
                </a>
              </Button>
            </div>
            {copied ? (
              <p className="text-sm text-muted-foreground">Link copied.</p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onClose}>
            Done
          </Button>
          <div className="flex gap-2">
            {emailHref ? (
              <Button type="button" variant="outline" asChild>
                <a href={emailHref}>
                  <Mail className="size-4" />
                  Email client
                </a>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled>
                <Mail className="size-4" />
                Email client
              </Button>
            )}
            <Button type="button" asChild>
              <a href={formUrl} target="_blank" rel="noreferrer">
                <Upload className="size-4" />
                Preview form
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
