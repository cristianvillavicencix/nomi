import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useGetList, useDataProvider, useNotify } from "ra-core";
import { Copy, ExternalLink, Loader2, Mail, Upload } from "lucide-react";
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
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { FormInstance } from "@/lbs/forms-v2/types";
import { PROJECT_RESOURCES_SLUG } from "@/lbs/deals/projectResourceConstants";
import {
  appendRequestScopeToUrl,
  type ResourceRequestScope,
} from "@/lbs/deals/projectResourceRequestScope";
import { mailtoHref } from "@/lib/linking";

const resolveShareUrl = (
  result: { url: string; short_url?: string },
  origin: string,
) => {
  if (result.short_url) {
    return result.short_url.startsWith("http")
      ? result.short_url
      : `${origin}${result.short_url}`;
  }
  return result.url.startsWith("http") ? result.url : `${origin}${result.url}`;
};

type SendProjectResourcesDialogProps = {
  open: boolean;
  onClose: () => void;
  dealId: string | number;
  companyId?: string | number | null;
  contactId?: string | number | null;
  clientEmail?: string;
  clientName?: string;
  projectName?: string;
  requestScope?: ResourceRequestScope;
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
  requestScope,
}: SendProjectResourcesDialogProps) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [copied, setCopied] = useState(false);

  const { data: forms = [] } = useGetList<FormInstance>(
    "form_instances",
    {
      filter: { "slug@eq": PROJECT_RESOURCES_SLUG, "is_active@eq": true },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: open, staleTime: 60_000 },
  );

  const formInstance = forms[0];

  const generateLink = useMutation({
    mutationFn: async () => {
      if (!formInstance) throw new Error("Project Resources form is not configured");
      return dataProvider.generateFormToken({
        formInstanceId: Number(formInstance.id),
        dealId: Number(dealId),
        companyId: companyId != null ? Number(companyId) : null,
        contactId: contactId != null ? Number(contactId) : null,
        expiresInDays: 30,
        maxUses: 1,
        baseUrl: window.location.origin,
      });
    },
    onError: () => {
      notify("Failed to generate upload link", { type: "error" });
    },
  });

  useEffect(() => {
    if (!open) {
      generateLink.reset();
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !formInstance || generateLink.data || generateLink.isPending) {
      return;
    }
    generateLink.mutate();
  }, [formInstance, generateLink.data, generateLink.isPending, open]);

  const formUrl = useMemo(() => {
    if (!generateLink.data) return "";
    const base = resolveShareUrl(generateLink.data, window.location.origin);
    return requestScope ? appendRequestScopeToUrl(base, requestScope) : base;
  }, [generateLink.data, requestScope]);

  const handleCopy = async () => {
    if (!formUrl) return;
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
            {requestScope
              ? "This link asks only for the selected categories (logo, team, or a specific service)."
              : "Send this link so your client can upload logos, team photos, service photos, and other assets through the Project Resources wizard."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Upload link</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={
                  generateLink.isPending
                    ? "Generating link…"
                    : formUrl || "Form unavailable"
                }
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!formUrl}
                onClick={() => void handleCopy()}
              >
                <Copy className="size-4" />
                <span className="sr-only">Copy link</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!formUrl}
                asChild
              >
                <a href={formUrl || "#"} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  <span className="sr-only">Open link</span>
                </a>
              </Button>
            </div>
            {generateLink.isPending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Creating secure link…
              </p>
            ) : null}
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
            <Button type="button" disabled={!formUrl} asChild>
              <a href={formUrl || "#"} target="_blank" rel="noreferrer">
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
