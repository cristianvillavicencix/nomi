import { useState, type ReactNode } from "react";
import { Check, Link2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
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
import { usesContractorBriefForm } from "@/modules/deals/contractorBriefSchema";
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
  getProjectBriefSections,
  lbsProjectTypeChoices,
  type ProjectBriefPack,
  type WebsiteBriefSectionDef,
} from "@/modules/deals/websiteBriefSchema";
import {
  WebsiteBriefSectionSheet,
  type WebsiteBriefSheetTarget,
} from "@/modules/deals/WebsiteBriefSectionSheet";
import type { LbsDeal } from "@/modules/types";

const getProjectTypeLabel = (value?: string | null) =>
  lbsProjectTypeChoices.find((choice) => choice.value === value)?.label ??
  value?.replace(/-/g, "") ??
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

const BriefTableRow = ({
  title,
  percent,
  subtitle,
  onOpen,
  rowActions,
}: {
  title: string;
  percent: number;
  subtitle: string;
  onOpen: (mode: "view" | "edit") => void;
  rowActions?: ReactNode;
}) => (
  <TableRow className="cursor-pointer" onClick={() => onOpen("view")}>
    <TableCell className="w-12 px-3">
      <BriefSectionStatusIcon percent={percent} />
    </TableCell>
    <TableCell className="min-w-0 whitespace-normal px-3">
      <button
        type="button"
        className="w-full min-w-0 text-left"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(percent < 100 ? "edit" : "view");
        }}
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
      <div
        className="flex items-center justify-end gap-0.5"
        onClick={(event) => event.stopPropagation()}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                className="text-muted-foreground"
                aria-label={`Edit ${title}`}
                onClick={() => onOpen("edit")}
              >
                <Pencil className="size-4" />
              </IconButton>
            </TooltipTrigger>
            <TooltipContent>Edit section</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {rowActions}
      </div>
    </TableCell>
  </TableRow>
);

const BriefSectionTableRow = ({
  record,
  section,
  brief,
  onRequestSection,
  onOpen,
}: {
  record: LbsDeal;
  section: WebsiteBriefSectionDef;
  brief: Record<string, unknown>;
  onRequestSection: (scope?: BriefRequestScope) => void;
  onOpen: (mode: "view" | "edit") => void;
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
            <IconButton
              className="text-muted-foreground"
              aria-label={`Request ${section.title} from client`}
              onClick={() => onRequestSection(scopeForBriefSection(section.id))}
            >
              <Link2 className="size-4" />
            </IconButton>
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
      title={section.title}
      percent={sectionPercent}
      subtitle={subtitle}
      onOpen={onOpen}
      rowActions={rowActions}
    />
  );
};

export const WebsiteBriefAccordion = ({
  record,
  onRequestSection,
  formStatusBanner,
}: WebsiteBriefAccordionProps) => {
  const [sheetTarget, setSheetTarget] =
    useState<WebsiteBriefSheetTarget | null>(null);
  const [sheetMode, setSheetMode] = useState<"view" | "edit">("view");
  const [pack, setPack] = useState<ProjectBriefPack>("essential");
  const canTogglePack = usesContractorBriefForm(record.project_type);

  const brief = record.website_brief ?? {};
  const sections = getProjectBriefSections(
    record.project_type,
    canTogglePack ? pack : "full",
  );

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
    .join(" ·");

  const setupPercent = getSectionProgressPercent(
    Number(Boolean(record.project_type)) +
      Number(Boolean(getProjectDeliveryDate(record))),
    BRIEF_SETUP_FIELD_COUNT,
  );

  const setupSubtitle = getSectionSubtitle(
    setupPercent,
    setupPreview || "Not started",
    projectTypeLabel !== "—" ? projectTypeLabel : undefined,
  );

  const openSheet = (
    target: WebsiteBriefSheetTarget,
    mode: "view" | "edit",
  ) => {
    setSheetMode(mode);
    setSheetTarget(target);
  };

  return (
    <div className="overflow-hidden border">
      {formStatusBanner ? (
        <div className="border-b bg-muted/20 px-4 py-3 text-sm">
          {formStatusBanner}
        </div>
      ) : null}

      {canTogglePack ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 text-sm">
          <p className="text-muted-foreground">
            {pack === "essential"
              ? "Quick website brief — 5 sections (same as client send)"
              : "Full project brief — all sections"}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setPack((current) =>
                current === "essential" ? "full" : "essential",
              )
            }
          >
            {pack === "essential" ? "Show full brief" : "Show quick brief"}
          </Button>
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
            title="Project setup"
            percent={setupPercent}
            subtitle={setupSubtitle}
            onOpen={(mode) => openSheet({ kind: "setup" }, mode)}
          />

          {sections.map((section) => (
            <BriefSectionTableRow
              key={section.id}
              record={record}
              section={section}
              brief={brief}
              onRequestSection={onRequestSection}
              onOpen={(mode) =>
                openSheet({ kind: "section", section }, mode)
              }
            />
          ))}
        </TableBody>
      </Table>

      <WebsiteBriefSectionSheet
        record={record}
        target={sheetTarget}
        initialMode={sheetMode}
        onClose={() => setSheetTarget(null)}
      />
    </div>
  );
};
