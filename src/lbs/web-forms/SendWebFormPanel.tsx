import { useMemo, useState } from "react";
import { useGetList, useGetOne } from "ra-core";
import { Copy, ExternalLink, Mail } from "lucide-react";
import type { Deal } from "@/components/atomic-crm/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Form } from "@/lbs/types";
import {
  buildWebFormPreviewUrl,
  buildWebFormShareUrl,
  isProjectScopedWebForm,
} from "@/lbs/web-forms/webFormLinks";
import {
  appendWebFormEmbedParam,
  buildWebFormIframeSnippet,
  buildWebFormScriptSnippet,
} from "@/lbs/web-forms/webFormEmbed";

const NO_PROJECT = "none";

const getDealLabel = (deal: Deal) => deal.name?.trim() || `Project #${deal.id}`;

export const SendWebFormPanel = ({ form }: { form: Form }) => {
  const requiresProject = isProjectScopedWebForm(form.slug);
  const [dealId, setDealId] = useState(requiresProject ? "" : NO_PROJECT);
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState<"iframe" | "script" | null>(
    null,
  );

  const { data: deals = [], isPending: isDealsPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "name", order: "ASC" },
    },
    { staleTime: 60_000 },
  );

  const selectedDealId = !dealId || dealId === NO_PROJECT ? null : dealId;

  const { data: deal } = useGetOne<Deal>(
    "deals",
    { id: selectedDealId! },
    { enabled: selectedDealId != null },
  );

  const shareParams = useMemo(
    () => ({
      dealId: selectedDealId,
      companyId: deal?.company_id ?? null,
      contactId: deal?.contact_id ?? null,
    }),
    [deal?.company_id, deal?.contact_id, selectedDealId],
  );

  const formUrl = useMemo(
    () => buildWebFormShareUrl(window.location.origin, form.slug, shareParams),
    [form.slug, shareParams],
  );

  const previewUrl = useMemo(
    () => buildWebFormPreviewUrl(window.location.origin, form.slug),
    [form.slug],
  );

  const embedUrl = useMemo(() => {
    const base = formUrl || previewUrl;
    return base ? appendWebFormEmbedParam(base) : "";
  }, [formUrl, previewUrl]);

  const iframeSnippet = useMemo(
    () => (embedUrl ? buildWebFormIframeSnippet(embedUrl, form.name) : ""),
    [embedUrl, form.name],
  );

  const scriptSnippet = useMemo(
    () =>
      embedUrl && !requiresProject
        ? buildWebFormScriptSnippet(
            window.location.origin,
            form.slug,
            form.name,
          )
        : "",
    [embedUrl, form.name, form.slug, requiresProject],
  );

  const handleCopy = async () => {
    if (!formUrl) return;
    await navigator.clipboard.writeText(formUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEmbed = async (kind: "iframe" | "script") => {
    const value = kind === "iframe" ? iframeSnippet : scriptSnippet;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedEmbed(kind);
    window.setTimeout(() => setCopiedEmbed(null), 2000);
  };

  const emailHref = useMemo(() => {
    if (!formUrl) return "";
    const subject = encodeURIComponent(form.name);
    const body = encodeURIComponent(
      `Hi,\n\nPlease use this link:\n\n${formUrl}\n\nThank you!`,
    );
    return `mailto:?subject=${subject}&body=${body}`;
  }, [formUrl, form.name]);

  return (
    <div className="space-y-4">
      {requiresProject ? (
        <p className="text-sm text-muted-foreground">
          Select a project to generate a client upload link. Files are saved
          under that project&apos;s Resources tab.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Optionally link the form to a project so submissions update the
          project brief. Without a project, the link works for new client
          intake.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor={`web-form-project-${form.id}`}>
          {requiresProject ? "Project" : "Project (optional)"}
        </Label>
        <Select
          value={dealId || undefined}
          onValueChange={setDealId}
          disabled={isDealsPending}
        >
          <SelectTrigger id={`web-form-project-${form.id}`}>
            <SelectValue
              placeholder={
                requiresProject ? "Select a project" : "No project linked"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {!requiresProject ? (
              <SelectItem value={NO_PROJECT}>No project linked</SelectItem>
            ) : null}
            {deals.map((entry) => (
              <SelectItem key={entry.id} value={String(entry.id)}>
                {getDealLabel(entry)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Client link</Label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={formUrl}
            placeholder={requiresProject ? "Select a project first" : ""}
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

      <div className="flex flex-wrap gap-2">
        {formUrl ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={emailHref}>
              <Mail className="size-4" />
              Email link
            </a>
          </Button>
        ) : null}
        {!requiresProject && previewUrl ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Preview generic form
            </a>
          </Button>
        ) : null}
      </div>

      {embedUrl ? (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">Embed on your website</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste this on lbs.com or any site. Submissions still land in Web
              Forms.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`web-form-embed-url-${form.id}`}>Embed URL</Label>
            <Input
              id={`web-form-embed-url-${form.id}`}
              readOnly
              value={embedUrl}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`web-form-iframe-snippet-${form.id}`}>
              Iframe code
            </Label>
            <textarea
              id={`web-form-iframe-snippet-${form.id}`}
              readOnly
              rows={6}
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
              value={iframeSnippet}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopyEmbed("iframe")}
            >
              <Copy className="size-4" />
              {copiedEmbed === "iframe"
                ? "Iframe code copied"
                : "Copy iframe code"}
            </Button>
          </div>

          {scriptSnippet ? (
            <div className="space-y-2">
              <Label htmlFor={`web-form-script-snippet-${form.id}`}>
                Script embed
              </Label>
              <textarea
                id={`web-form-script-snippet-${form.id}`}
                readOnly
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
                value={scriptSnippet}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopyEmbed("script")}
              >
                <Copy className="size-4" />
                {copiedEmbed === "script"
                  ? "Script copied"
                  : "Copy script embed"}
              </Button>
            </div>
          ) : null}

          <Button type="button" variant="outline" size="sm" asChild>
            <a href={embedUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Preview embed
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
};
