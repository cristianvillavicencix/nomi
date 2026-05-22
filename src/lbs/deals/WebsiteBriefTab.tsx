import { useMemo, useState, useEffect } from "react";
import { useGetList, useGetOne } from "ra-core";
import { ChevronRight, Link2, Mail, Pencil } from "lucide-react";
import type { Contact } from "@/components/atomic-crm/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getContactEmail,
  getContactFullName,
} from "@/lbs/clients/clientShowUtils";
import { BriefProgressBar } from "@/lbs/deals/BriefProgressBar";
import { getBriefFormSent } from "@/lbs/deals/briefFormSentStorage";
import { SendProjectWebFormDialog } from "@/lbs/deals/SendProjectWebFormDialog";
import {
  formatProjectDeliveryDate,
  getProjectDeliveryDate,
} from "@/lbs/deals/projectDeliveryDate";
import {
  BRIEF_SETUP_FIELD_COUNT,
  getSectionProgressPercent,
} from "@/lbs/deals/projectBriefProgress";
import {
  getBriefSectionPreview,
  getBriefSectionStats,
  getVisibleBriefSections,
  lbsProjectTypeChoices,
} from "@/lbs/deals/websiteBriefSchema";
import {
  WebsiteBriefSectionSheet,
  type WebsiteBriefSheetTarget,
} from "@/lbs/deals/WebsiteBriefSectionSheet";
import type { FormSubmission, LbsDeal } from "@/lbs/types";

const getProjectTypeLabel = (value?: string | null) =>
  lbsProjectTypeChoices.find((choice) => choice.value === value)?.label ??
  value?.replace(/-/g, " ") ??
  "—";

const formatActivityDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const WebsiteBriefTab = ({ record }: { record: LbsDeal }) => {
  const [sendOpen, setSendOpen] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<WebsiteBriefSheetTarget | null>(null);
  const [sheetMode, setSheetMode] = useState<"view" | "edit">("view");

  const contactId =
    record.contact_id ??
    (Array.isArray(record.contact_ids) ? record.contact_ids[0] : null);

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId as number },
    { enabled: contactId != null },
  );

  const { data: submissions = [] } = useGetList<FormSubmission>(
    "form_submissions",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 5 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record.id, staleTime: 30_000 },
  );

  const brief = record.website_brief ?? {};
  const sections = useMemo(
    () => getVisibleBriefSections(record.project_type),
    [record.project_type],
  );

  const deliveryDateLabel = formatProjectDeliveryDate(getProjectDeliveryDate(record));
  const setupPreview = [
    getProjectTypeLabel(record.project_type ?? record.category),
    deliveryDateLabel ? `Delivery ${deliveryDateLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const sentLocally = getBriefFormSent(record.id);
  const [sentSnapshot, setSentSnapshot] = useState(sentLocally);

  useEffect(() => {
    if (!sendOpen) {
      setSentSnapshot(getBriefFormSent(record.id));
    }
  }, [sendOpen, record.id]);

  const latestSubmission = submissions[0];
  const setupPercent = getSectionProgressPercent(
    Number(Boolean(record.project_type)) +
      Number(Boolean(getProjectDeliveryDate(record))),
    BRIEF_SETUP_FIELD_COUNT,
  );

  const openSheet = (target: WebsiteBriefSheetTarget, mode: "view" | "edit" = "view") => {
    setSheetMode(mode);
    setSheetTarget(target);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setSendOpen(true)}>
          <Link2 className="size-4" />
          Send to client
        </Button>
        <Button type="button" onClick={() => openSheet({ kind: "all" }, "edit")}>
          <Pencil className="size-4" />
          Fill manually
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          {latestSubmission ? (
            <p>
              <span className="font-medium">Client submitted</span>
              {latestSubmission.created_at
                ? ` · ${formatActivityDate(String(latestSubmission.created_at))}`
                : ""}
            </p>
          ) : sentSnapshot ? (
            <p>
              <span className="font-medium">Form sent to client</span>
              {sentSnapshot.sentAt ? ` · ${formatActivityDate(sentSnapshot.sentAt)}` : ""}
            </p>
          ) : (
            <p className="text-muted-foreground">Form not sent to client yet</p>
          )}
        </div>
        {sentSnapshot && !latestSubmission ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSendOpen(true)}>
            <Mail className="size-4" />
            Send reminder
          </Button>
        ) : null}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead className="w-[160px]">Progress</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              className="cursor-pointer"
              onClick={() => openSheet({ kind: "setup" })}
            >
              <TableCell className="font-medium">Project setup</TableCell>
              <TableCell>
                <BriefProgressBar percent={setupPercent} showLabel />
              </TableCell>
              <TableCell className="max-w-[360px] truncate text-muted-foreground">
                {setupPreview || "Not started"}
              </TableCell>
              <TableCell>
                <ChevronRight className="size-4 text-muted-foreground" />
              </TableCell>
            </TableRow>

            {sections.map((section) => {
              const stats = getBriefSectionStats(section, brief);
              const sectionPercent = getSectionProgressPercent(stats.filled, stats.total);
              return (
                <TableRow
                  key={section.id}
                  className="cursor-pointer"
                  onClick={() => openSheet({ kind: "section", section })}
                >
                  <TableCell className="font-medium">{section.title}</TableCell>
                  <TableCell>
                    <BriefProgressBar percent={sectionPercent} showLabel />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "max-w-[360px] truncate",
                      stats.isEmpty ? "text-muted-foreground" : "text-foreground/80",
                    )}
                  >
                    {getBriefSectionPreview(section, brief)}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <WebsiteBriefSectionSheet
        record={record}
        target={sheetTarget}
        initialMode={sheetMode}
        onClose={() => setSheetTarget(null)}
      />

      <SendProjectWebFormDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        dealId={record.id}
        companyId={record.company_id}
        contactId={contactId}
        clientEmail={contact ? getContactEmail(contact) : undefined}
        clientName={contact ? getContactFullName(contact) : undefined}
        projectName={record.name}
      />
    </div>
  );
};
