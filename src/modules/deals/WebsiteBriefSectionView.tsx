import { useMemo } from "react";
import { useGetOne } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  formatProjectDeliveryDate,
  getProjectDeliveryDate,
} from "@/modules/deals/projectDeliveryDate";
import {
  getProjectBriefSections,
  lbsProjectTypeChoices,
  type WebsiteBriefSectionDef,
} from "@/modules/deals/websiteBriefSchema";
import { BriefSectionApprovalActions } from "@/modules/deals/BriefSectionApprovalActions";
import {
  getContactEmail,
  getContactPhone,
} from "@/modules/clients/clientShowUtils";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { LbsDeal } from "@/modules/types";
import type { WebsiteBriefSheetTarget } from "@/modules/deals/WebsiteBriefSectionSheet";
import { formatBriefFieldForDisplay } from "@/modules/deals/businessHoursBrief";

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
        value={
          brief[field.key] != null
            ? formatBriefFieldForDisplay(field.key, brief[field.key]) || null
            : null
        }
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
  const contactId =
    record.contact_id ??
    (Array.isArray(record.contact_ids) ? record.contact_ids[0] : null);
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId as number },
    { enabled: contactId != null },
  );
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: record.company_id as number },
    { enabled: record.company_id != null },
  );

  // Merge saved brief values with sensible defaults from the linked contact
  // and company. Saved values always win; we only fill keys the user hasn't
  // touched yet so the view shows the data immediately without going to edit.
  const brief = useMemo(() => {
    const merged: Record<string, unknown> = {
      ...(record.website_brief as Record<string, unknown> | undefined),
    };
    const fillIfEmpty = (key: string, value: string | undefined | null) => {
      if (value == null || value === "") return;
      const existing = merged[key];
      if (existing != null && String(existing).trim().length > 0) return;
      merged[key] = value;
    };
    if (contact) {
      fillIfEmpty("contact_first_name", contact.first_name);
      fillIfEmpty("contact_last_name", contact.last_name);
      if (!contact.first_name && !contact.last_name) {
        const legacy = String(merged.contact_name ?? "").trim();
        if (legacy) {
          const [first, ...rest] = legacy.split(/\s+/);
          fillIfEmpty("contact_first_name", first);
          fillIfEmpty("contact_last_name", rest.join(" "));
        }
      }
      fillIfEmpty("contact_email", getContactEmail(contact));
      fillIfEmpty("contact_phone", getContactPhone(contact));
    }
    if (company) {
      fillIfEmpty("company_name", company.name);
      fillIfEmpty("existing_website", company.website);
      const fullAddress = [
        company.address,
        company.city,
        company.state_abbr,
        company.zipcode,
      ]
        .filter(Boolean)
        .join(", ");
      fillIfEmpty("full_address", fullAddress);
    }
    return merged as Record<string, string | null | undefined>;
  }, [record.website_brief, contact, company]);

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
    const sections = getProjectBriefSections(record.project_type, "essential");
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
