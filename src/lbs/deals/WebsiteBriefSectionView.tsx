import { Button } from "@/components/ui/button";
import {
  formatProjectDeliveryDate,
  getProjectDeliveryDate,
} from "@/lbs/deals/projectDeliveryDate";
import {
  getVisibleBriefSections,
  lbsProjectTypeChoices,
  type WebsiteBriefSectionDef,
} from "@/lbs/deals/websiteBriefSchema";
import { BriefSectionApprovalActions } from "@/lbs/deals/BriefSectionApprovalActions";
import type { LbsDeal } from "@/lbs/types";
import type { WebsiteBriefSheetTarget } from "@/lbs/deals/WebsiteBriefSectionSheet";

const getProjectTypeLabel = (value?: string | null) =>
  lbsProjectTypeChoices.find((choice) => choice.value === value)?.label ??
  value?.replace(/-/g, " ") ??
  "—";

const DetailField = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div className="space-y-1">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="whitespace-pre-wrap text-sm font-medium">
      {value?.trim() ? value : "—"}
    </div>
  </div>
);

const SectionDetail = ({
  section,
  brief,
}: {
  section: WebsiteBriefSectionDef;
  brief: Record<string, string | null | undefined>;
}) => (
  <div className="space-y-4">
    {section.fields.map((field) => (
      <DetailField
        key={field.key}
        label={field.label}
        value={brief[field.key] != null ? String(brief[field.key]) : null}
      />
    ))}
  </div>
);

type WebsiteBriefSectionViewProps = {
  record: LbsDeal;
  target: WebsiteBriefSheetTarget;
  onEdit: () => void;
};

export const WebsiteBriefSectionView = ({
  record,
  target,
  onEdit,
}: WebsiteBriefSectionViewProps) => {
  const brief = record.website_brief ?? {};

  if (target.kind === "setup") {
    return (
      <div className="space-y-4">
        <DetailField
          label="Service type"
          value={getProjectTypeLabel(record.project_type ?? record.category)}
        />
        <DetailField
          label="Delivery date"
          value={formatProjectDeliveryDate(getProjectDeliveryDate(record))}
        />
        <div className="flex justify-end pt-2">
          <Button type="button" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    );
  }

  if (target.kind === "all") {
    const sections = getVisibleBriefSections(record.project_type);
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Project setup</div>
          <div className="text-sm font-medium">
            {getProjectTypeLabel(record.project_type)}
          </div>
          <div className="text-sm text-muted-foreground">
            Delivery{" "}
            {formatProjectDeliveryDate(getProjectDeliveryDate(record)) ??
              "not set"}
          </div>
        </div>
        {sections.map((section) => (
          <div key={section.id} className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-semibold">{section.title}</h4>
            <SectionDetail section={section} brief={brief} />
          </div>
        ))}
        <div className="flex justify-end border-t pt-4">
          <Button type="button" onClick={onEdit}>
            Edit brief
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {target.section.description ? (
        <p className="text-sm text-muted-foreground">
          {target.section.description}
        </p>
      ) : null}
      <BriefSectionApprovalActions
        record={record}
        sectionId={target.section.id}
        sectionTitle={target.section.title}
      />
      <SectionDetail section={target.section} brief={brief} />
      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onEdit}>
          Edit section
        </Button>
      </div>
    </div>
  );
};
