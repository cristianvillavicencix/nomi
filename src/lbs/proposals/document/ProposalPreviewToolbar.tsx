import { ArrowLeft, Eye, FileText, Plus, Save } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProposalTemplate } from "@/lbs/proposals/document/proposalDocumentTypes";

export const ProposalPreviewToolbar = ({
  proposalId,
  templates,
  selectedTemplateId,
  onTemplateChange,
  onSaveTemplate,
  onSaveContent,
  onAddSection,
  isSaving,
  sendActions,
  languageToggle,
}: {
  proposalId: string | number;
  templates: ProposalTemplate[];
  selectedTemplateId: string;
  onTemplateChange: (templateId: string) => void;
  onSaveTemplate: () => void;
  onSaveContent: () => void;
  onAddSection?: () => void;
  isSaving?: boolean;
  sendActions?: ReactNode;
  languageToggle?: ReactNode;
}) => (
  <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
    <Button variant="ghost" size="sm" asChild>
      <Link to={`/proposals/${proposalId}/edit`}>
        <ArrowLeft className="size-4" />
        Back to builder
      </Link>
    </Button>

    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground shrink-0">Template</span>
      <Select value={selectedTemplateId} onValueChange={onTemplateChange}>
        <SelectTrigger className="h-8 w-[min(100%,220px)]">
          <SelectValue placeholder="Choose template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={String(template.id)} value={String(template.id)}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {languageToggle}

    {onAddSection ? (
      <Button type="button" variant="outline" size="sm" onClick={onAddSection}>
        <Plus className="size-4" />
        Add section
      </Button>
    ) : null}

    <Button type="button" variant="outline" size="sm" asChild>
      <Link
        to={`/proposals/${proposalId}/client-preview`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Eye className="size-4" />
        Preview as client
      </Link>
    </Button>

    <Button type="button" variant="outline" size="sm" onClick={onSaveTemplate}>
      <FileText className="size-4" />
      Save as template
    </Button>

    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isSaving}
      onClick={onSaveContent}
    >
      <Save className="size-4" />
      Save
    </Button>

    {sendActions}
  </div>
);
