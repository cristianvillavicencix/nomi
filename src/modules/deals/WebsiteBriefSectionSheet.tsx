import { useEffect, useMemo, useState } from "react";
import { Form, useGetIdentity, useGetOne, useNotify, useUpdate } from "ra-core";
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
  syncBriefApprovalsForCompleteSections,
  type WebsiteBriefWithApprovals,
} from "@/modules/deals/websiteBriefSchema";
import {
  getContactEmail,
  getContactFullName,
  getContactPhone,
} from "@/modules/clients/clientShowUtils";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { LbsDeal } from "@/modules/types";

const optionalUrl = (url?: string) => {
  if (!url?.trim()) return;
  const urlRegex =
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,}(:[0-9]{1,5})?(\/.*)?$/i;
  if (!urlRegex.test(url.trim())) {
    return "Must be a valid URL";
  }
};

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

  const contactId =
    record.contact_id ??
    (Array.isArray(record.contact_ids) ? record.contact_ids[0] : null);
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId as number },
    { enabled: open && contactId != null },
  );
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: record.company_id as number },
    { enabled: open && record.company_id != null },
  );

  // Build a brief with sensible defaults pulled from the linked contact and
  // company. Existing values in record.website_brief always win — we only
  // fill in keys the user has not touched yet. We clone before writing so we
  // never mutate the original record handed in from react-admin.
  const prefilledRecord = useMemo(() => {
    if (!open) return record;
    const currentBrief: Record<string, unknown> = {
      ...((record.website_brief as Record<string, unknown> | undefined) ?? {}),
    };
    const fillIfEmpty = (key: string, value: string | undefined | null) => {
      if (value == null || value === "") return;
      const existing = currentBrief[key];
      if (existing != null && String(existing).trim().length > 0) return;
      currentBrief[key] = value;
    };
    if (contact) {
      fillIfEmpty("contact_name", getContactFullName(contact));
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
      fillIfEmpty("full_address_street", company.address ?? "");
      fillIfEmpty("full_address_city", company.city ?? "");
      fillIfEmpty("full_address_state", company.state_abbr ?? "");
      fillIfEmpty("full_address_zip", company.zipcode ?? "");
    }
    return { ...record, website_brief: currentBrief };
  }, [open, record, contact, company]);

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
              const rawBrief = (data.website_brief ??
                record.website_brief ??
                {}) as WebsiteBriefWithApprovals;
              const memberId =
                identity?.id != null && Number.isFinite(Number(identity.id))
                  ? Number(identity.id)
                  : null;
              const website_brief = syncBriefApprovalsForCompleteSections(
                rawBrief,
                data.project_type ?? record.project_type,
                memberId,
              );
              await update(
                "deals",
                {
                  id: record.id,
                  data: { ...data, website_brief },
                  previousData: record,
                },
                {
                  onSuccess: () => {
                    notify("Brief saved");
                    setMode("view");
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
                  />
                  <DateInput
                    source="expected_end_date"
                    label="Delivery date"
                    helperText={false}
                  />
                </div>
              ) : (
                <WebsiteBriefFormSections
                  onlySectionId={
                    target.kind === "section" ? target.section.id : undefined
                  }
                  validateUrl={optionalUrl}
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
