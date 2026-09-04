import { useEffect, useMemo, useState } from "react";
import { useGetList, useDataProvider, useNotify, useUpdate } from "ra-core";
import { useMutation } from "@tanstack/react-query";
import { Copy, ExternalLink, Mail } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormInstance } from "@/modules/forms/types";
import {
  getWebsiteBriefSendTypeLabel,
  WEBSITE_BRIEF_SEND_TYPE_CHOICES,
  type WebsiteBriefSendType,
} from "@/modules/deals/websiteBriefSendOptions";
import {
  ESSENTIAL_BRIEF_REQUEST,
  FULL_BRIEF_REQUEST,
  getBriefScopeSummary,
  isEssentialBriefScope,
  isFullBriefScope,
  type BriefRequestScope,
} from "@/modules/deals/projectBriefRequestScope";
import { mailtoHref } from "@/lib/linking";
import { resolveShareUrl } from "@/modules/forms/share/formLinkUtils";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { LbsDeal } from "@/modules/types";

type SendProjectWebFormDialogProps = {
  open: boolean;
  onClose: () => void;
  dealId?: string | number | null;
  companyId?: string | number | null;
  contactId?: string | number | null;
  clientEmail?: string;
  clientName?: string;
  projectName?: string;
  projectType?: string | null;
  dealRecord?: LbsDeal | null;
  requestScope?: BriefRequestScope;
  onLinkGenerated?: () => void;
};

const normalizeBriefSendType = (
  value?: string | null,
): WebsiteBriefSendType => {
  const match = WEBSITE_BRIEF_SEND_TYPE_CHOICES.find(
    (entry) => entry.value === value,
  );
  return match?.value ?? "website";
};

type BriefPack = "essential" | "full";

