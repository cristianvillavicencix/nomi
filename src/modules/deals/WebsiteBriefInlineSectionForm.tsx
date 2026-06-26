import { Form, useGetIdentity, useNotify, useUpdate } from "ra-core";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { lbsProjectTypeChoices } from "@/modules/deals/lbsProjectConstants";
import { WebsiteBriefFormSections } from "@/modules/deals/WebsiteBriefFormSections";
import type { WebsiteBriefSectionDef } from "@/modules/deals/websiteBriefSchema";
import {
  mergeBriefSubmitData,
  optionalBriefUrl,
  useBriefPrefilledRecord,
} from "@/modules/deals/websiteBriefEditorShared";
import type { LbsDeal } from "@/modules/types";

export type WebsiteBriefInlineTarget =
  | { kind: "setup" }
  | { kind: "section"; section: WebsiteBriefSectionDef };

type WebsiteBriefInlineSectionFormProps = {
  record: LbsDeal;
  target: WebsiteBriefInlineTarget;
  onSaved?: () => void;
  onCancel?: () => void;
};

export const WebsiteBriefInlineSectionForm = ({
  record,
  target,
  onSaved,
  onCancel,
}: WebsiteBriefInlineSectionFormProps) => {
  const prefilledRecord = useBriefPrefilledRecord(record, true);
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const { data: identity } = useGetIdentity();

  const description =
    target.kind === "setup"
      ? "Service type and delivery date for this project."
      : target.section.description;

  return (
    <Form
      key={`${record.id}-${target.kind === "setup" ? "setup" : target.section.id}`}
      record={prefilledRecord}
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
              notify("Section saved", { type: "info" });
              onSaved?.();
            },
            onError: () => notify("Failed to save section", { type: "error" }),
          },
        );
      }}
    >
      <div className="space-y-4 border-t bg-muted/20 px-4 py-4">
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}

        {target.kind === "setup" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SelectInput
              source="project_type"
              label="Service type"
              choices={lbsProjectTypeChoices}
              optionText="label"
              optionValue="value"
              helperText={false}
            />
            <DateInput
              source="expected_end_date"
              label="Delivery date"
              helperText={false}
            />
          </div>
        ) : (
          <WebsiteBriefFormSections
            onlySectionId={target.section.id}
            validateUrl={optionalBriefUrl}
            showSecurityHint={false}
          />
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save section
          </Button>
        </div>
      </div>
    </Form>
  );
};
