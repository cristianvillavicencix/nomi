import { useEffect, useMemo, useState } from "react";
import { useGetIdentity, useNotify, useRefresh, useUpdate } from "ra-core";
import { HandMetal, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  approveBriefSection,
  getBriefSectionApproval,
  getVisibleBriefSections,
  type WebsiteBriefWithApprovals,
} from "@/modules/deals/websiteBriefSchema";
import {
  buildManualHandoffBriefUpdate,
  isBriefRequirementsWaived,
} from "@/modules/deals/projectManualHandoff";
import type { LbsDeal } from "@/modules/types";

type ManualHandoffDialogProps = {
  record: LbsDeal;
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

export const ManualHandoffDialog = ({
  record,
  open,
  onOpenChange,
}: ManualHandoffDialogProps) => {
  const { data: identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending }] = useUpdate();
  const waived = isBriefRequirementsWaived(record);

  const sections = useMemo(
    () => getVisibleBriefSections(record.project_type),
    [record.project_type],
  );

  const brief = (record.website_brief ?? {}) as WebsiteBriefWithApprovals;

  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Pre-check sections that are already approved whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    const approved = new Set<string>();
    for (const section of sections) {
      if (getBriefSectionApproval(brief, section.id)?.status === "approved") {
        approved.add(section.id);
      }
    }
    setChecked(approved);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const memberId =
    identity?.id != null && Number.isFinite(Number(identity.id))
      ? Number(identity.id)
      : null;

  const persist = (enable: boolean) => {
    let nextBrief = buildManualHandoffBriefUpdate(
      record.website_brief,
      enable,
      memberId,
    ) as WebsiteBriefWithApprovals;
    if (enable) {
      for (const section of sections) {
        if (checked.has(section.id)) {
          nextBrief = approveBriefSection(nextBrief, section.id, memberId);
        }
      }
    }
    update(
      "deals",
      {
        id: record.id,
        data: { website_brief: nextBrief },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify(
            enable
              ? "Manual handoff enabled"
              : "Manual handoff turned off — brief requirements restored",
            { type: "info" },
          );
          refresh();
          onOpenChange(false);
        },
        onError: () =>
          notify("Could not update manual handoff", { type: "error" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandMetal className="size-5" />
            Manual handoff
          </DialogTitle>
          <DialogDescription>
            Mark the sections you consider done. Enabling manual handoff lets
            you deliver without the client filling the brief. You can still edit
            any section afterwards.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[55vh] divide-y divide-border overflow-y-auto rounded-md border">
          {sections.map((section) => {
            const isChecked = checked.has(section.id);
            return (
              <li key={section.id} className="flex items-center gap-3 p-3">
                <Checkbox
                  id={`handoff-${section.id}`}
                  checked={isChecked}
                  onCheckedChange={() => toggle(section.id)}
                />
                <Label
                  htmlFor={`handoff-${section.id}`}
                  className="flex-1 cursor-pointer text-sm font-medium"
                >
                  {section.title}
                </Label>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="gap-2 sm:justify-between">
          {waived ? (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => persist(false)}
            >
              Turn off
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" disabled={isPending} onClick={() => persist(true)}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <HandMetal className="size-4" />
            )}
            {waived ? "Save" : "Enable manual handoff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
