import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useGetList, useDataProvider, useNotify } from "ra-core";
import { Copy, Loader2, Mail, MessageSquare } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { FormInstance } from "@/lbs/forms-v2/types";
import type { SendFormContext } from "@/lbs/forms-v2/share/sendFormTypes";
import { useSendFormRecipient } from "@/lbs/forms-v2/share/useSendFormRecipient";
import { useSendClientSms } from "@/lbs/messages/useClientSms";
import { mailtoHref } from "@/lib/linking";
import { buildFormShortUrl } from "@/lbs/forms-v2/share/formLinkUtils";

type SendFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: SendFormContext;
};

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

export const SendFormDialog = ({
  open,
  onOpenChange,
  context,
}: SendFormDialogProps) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const sendClientSms = useSendClientSms();
  const recipient = useSendFormRecipient(context);

  const { data: forms = [] } = useGetList<FormInstance>(
    "form_instances",
    {
      filter: { "is_active@eq": true },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
    },
    { enabled: open, staleTime: 60_000 },
  );

  const [selectedFormId, setSelectedFormId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [maxUses, setMaxUses] = useState("1");
  const [customMessage, setCustomMessage] = useState(
    "Please fill out this form when you have a moment:",
  );
  const [generatedUrl, setGeneratedUrl] = useState("");

  useEffect(() => {
    if (!open || !forms.length || selectedFormId) return;
    if (context.form_instance_id) {
      setSelectedFormId(String(context.form_instance_id));
      return;
    }
    const preferred =
      context.type === "deal"
        ? (forms.find((form) => form.slug === "project_brief") ?? forms[0])
        : forms[0];
    setSelectedFormId(String(preferred.id));
  }, [context.form_instance_id, context.type, forms, open, selectedFormId]);

  useEffect(() => {
    if (!open) {
      setGeneratedUrl("");
    }
  }, [open]);

  const selectedForm =
    forms.find((form) => String(form.id) === selectedFormId) ?? forms[0];

  const previewMessage = useMemo(() => {
    const url =
      generatedUrl ||
      buildFormShortUrl(window.location.origin, "example123");
    return `${customMessage.trim()}\n\n${url}`.trim();
  }, [customMessage, generatedUrl]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedForm?.id) throw new Error("Select a form");
      return dataProvider.generateFormToken({
        formInstanceId: Number(selectedForm.id),
        contactId: recipient.contactId ?? null,
        companyId: recipient.companyId ?? null,
        dealId: recipient.dealId ?? null,
        expiresInDays: Number(expiresInDays),
        maxUses: maxUses === "unlimited" ? null : Number(maxUses),
      });
    },
    onSuccess: (result) => {
      setGeneratedUrl(resolveShareUrl(result, window.location.origin));
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to generate link", {
        type: "error",
      });
    },
  });

  const ensureLink = async () => {
    if (generatedUrl) return generatedUrl;
    const result = await generateMutation.mutateAsync();
    const url = resolveShareUrl(result, window.location.origin);
    setGeneratedUrl(url);
    return url;
  };

  const handleCopy = async () => {
    const url = await ensureLink();
    await navigator.clipboard.writeText(url);
    notify("Link copied", { type: "info" });
  };

  const handleEmail = async () => {
    const email = recipient.recipientEmail?.trim().toLowerCase();
    if (!email || !mailtoHref(email)) {
      notify("No email address available for this recipient", {
        type: "warning",
      });
      return;
    }
    const url = await ensureLink();
    const subject = encodeURIComponent(`Form: ${selectedForm?.name ?? "Form"}`);
    const body = encodeURIComponent(`${customMessage.trim()}\n\n${url}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handleSms = async () => {
    if (!recipient.contactId) {
      notify("No contact phone available for SMS", { type: "warning" });
      return;
    }
    const url = await ensureLink();
    const body = `${customMessage.trim()}\n${url}`.trim();
    await sendClientSms({
      contactId: recipient.contactId,
      dealId: recipient.dealId,
      conversationId: recipient.conversationId,
      body,
    });
    notify("Form link sent via SMS", { type: "info" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{recipient.dialogTitle}</DialogTitle>
          <DialogDescription>
            Generate a secure link and share it by email, SMS, or copy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Form</Label>
            <Select
              value={selectedFormId || undefined}
              onValueChange={(value) => {
                setSelectedFormId(value);
                setGeneratedUrl("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a form" />
              </SelectTrigger>
              <SelectContent>
                {forms.map((form) => (
                  <SelectItem key={form.id} value={String(form.id)}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Expires in</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max uses</Label>
              <Select value={maxUses} onValueChange={setMaxUses}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 submission</SelectItem>
                  <SelectItem value="5">5 submissions</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-form-message">Message</Label>
            <Textarea
              id="send-form-message"
              value={customMessage}
              onChange={(event) => setCustomMessage(event.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
              {previewMessage}
            </div>
          </div>

          {generatedUrl ? (
            <div className="space-y-2">
              <Label>Generated link</Label>
              <Input readOnly value={generatedUrl} />
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={generateMutation.isPending}
              onClick={() => void handleCopy()}
            >
              {generateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy link
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={generateMutation.isPending || !recipient.recipientEmail}
              onClick={() => void handleEmail()}
            >
              <Mail className="size-4" />
              Email
            </Button>
            <Button
              type="button"
              disabled={generateMutation.isPending || !recipient.contactId}
              onClick={() => void handleSms()}
            >
              <MessageSquare className="size-4" />
              Send SMS
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
