import { useMemo } from "react";
import { ChevronRight, ChevronLeft, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectTasksPanel } from "@/modules/deals/projects/ProjectTasksPanel";
import type { LbsDeal } from "@/modules/types";

const RAIL_WIDTH_PX = 360;

const resolveContactIds = (record: LbsDeal): LbsDeal["contact_ids"] => {
  if (record.contact_ids && record.contact_ids.length > 0) {
    return record.contact_ids;
  }
  if (record.contact_id != null) return [record.contact_id];
  return [];
};

export const ProjectTasksRail = ({
  record,
  collapsed,
  onToggleCollapsed,
}: {
  record: LbsDeal;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) => {
  const contactIds = useMemo(
    () => resolveContactIds(record),
    [record.contact_id, record.contact_ids],
  );

  if (collapsed) {
    return (
      <aside className="shrink-0 print:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onToggleCollapsed}
          className="sticky top-4 flex size-9 items-center justify-center"
          aria-label="Open project tasks"
          title="Open tasks rail"
        >
          <ChevronLeft className="size-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside
      className="shrink-0 print:hidden"
      style={{ width: RAIL_WIDTH_PX }}
    >
      <div className="bg-card sticky top-4 max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg border shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <ListChecks className="text-muted-foreground size-4" />
            <h3 className="text-sm font-semibold">Project tasks</h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onToggleCollapsed}
            aria-label="Collapse tasks rail"
            title="Collapse"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-3">
          <ProjectTasksPanel record={record} contactIds={contactIds} />
        </div>
      </div>
    </aside>
  );
};

export const ProjectTasksDialog = ({
  record,
  open,
  onOpenChange,
}: {
  record: LbsDeal;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) => {
  const contactIds = useMemo(
    () => resolveContactIds(record),
    [record.contact_id, record.contact_ids],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="size-5" />
            Project tasks
          </DialogTitle>
          <DialogDescription>
            All tasks linked to this project. Same view as the side rail.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          {open ? (
            <ProjectTasksPanel record={record} contactIds={contactIds} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
