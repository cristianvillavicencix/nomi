import { ArrowLeft, Eye, FileText, Save } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ToolbarLabel } from "@/components/atomic-crm/layout/PageActions";

export const ProposalPreviewToolbar = ({
  proposalId,
  deckLabel,
  onSaveTemplate,
  onSaveContent,
  isSaving,
  sendActions,
  languageToggle,
  variablesHelp,
  unsavedHint,
}: {
  proposalId: string | number;
  /** Deck type inferred from the builder package (read-only). */
  deckLabel: string;
  onSaveTemplate: () => void;
  onSaveContent: () => void;
  isSaving?: boolean;
  sendActions?: ReactNode;
  languageToggle?: ReactNode;
  variablesHelp?: ReactNode;
  unsavedHint?: string;
}) => (
  <div className="border-b bg-card">
    {unsavedHint ? (
      <p className="border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
        {unsavedHint}
      </p>
    ) : null}
    <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:overflow-x-auto">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/proposals/${proposalId}/edit`} aria-label="Back to builder">
          <ArrowLeft className="size-4" />
          <ToolbarLabel>Back to builder</ToolbarLabel>
        </Link>
      </Button>

      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Deck:</span> {deckLabel}
        <span className="hidden sm:inline"> — from your builder package</span>
      </p>

      {languageToggle}

      {variablesHelp}

      <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:flex-nowrap sm:items-center">
        <Button type="button" variant="secondary" size="sm" asChild>
          <Link
            to={`/proposals/${proposalId}/client-preview`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Preview as client"
          >
            <Eye className="size-4" />
            <ToolbarLabel>Preview as client</ToolbarLabel>
          </Link>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onSaveTemplate}
          aria-label="Save as template"
        >
          <FileText className="size-4" />
          <ToolbarLabel>Save as template</ToolbarLabel>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isSaving}
          onClick={onSaveContent}
          aria-label="Save"
        >
          <Save className="size-4" />
          <ToolbarLabel priority="primary">Save</ToolbarLabel>
        </Button>

        {sendActions}
      </div>
    </div>
  </div>
);
