import { useState } from "react";
import { useGetIdentity, useNotify, useRefresh, useUpdate } from "ra-core";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  approveBriefSection,
  getBriefSectionApproval,
  requestBriefSectionRevision,
  type WebsiteBriefWithApprovals,
} from "@/lbs/deals/websiteBriefSchema";
import type { LbsDeal } from "@/lbs/types";

export const getBriefApprovalLabel = (status?: string | null) => {
  if (status === "approved") return "Approved";
  if (status === "revision_requested") return "Revision";
  if (status === "client_review") return "Review";
  return "Pending";
};

export const briefApprovalPillClass = (status?: string | null) => {
  if (status === "revision_requested") {
    return "border-amber-400/60 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60";
  }
  if (status === "approved") {
    return "border-emerald-400/60 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-950/40 dark:text-emerald-100";
  }
  if (status === "client_review") {
    return "border-sky-400/60 bg-sky-50 text-sky-900 hover:bg-sky-100 dark:border-sky-600/50 dark:bg-sky-950/40 dark:text-sky-100";
  }
  return "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted";
};

const ApprovalPill = ({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
      briefApprovalPillClass(status),
      className,
    )}
  >
    {getBriefApprovalLabel(status)}
  </span>
);

type BriefSectionApprovalActionsProps = {
  record: LbsDeal;
  sectionId: string;
  sectionTitle?: string;
  variant?: "bar" | "menu";
  onUpdated?: () => void;
};

export const BriefSectionApprovalActions = ({
  record,
  sectionId,
  sectionTitle,
  variant = "bar",
  onUpdated,
}: BriefSectionApprovalActionsProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();
  const [update, { isPending }] = useUpdate();
  const canEdit = useMemberCapability("crm.pipeline.edit");
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");

  const brief = (record.website_brief ?? {}) as WebsiteBriefWithApprovals;
  const approval = getBriefSectionApproval(brief, sectionId);
  const status = approval?.status;

  const persistBrief = async (nextBrief: WebsiteBriefWithApprovals) => {
    await update(
      "deals",
      {
        id: record.id,
        data: { website_brief: nextBrief },
        previousData: record,
      },
      { returnPromise: true },
    );
    refresh();
    onUpdated?.();
  };

  const handleApprove = async () => {
    try {
      const memberId =
        identity?.id != null && Number.isFinite(Number(identity.id))
          ? Number(identity.id)
          : null;
      await persistBrief(approveBriefSection(brief, sectionId, memberId));
      notify("Approved", { type: "info" });
    } catch {
      notify("Could not save approval", { type: "error" });
    }
  };

  const handleRequestRevision = async () => {
    const notes = revisionNotes.trim();
    if (!notes) {
      notify("Add notes", { type: "warning" });
      return;
    }
    try {
      await persistBrief(requestBriefSectionRevision(brief, sectionId, notes));
      setRevisionOpen(false);
      setRevisionNotes("");
      notify("Revision", { type: "info" });
    } catch {
      notify("Could not save revision", { type: "error" });
    }
  };

  const handleClearApproval = async () => {
    const nextApprovals = (brief._approvals ?? []).filter(
      (entry) => entry.section_id !== sectionId,
    );
    try {
      await persistBrief({
        ...brief,
        _approvals: nextApprovals,
      });
      notify("Pending", { type: "info" });
    } catch {
      notify("Could not reset status", { type: "error" });
    }
  };

  const revisionDialog = (
    <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revision</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`revision-notes-${sectionId}`}>Notes</Label>
          <Textarea
            id={`revision-notes-${sectionId}`}
            value={revisionNotes}
            onChange={(event) => setRevisionNotes(event.target.value)}
            rows={3}
            placeholder="What should change?"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setRevisionOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-amber-600 text-white hover:bg-amber-600/90"
            disabled={isPending}
            onClick={() => void handleRequestRevision()}
          >
            Revision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!canEdit) {
    return <ApprovalPill status={status} />;
  }

  if (variant === "menu") {
    return (
      <>
        <div onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                className={cn(
                  "h-7 gap-1 px-2 text-xs font-medium",
                  briefApprovalPillClass(status),
                )}
              >
                {getBriefApprovalLabel(status)}
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[7rem]">
              <DropdownMenuItem
                disabled={status === "approved" || isPending}
                onSelect={() => void handleApprove()}
              >
                Approved
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isPending}
                className="text-amber-700 focus:text-amber-700 dark:text-amber-300"
                onSelect={() => setRevisionOpen(true)}
              >
                Revision
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isPending}
                onSelect={() => void handleClearApproval()}
              >
                Pending
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {revisionDialog}
      </>
    );
  }

  return (
    <>
      <div className="space-y-2 rounded-lg border bg-muted/20 px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              className={cn(
                "h-8 gap-1 px-2.5 text-xs font-medium",
                briefApprovalPillClass(status),
              )}
            >
              {getBriefApprovalLabel(status)}
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[7rem]">
            <DropdownMenuItem
              disabled={status === "approved" || isPending}
              onSelect={() => void handleApprove()}
            >
              Approved
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isPending}
              className="text-amber-700 focus:text-amber-700 dark:text-amber-300"
              onSelect={() => setRevisionOpen(true)}
            >
              Revision
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isPending}
              onSelect={() => void handleClearApproval()}
            >
              Pending
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {approval?.revision_notes ? (
          <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
            {approval.revision_notes}
          </p>
        ) : null}
      </div>
      {revisionDialog}
    </>
  );
};
