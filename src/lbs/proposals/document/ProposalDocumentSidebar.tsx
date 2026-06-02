import { cn } from "@/lib/utils";
import { daysUntilValidUntil } from "@/lbs/proposals/ProposalSendExpiryDialog";
import type { ProposalDocumentNavSection } from "@/lbs/proposals/document/proposalDocumentSections";
import type { Proposal } from "@/lbs/types";

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
}: {
  proposal: Proposal;
  sections: ProposalDocumentNavSection[];
  activeId: string;
  onSectionClick: (sectionId: string) => void;
}) => {
  const daysLeft = daysUntilValidUntil(proposal.valid_until);
  const isActive =
    proposal.status !== "accepted" &&
    proposal.status !== "rejected" &&
    (daysLeft == null || daysLeft >= 0);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r bg-card print:hidden">
      <div className="shrink-0 border-b px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            L
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold">LBS</p>
            <p className="text-[11px] text-muted-foreground">
              Latinos Business Support
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Propuesta
        </p>
        <nav className="space-y-1">
          {sections.map((section, index) => {
            const isCurrent = activeId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionClick(section.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                  isCurrent
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 space-y-1 border-t px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
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
          <p className="flex items-center gap-1.5 pt-0.5 font-medium text-amber-600 dark:text-amber-400">
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
    </aside>
  );
};
