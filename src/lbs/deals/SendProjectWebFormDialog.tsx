import { useEffect, useMemo, useState } from "react";
import { useGetList, useDataProvider } from "ra-core";
import { useMutation } from "@tanstack/react-query";
import { Copy, ExternalLink, Mail } from "lucide-react";
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
import type { FormInstance } from "@/lbs/forms-v2/types";
import { mailtoHref } from "@/lib/linking";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

type SendProjectWebFormDialogProps = {
  open: boolean;
  onClose: () => void;
  dealId?: string | number | null;
  companyId?: string | number | null;
  contactId?: string | number | null;
  clientEmail?: string;
  clientName?: string;
  projectName?: string;
  onLinkGenerated?: () => void;
};

export const SendProjectWebFormDialog = ({
  open,
  onClose,
  dealId,
  companyId,
  contactId,
  clientEmail,
  clientName,
  projectName,
  onLinkGenerated,
}: SendProjectWebFormDialogProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: forms = [] } = useGetList<FormInstance>(
    "form_instances",
    {
      filter: { "is_active@eq": true },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "name", order: "ASC" },
    },
    { enabled: open, staleTime: 60_000 },
  );

  const [selectedFormId, setSelectedFormId] = useState("");
  const [copied, setCopied] = useState(false);
  const [formUrl, setFormUrl] = useState("");

  useEffect(() => {
    if (!forms.length || selectedFormId) return;
    const preferred =
      forms.find((form) => form.slug === "project_brief") ?? forms[0];
    setSelectedFormId(String(preferred.id));
  }, [forms, selectedFormId]);

  const selectedForm =
    forms.find((form) => String(form.id) === selectedFormId) ?? forms[0];

  const generateMutation = useMutation({
    mutationFn: () =>
      dataProvider.generateFormToken({
        formInstanceId: Number(selectedForm.id),
        companyId: companyId != null ? Number(companyId) : null,
        contactId: contactId != null ? Number(contactId) : null,
        dealId: dealId != null ? Number(dealId) : null,
        expiresInDays: 30,
        maxUses: 1,
      }),
    onSuccess: (result) => {
      setFormUrl(result.url);
      onLinkGenerated?.();
    },
  });

  useEffect(() => {
    if (!open || !selectedForm?.id) return;
    setFormUrl("");
    generateMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerate when link context changes
  }, [open, selectedFormId, dealId, companyId, contactId]);

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
      projectName ? `Project brief for ${projectName}` : "Project intake form",
    );
    const body = encodeURIComponent(
      `Hi${clientName ? ` ${clientName}` : ""},\n\nPlease fill out this form so we can start your project${projectName ? ` (${projectName})` : ""}:\n\n${formUrl}\n\nThank you!`,
    );
    return `mailto:${trimmed}?subject=${subject}&body=${body}`;
  }, [formUrl, clientEmail, clientName, projectName]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send web form</DialogTitle>
          <DialogDescription>
            {dealId
              ? "Share this secure link with your client. When they submit, their answers update this project's brief."
              : "Share this secure link with your client."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Form</Label>
            <Select
              value={selectedFormId || undefined}
              onValueChange={setSelectedFormId}
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

          <div className="space-y-2">
            <Label>Link for client</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={
                  generateMutation.isPending ? "Generating link…" : formUrl
                }
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!formUrl}
                onClick={handleCopy}
              >
                <Copy className="size-4" />
                <span className="sr-only">Copy link</span>
              </Button>
              {formUrl ? (
                <Button type="button" variant="outline" size="icon" asChild>
                  <a href={formUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    <span className="sr-only">Open link</span>
                  </a>
                </Button>
              ) : null}
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
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
