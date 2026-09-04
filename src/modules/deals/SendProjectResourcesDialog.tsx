import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  useGetList,
  useGetOne,
  useDataProvider,
  useNotify,
} from "ra-core";
import {
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
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
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { FormInstance } from "@/modules/forms/types";
import { resolveShareUrl } from "@/modules/forms/share/formLinkUtils";
import { PROJECT_RESOURCES_SLUG } from "@/modules/deals/projectResourceConstants";
import type { ResourceRequestScope } from "@/modules/deals/projectResourceRequestScope";
import { mailtoHref } from "@/lib/linking";
import { useMessagesQuickAccessOptional } from "@/modules/messages/messagesQuickAccessContext";
import {
  contactHasSmsPhone,
  resolveClientSmsPhone,
} from "@/modules/messages/messageContactUtils";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";

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
  const messagesQuickAccess = useMessagesQuickAccessOptional();
  const { smsEnabled } = useMessagingEnabled();
  const canSendMessages = useMemberCapability("messaging.send");
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
  const resolvedContactId =
    contactId != null && Number.isFinite(Number(contactId))
      ? Number(contactId)
      : null;

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: resolvedContactId as number },
    { enabled: open && resolvedContactId != null },
  );

  const generateLink = useMutation({
    mutationFn: async () => {
      if (!formInstance)
        throw new Error("Project Resources form is not configured");
      return dataProvider.generateFormToken({
        formInstanceId: Number(formInstance.id),
        dealId: Number(dealId),
        companyId: companyId != null ? Number(companyId) : null,
        contactId: contactId != null ? Number(contactId) : null,
        expiresInDays: 30,
        maxUses: null,
        baseUrl: window.location.origin,
        requestScope: requestScope ?? null,
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
    return resolveShareUrl(generateLink.data, window.location.origin);
  }, [generateLink.data]);

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

  const smsBody = useMemo(() => {
    if (!formUrl) return "";
    const first =
      contact?.first_name?.trim() ||
      clientName?.trim().split(/\s+/)[0] ||
      "";
    return `Hi${first ? ` ${first}` : ""}, please upload your project photos here: ${formUrl}`;
  }, [formUrl, contact?.first_name, clientName]);

  const canTextClient = Boolean(
    formUrl &&
      contact &&
      contactHasSmsPhone(contact) &&
      resolveClientSmsPhone(contact) &&
      smsEnabled &&
      canSendMessages &&
      messagesQuickAccess,
  );

  const handleTextClient = async () => {
    if (!contact || !messagesQuickAccess || !smsBody) return;
    onClose();
    await messagesQuickAccess.openSms(contact, dealId, {
      initialBody: smsBody,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request files from client</DialogTitle>
          <DialogDescription>
            {requestScope?.presetServices?.length
              ? `This link asks for photos of ${requestScope.presetServices.length} service${requestScope.presetServices.length === 1 ? "" : "s"} already on this project — no need to re-enter the service list.`
              : requestScope?.sections?.some((entry) =>
                    entry.startsWith("service:"),
                  )
                ? "This link asks for logos, team photos, and service photos already defined on this project — no need to re-enter the service list."
                : requestScope
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
              <IconButton
                variant="secondary"
                disabled={!formUrl}
                onClick={() => void handleCopy()}
                aria-label="Copy link"
              >
                <Copy className="size-4" />
                <span className="sr-only">Copy link</span>
              </IconButton>
              <IconButton
                variant="secondary"
                disabled={!formUrl}
                asChild
                aria-label="Open link"
              >
                <a href={formUrl || "#"} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  <span className="sr-only">Open link</span>
                </a>
              </IconButton>
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

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={!canTextClient || messagesQuickAccess?.isOpening}
            onClick={() => void handleTextClient()}
          >
            {messagesQuickAccess?.isOpening ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageSquare className="size-4" />
            )}
            Text client
          </Button>
          {emailHref ? (
            <Button type="button" asChild>
              <a href={emailHref}>
                <Mail className="size-4" />
                Email client
              </a>
            </Button>
          ) : (
            <Button type="button" disabled>
              <Mail className="size-4" />
              Email client
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