export const SendProjectWebFormDialog = ({
  open,
  onClose,
  dealId,
  companyId,
  contactId,
  clientEmail,
  clientName,
  projectName,
  projectType,
  dealRecord,
  requestScope,
  onLinkGenerated,
}: SendProjectWebFormDialogProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [update] = useUpdate();
  const { data: forms = [] } = useGetList<FormInstance>(
    "form_instances",
    {
      filter: { "is_active@eq": true },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "name", order: "ASC" },
    },
    { enabled: open, staleTime: 60_000 },
  );

  const briefForms = useMemo(
    () =>
      forms.filter(
        (form) =>
          form.slug === "project_brief" ||
          form.slug === "website-intake" ||
          form.name.toLowerCase().includes("brief"),
      ),
    [forms],
  );

  const [selectedFormId, setSelectedFormId] = useState("");
  const [briefProjectType, setBriefProjectType] =
    useState<WebsiteBriefSendType>(normalizeBriefSendType(projectType));
  const [briefPack, setBriefPack] = useState<BriefPack>("essential");
  const [copied, setCopied] = useState(false);
  const [formUrl, setFormUrl] = useState("");

  const isSingleSection = Boolean(
    requestScope && requestScope.sections.length === 1,
  );

  const effectiveScope = useMemo((): BriefRequestScope => {
    if (isSingleSection && requestScope) return requestScope;
    if (briefPack === "full") return FULL_BRIEF_REQUEST;
    return ESSENTIAL_BRIEF_REQUEST;
  }, [briefPack, isSingleSection, requestScope]);

  const scopeSummary = useMemo(
    () => getBriefScopeSummary(effectiveScope),
    [effectiveScope],
  );

  useEffect(() => {
    if (!open) return;
    setBriefProjectType(normalizeBriefSendType(projectType));
    setCopied(false);
    setFormUrl("");
    if (requestScope && isFullBriefScope(requestScope.sections)) {
      setBriefPack("full");
    } else if (
      !requestScope ||
      isEssentialBriefScope(requestScope.sections) ||
      requestScope.sections.length !== 1
    ) {
      setBriefPack("essential");
    }
  }, [open, projectType, requestScope]);

  useEffect(() => {
    const pool = briefForms.length > 0 ? briefForms : forms;
    if (!pool.length || selectedFormId) return;
    const preferred =
      pool.find((form) => form.slug === "project_brief") ?? pool[0];
    setSelectedFormId(String(preferred.id));
  }, [briefForms, forms, selectedFormId]);

  const selectedForm =
    (briefForms.length > 0 ? briefForms : forms).find(
      (form) => String(form.id) === selectedFormId,
    ) ??
    briefForms[0] ??
    forms[0];

  const persistBriefType = async () => {
    if (!dealId || !dealRecord || briefProjectType === projectType) return;
    await update(
      "deals",
      {
        id: dealId,
        data: { project_type: briefProjectType },
        previousData: dealRecord,
      },
      { onError: () => undefined },
    );
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      await persistBriefType();
      return dataProvider.generateFormToken({
        formInstanceId: Number(selectedForm.id),
        companyId: companyId != null ? Number(companyId) : null,
        contactId: contactId != null ? Number(contactId) : null,
        dealId: dealId != null ? Number(dealId) : null,
        expiresInDays: 30,
        maxUses: 5,
        baseUrl: window.location.origin,
        requestScope: effectiveScope,
      });
    },
    onSuccess: (result) => {
      setFormUrl(resolveShareUrl(result, window.location.origin));
      onLinkGenerated?.();
    },
    onError: () => {
      notify("Could not generate form link", { type: "error" });
    },
  });

  useEffect(() => {
    if (!open || !selectedForm?.id) return;
    setFormUrl("");
    generateMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerate when link context changes
  }, [
    open,
    selectedFormId,
    briefProjectType,
    briefPack,
    dealId,
    companyId,
    contactId,
    effectiveScope,
  ]);

  const handleCopy = async () => {
    if (!formUrl) return;
    await navigator.clipboard.writeText(formUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const briefTypeLabel = getWebsiteBriefSendTypeLabel(briefProjectType);

  const emailHref = useMemo(() => {
    if (!formUrl || !clientEmail?.trim()) return "";
    const trimmed = clientEmail.trim().toLowerCase();
    if (!mailtoHref(trimmed)) return "";
    const subject = encodeURIComponent(
      projectName ? `${scopeSummary} — ${projectName}` : `${scopeSummary} form`,
    );
    const body = encodeURIComponent(
      `Hi${clientName ? ` ${clientName}` : ""},\n\nPlease complete this brief for your project${projectName ? ` (${projectName})` : ""}:\n\n${scopeSummary}\n\n${formUrl}\n\nFields we already have will appear pre-filled — just confirm or update them.\n\nThank you!`,
    );
    return `mailto:${trimmed}?subject=${subject}&body=${body}`;
  }, [formUrl, clientEmail, clientName, projectName, scopeSummary]);

  const formPool = briefForms.length > 0 ? briefForms : forms;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isSingleSection ? "Request brief section" : "Send project brief"}
          </DialogTitle>
          <DialogDescription>
            {isSingleSection
              ? `This link asks the client only for: ${scopeSummary}. Their answers merge into the project brief.`
              : dealId
                ? `Share a ${briefPack === "essential" ? "quick" : "full"} brief link. CRM data is pre-filled for the client.`
                : "Choose the form and brief pack to share with your client."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {!isSingleSection ? (
            <>
              <div className="space-y-2">
                <Label>Brief pack</Label>
                <Select
                  value={briefPack}
                  onValueChange={(value) => setBriefPack(value as BriefPack)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pack" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essential">
                      Quick website brief (5 steps)
                    </SelectItem>
                    <SelectItem value="full">Full project brief</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Default is the quick pack. Use full only when you need every
                  section.
                </p>
              </div>

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
                    {formPool.map((form) => (
                      <SelectItem key={form.id} value={String(form.id)}>
                        {form.name}
                        {form.slug === "project_brief"
                          ? " · Project brief"
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Project type</Label>
                <Select
                  value={briefProjectType}
                  onValueChange={(value) =>
                    setBriefProjectType(value as WebsiteBriefSendType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select brief type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEBSITE_BRIEF_SEND_TYPE_CHOICES.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Set when generating the link — the client does not choose this
                  again on the form ({briefTypeLabel}).
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium">Sections: </span>
              {scopeSummary}
            </div>
          )}

          <div className="space-y-2">
            <Label>Link for client</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={
                  generateMutation.isPending ? "Generating link…" : formUrl
                }
              />
              <IconButton
                variant="secondary"
                disabled={!formUrl}
                onClick={handleCopy}
                aria-label="Copy link"
              >
                <Copy className="size-4" />
                <span className="sr-only">Copy link</span>
              </IconButton>
              {formUrl ? (
                <IconButton aria-label="Open link" variant="secondary" asChild>
                  <a href={formUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    <span className="sr-only">Open link</span>
                  </a>
                </IconButton>
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
              <Button type="button" variant="secondary" asChild>
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
