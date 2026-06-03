import { ArrowLeft, Eye, FileText, Save } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

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
      <p className="border-b border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        {unsavedHint}
      </p>
    ) : null}
  <div className="flex flex-wrap items-center gap-2 px-3 py-2">
    <Button variant="ghost" size="sm" asChild>
      <Link to={`/proposals/${proposalId}/edit`}>
        <ArrowLeft className="size-4" />
        Back to builder
      </Link>
    </Button>

    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Deck:</span> {deckLabel}
      <span className="hidden sm:inline">
        {" "}
        — from your builder package
      </span>
    </p>

    {languageToggle}

    {variablesHelp}

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
  </div>
);
