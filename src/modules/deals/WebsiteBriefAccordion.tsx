import { Fragment, useState, type ReactNode } from "react";
import { Check, Link2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BriefSectionApprovalActions } from "@/modules/deals/BriefSectionApprovalActions";
import {
  scopeForBriefSection,
  type BriefRequestScope,
} from "@/modules/deals/projectBriefRequestScope";
import {
  formatProjectDeliveryDate,
  getProjectDeliveryDate,
} from "@/modules/deals/projectDeliveryDate";
import {
  BRIEF_SETUP_FIELD_COUNT,
  getSectionProgressPercent,
} from "@/modules/deals/projectBriefProgress";
import {
  getBriefSectionPreview,
  getBriefSectionStats,
  getVisibleBriefSections,
  lbsProjectTypeChoices,
  type WebsiteBriefSectionDef,
} from "@/modules/deals/websiteBriefSchema";
import { WebsiteBriefInlineSectionForm } from "@/modules/deals/WebsiteBriefInlineSectionForm";
import type { LbsDeal } from "@/modules/types";

const SETUP_SECTION_ID = "__setup__";

const getProjectTypeLabel = (value?: string | null) =>
  lbsProjectTypeChoices.find((choice) => choice.value === value)?.label ??
  value?.replace(/-/g, " ") ??
  "—";

const getSectionSubtitle = (
  percent: number,
  preview: string,
  completeHint?: string,
) => {
  if (percent === 0) return "Not started";
  if (percent >= 100) {
    const hint =
      completeHint && completeHint !== "Not started"
        ? completeHint
        : preview !== "Not started"
          ? preview
          : null;
    return hint ? `Complete · ${hint}` : "Complete";
  }
  return preview;
};

const BriefSectionStatusIcon = ({ percent }: { percent: number }) => {
  if (percent >= 100) {
    return (
      <div
        className="mx-auto flex size-6 items-center justify-center rounded-full bg-success/15 text-success"
        aria-hidden
      >
        <Check className="size-3" strokeWidth={2.5} />
      </div>
    );
  }

  if (percent === 0) {
    return (
      <div
        className="mx-auto flex size-6 items-center justify-center rounded-full border bg-muted/30"
        aria-hidden
      >
        <span className="size-2 rounded-full border border-muted-foreground/30" />
      </div>
    );
  }

  const ringClass =
    percent >= 70
      ? "border-info/60 text-info"
      : "border-warning/70 text-warning";

  return (
    <div
      className={cn(
        "mx-auto flex size-6 items-center justify-center rounded-full border border-dashed bg-background",
        ringClass,
      )}
      aria-hidden
    />
  );
};

type WebsiteBriefAccordionProps = {
  record: LbsDeal;
  onRequestSection: (scope?: BriefRequestScope) => void;
  formStatusBanner?: ReactNode;
};

type BriefTableRowProps = {
  sectionId: string;
  title: string;
  percent: number;
  subtitle: string;
  isOpen: boolean;
  onToggle: () => void;
  rowActions?: ReactNode;
  children: ReactNode;
};

