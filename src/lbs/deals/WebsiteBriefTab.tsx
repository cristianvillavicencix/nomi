import { useMemo, useState } from "react";
import { useGetList, useGetOne } from "ra-core";
import { ChevronRight, Link2, Mail, Pencil } from "lucide-react";
import type { Contact } from "@/components/atomic-crm/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { BriefSectionApprovalActions } from "@/lbs/deals/BriefSectionApprovalActions";
import { SendProjectWebFormDialog } from "@/lbs/deals/SendProjectWebFormDialog";
import {
  scopeForBriefSection,
  type BriefRequestScope,
} from "@/lbs/deals/projectBriefRequestScope";
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
import type { FormSubmissionV2, PublicFormToken } from "@/lbs/forms-v2/types";
import type { LbsDeal } from "@/lbs/types";

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
  const [sendScope, setSendScope] = useState<BriefRequestScope | undefined>();
  const [sheetTarget, setSheetTarget] =
    useState<WebsiteBriefSheetTarget | null>(null);
  const [sheetMode, setSheetMode] = useState<"view" | "edit">("view");

  const openRequestDialog = (scope?: BriefRequestScope) => {
    setSendScope(scope);
    setSendOpen(true);
  };

  const contactId =
    record.contact_id ??
    (Array.isArray(record.contact_ids) ? record.contact_ids[0] : null);

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId as number },
    { enabled: contactId != null },
  );

  const { data: submissions = [] } = useGetList<FormSubmissionV2>(
    "form_submissions_v2",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 5 },
      sort: { field: "submitted_at", order: "DESC" },
    },
    { enabled: !!record.id, staleTime: 30_000 },
  );

  const { data: sentTokens = [] } = useGetList<PublicFormToken>(
    "public_form_tokens",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record.id, staleTime: 30_000 },
  );

  const brief = record.website_brief ?? {};
  const sections = useMemo(
    () => getVisibleBriefSections(record.project_type),
    [record.project_type],
  );

  const deliveryDateLabel = formatProjectDeliveryDate(
    getProjectDeliveryDate(record),
  );
  const setupPreview = [
    getProjectTypeLabel(record.project_type ?? record.category),
    deliveryDateLabel ? `Delivery ${deliveryDateLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const latestSentToken = sentTokens[0];
  const latestSubmission = submissions[0];
  const setupPercent = getSectionProgressPercent(
    Number(Boolean(record.project_type)) +
      Number(Boolean(getProjectDeliveryDate(record))),
    BRIEF_SETUP_FIELD_COUNT,
  );

  const openSheet = (
    target: WebsiteBriefSheetTarget,
    mode: "view" | "edit" = "view",
  ) => {
    setSheetMode(mode);
    setSheetTarget(target);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => openRequestDialog()}
        >
          <Link2 className="size-4" />
          Send to client
        </Button>
        <Button
          type="button"
          onClick={() => openSheet({ kind: "all" }, "edit")}
        >
          <Pencil className="size-4" />
          Fill manually
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          {latestSubmission ? (
            <p>
              <span className="font-medium">Client submitted</span>
              {latestSubmission.submitted_at
                ? ` · ${formatActivityDate(String(latestSubmission.submitted_at))}`
                : ""}
            </p>
          ) : latestSentToken ? (
            <p>
              <span className="font-medium">Form sent to client</span>
              {latestSentToken.created_at
                ? ` · ${formatActivityDate(String(latestSentToken.created_at))}`
                : ""}
            </p>
          ) : (
            <p className="text-muted-foreground">Form not sent to client yet</p>
          )}
        </div>
        {latestSentToken && !latestSubmission ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openRequestDialog()}
          >
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
              <TableHead className="w-[96px]">Approval</TableHead>
              <TableHead className="w-[72px]">Request</TableHead>
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
              <TableCell>—</TableCell>
              <TableCell>—</TableCell>
              <TableCell>
                <ChevronRight className="size-4 text-muted-foreground" />
              </TableCell>
            </TableRow>

            {sections.map((section) => {
              const stats = getBriefSectionStats(section, brief);
              const sectionPercent = getSectionProgressPercent(
                stats.filled,
                stats.total,
              );
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
                      stats.isEmpty
                        ? "text-muted-foreground"
                        : "text-foreground/80",
                    )}
                  >
                    {getBriefSectionPreview(section, brief)}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <BriefSectionApprovalActions
                      record={record}
                      sectionId={section.id}
                      sectionTitle={section.title}
                      variant="menu"
                    />
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Request ${section.title} from client`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openRequestDialog(scopeForBriefSection(section.id));
                            }}
                          >
                            <Link2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Request this section</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
        onClose={() => {
          setSendOpen(false);
          setSendScope(undefined);
        }}
        dealId={record.id}
        companyId={record.company_id}
        contactId={contactId}
        clientEmail={contact ? getContactEmail(contact) : undefined}
        clientName={contact ? getContactFullName(contact) : undefined}
        projectName={record.name}
        projectType={record.project_type}
        dealRecord={record}
        requestScope={sendScope}
      />
    </div>
  );
};
