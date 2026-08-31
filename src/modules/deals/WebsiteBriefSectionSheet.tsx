import { useEffect, useState } from "react";
import { Form, useGetIdentity, useNotify, useUpdate } from "ra-core";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { lbsProjectTypeChoices } from "@/modules/deals/lbsProjectConstants";
import { WebsiteBriefFormSections } from "@/modules/deals/WebsiteBriefFormSections";
import { WebsiteBriefSectionView } from "@/modules/deals/WebsiteBriefSectionView";
import type { WebsiteBriefSectionDef } from "@/modules/deals/websiteBriefSchema";
import {
  mergeBriefSubmitData,
  optionalBriefUrl,
  useBriefPrefilledRecord,
} from "@/modules/deals/websiteBriefEditorShared";
import type { LbsDeal } from "@/modules/types";

export type WebsiteBriefSheetTarget =
  | { kind: "setup" }
  | { kind: "section"; section: WebsiteBriefSectionDef }
  | { kind: "all" };

type WebsiteBriefSectionSheetProps = {
  record: LbsDeal;
  target: WebsiteBriefSheetTarget | null;
  initialMode?: "view" | "edit";
  onClose: () => void;
};

export const WebsiteBriefSectionSheet = ({
  record,
  target,
  initialMode = "view",
  onClose,
}: WebsiteBriefSectionSheetProps) => {
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const { data: identity } = useGetIdentity();
  const open = target != null;
  const prefilledRecord = useBriefPrefilledRecord(record, open);

  useEffect(() => {
    if (target) setMode(initialMode);
  }, [target, initialMode]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setMode("view");
      onClose();
    }
  };

  const title =
    target?.kind === "setup"
      ? "Project setup"
      : target?.kind === "all"
        ? "Project brief"
        : (target?.section.title ?? "Brief section");

  const description =
    mode === "view"
      ? undefined
      : target?.kind === "setup"
        ? "Service type and delivery date for this project."
        : target?.kind === "all"
          ? "Fill in all brief sections yourself."
          : target?.section.description;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        {mode === "view" && target ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
            <WebsiteBriefSectionView
              record={record}
              target={target}
              onEdit={() => setMode("edit")}
            />
          </div>
        ) : null}

        {mode === "edit" && target ? (
          <Form
            record={prefilledRecord}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={async (data: LbsDeal) => {
              const memberId =
                identity?.id != null && Number.isFinite(Number(identity.id))
                  ? Number(identity.id)
                  : null;
              const payload = mergeBriefSubmitData(record, data, memberId);

              await update(
                "deals",
                {
                  id: record.id,
                  data: payload,
                  previousData: record,
                },
                {
                  onSuccess: () => {
                    notify("Brief saved");
                    if (target.kind === "all") {
                      onClose();
                    } else {
                      setMode("view");
                    }
                  },
                  onError: () =>
                    notify("Failed to save brief", { type: "error" }),
                },
              );
            }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              {target.kind === "setup" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectInput
                    source="project_type"
                    label="Service type"
                    choices={lbsProjectTypeChoices}
                    optionText="label"
                    optionValue="value"
                    helperText={false}
                    labelVariant="floating"
                  />
                  <DateInput
                    source="expected_end_date"
                    label="Delivery date"
                    helperText={false}
                    labelVariant="floating"
                  />
                </div>
              ) : (
                <WebsiteBriefFormSections
                  onlySectionId={
                    target.kind === "section" ? target.section.id : undefined
                  }
                  validateUrl={optionalBriefUrl}
                  showSecurityHint={target.kind === "all"}
                />
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save
              </Button>
            </div>
          </Form>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