const BriefTableRow = ({
  sectionId,
  title,
  percent,
  subtitle,
  isOpen,
  onToggle,
  rowActions,
  children,
}: BriefTableRowProps) => (
  <Fragment key={sectionId}>
    <TableRow className={cn(isOpen && "bg-muted/30")}>
      <TableCell className="w-12 px-3">
        <BriefSectionStatusIcon percent={percent} />
      </TableCell>
      <TableCell className="min-w-0 whitespace-normal px-3">
        <button
          type="button"
          className="w-full min-w-0 text-left"
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          <span className="block truncate text-sm">
            <span className="font-medium text-foreground">{title}</span>
            <span className="text-muted-foreground"> · {subtitle}</span>
          </span>
        </button>
      </TableCell>
      <TableCell className="w-16 px-3 text-right text-xs tabular-nums text-muted-foreground">
        {percent}%
      </TableCell>
      <TableCell className="w-32 px-3">
        <div className="flex items-center justify-end gap-0.5">
          {percent < 100 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label={`Edit ${title}`}
                    aria-expanded={isOpen}
                    onClick={onToggle}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit section</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          {rowActions}
        </div>
      </TableCell>
    </TableRow>
    {isOpen ? (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={4} className="p-0">
          {children}
        </TableCell>
      </TableRow>
    ) : null}
  </Fragment>
);

const BriefSectionTableRow = ({
  record,
  section,
  brief,
  isOpen,
  onRequestSection,
  onToggle,
}: {
  record: LbsDeal;
  section: WebsiteBriefSectionDef;
  brief: Record<string, unknown>;
  isOpen: boolean;
  onRequestSection: (scope?: BriefRequestScope) => void;
  onToggle: () => void;
}) => {
  const stats = getBriefSectionStats(section, brief);
  const sectionPercent = getSectionProgressPercent(stats.filled, stats.total);
  const preview = getBriefSectionPreview(section, brief);
  const subtitle = getSectionSubtitle(sectionPercent, preview);

  const rowActions = (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label={`Request ${section.title} from client`}
              onClick={() => onRequestSection(scopeForBriefSection(section.id))}
            >
              <Link2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Request this section</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {sectionPercent < 100 ? (
        <BriefSectionApprovalActions
          record={record}
          sectionId={section.id}
          sectionTitle={section.title}
          variant="icon"
        />
      ) : null}
    </>
  );

  return (
    <BriefTableRow
      sectionId={section.id}
      title={section.title}
      percent={sectionPercent}
      subtitle={subtitle}
      isOpen={isOpen}
      onToggle={onToggle}
      rowActions={rowActions}
    >
      <WebsiteBriefInlineSectionForm
        record={record}
        target={{ kind: "section", section }}
        onCancel={onToggle}
      />
    </BriefTableRow>
  );
};

export const WebsiteBriefAccordion = ({
  record,
  onRequestSection,
  formStatusBanner,
}: WebsiteBriefAccordionProps) => {
  const [openSection, setOpenSection] = useState<string | undefined>();

  const brief = record.website_brief ?? {};
  const sections = getVisibleBriefSections(record.project_type);

  const deliveryDateLabel = formatProjectDeliveryDate(
    getProjectDeliveryDate(record),
  );
  const projectTypeLabel = getProjectTypeLabel(
    record.project_type ?? record.category,
  );
  const setupPreview = [
    projectTypeLabel !== "—" ? projectTypeLabel : null,
    deliveryDateLabel ? `Delivery ${deliveryDateLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const setupPercent = getSectionProgressPercent(
    Number(Boolean(record.project_type)) +
      Number(Boolean(getProjectDeliveryDate(record))),
    BRIEF_SETUP_FIELD_COUNT,
  );

  const toggleSection = (sectionId: string) => {
    setOpenSection((current) =>
      current === sectionId ? undefined : sectionId,
    );
  };

  const setupSubtitle = getSectionSubtitle(
    setupPercent,
    setupPreview || "Not started",
    projectTypeLabel !== "—" ? projectTypeLabel : undefined,
  );

  return (
    <div className="overflow-hidden border">
      {formStatusBanner ? (
        <div className="border-b bg-muted/20 px-4 py-3 text-sm">
          {formStatusBanner}
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20 hover:bg-muted/20">
            <TableHead className="w-12 px-3" aria-hidden />
            <TableHead className="px-3 text-muted-foreground">
              Section
            </TableHead>
            <TableHead className="w-16 px-3 text-right text-muted-foreground">
              Progress
            </TableHead>
            <TableHead className="w-32 px-3 text-right text-muted-foreground">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <BriefTableRow
            sectionId={SETUP_SECTION_ID}
            title="Project setup"
            percent={setupPercent}
            subtitle={setupSubtitle}
            isOpen={openSection === SETUP_SECTION_ID}
            onToggle={() => toggleSection(SETUP_SECTION_ID)}
          >
            <WebsiteBriefInlineSectionForm
              record={record}
              target={{ kind: "setup" }}
              onCancel={() => setOpenSection(undefined)}
            />
          </BriefTableRow>

          {sections.map((section) => (
            <BriefSectionTableRow
              key={section.id}
              record={record}
              section={section}
              brief={brief}
              isOpen={openSection === section.id}
              onRequestSection={onRequestSection}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
