import type { ReactNode } from "react";
import { Download, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { daysUntilValidUntil } from "@/modules/proposals/ProposalSendExpiryDialog";
import { ProposalBillingOnAcceptHint } from "@/modules/proposals/ProposalBillingOnAcceptHint";
import type { ProposalDocumentNavSection } from "@/modules/proposals/document/proposalDocumentSections";
import type { Proposal } from "@/modules/types";

const formatDisplayDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const ProposalDocumentSidebar = ({
  proposal,
  sections,
  activeId,
  onSectionClick,
  downloadPdfLabel = "Download PDF",
  onDownloadPdf,
  isExportingPdf = false,
  languageToggle,
  onAddSection,
  addSectionLabel = "Add section",
}: {
  proposal: Proposal;
  sections: ProposalDocumentNavSection[];
  activeId: string;
  onSectionClick: (sectionId: string) => void;
  downloadPdfLabel?: string;
  onDownloadPdf?: () => void;
  isExportingPdf?: boolean;
  /** Shown above Download PDF (e.g. EN / Español). */
  languageToggle?: ReactNode;
  onAddSection?: () => void;
  addSectionLabel?: string;
}) => {
  const daysLeft = daysUntilValidUntil(proposal.valid_until);
  const isActive =
    proposal.status !== "accepted" &&
    proposal.status !== "rejected" &&
    (daysLeft == null || daysLeft >= 0);

  return (
    <aside className="proposal-formal-sidebar flex h-full max-h-full w-56 shrink-0 flex-col overflow-hidden border-r border-border print:hidden">
      <div className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            L
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold text-foreground">LBS</p>
            <p className="text-[11px] text-muted-foreground">
              Latinos Business Support
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Proposal
        </p>
        <nav className="space-y-0.5">
          {sections.map((section, index) => {
            const isCurrent = activeId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionClick(section.id)}
                className="pf-nav-link"
                data-active={isCurrent ? "true" : "false"}
              >
                <span className="pf-nav-num">{index + 1}</span>
                <span className="pf-nav-label">{section.label}</span>
              </button>
            );
          })}
        </nav>
        {onAddSection ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3 w-full"
            onClick={onAddSection}
          >
            <Plus className="size-4" />
            {addSectionLabel}
          </Button>
        ) : null}
      </div>

      <div className="shrink-0 space-y-3 border-t border-border bg-background px-4 py-3">
        {languageToggle ? <div className="w-full">{languageToggle}</div> : null}
        {onDownloadPdf ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onDownloadPdf}
            disabled={isExportingPdf}
          >
            {isExportingPdf ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {downloadPdfLabel}
          </Button>
        ) : null}

        <div className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
          <ProposalBillingOnAcceptHint
            proposal={proposal}
            variant="inline"
            className="mb-2 text-[11px]"
          />
          {proposal.proposal_number ? (
            <p>
              Proposal{" "}
              <span className="font-medium text-foreground">
                #{proposal.proposal_number}
              </span>
            </p>
          ) : null}
          {proposal.valid_until ? (
            <p>
              Valid until{" "}
              <span className="font-medium text-foreground">
                {formatDisplayDate(proposal.valid_until)}
              </span>
            </p>
          ) : null}
          {daysLeft != null && isActive ? (
            <p
              className={cn(
                "flex items-center gap-1.5 pt-0.5 font-medium",
                daysLeft >= 0 ? "text-warning" : "text-destructive",
              )}
            >
              <span
                className="size-1.5 shrink-0 rounded-full bg-amber-500"
                aria-hidden
              />
              Active
              {daysLeft >= 0
                ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
                : ` · expired ${Math.abs(daysLeft)}d ago`}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
};
