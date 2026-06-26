import { evaluateCondition } from "@/lib/forms-v2/conditionalLogic";
import { formatBriefFieldForDisplay } from "@/modules/deals/businessHoursBrief";
import {
  formatProjectDeliveryDate,
  getProjectDeliveryDate,
} from "@/modules/deals/projectDeliveryDate";
import { isBriefMetadataKey } from "@/modules/deals/projectManualHandoff";
import {
  getBriefSectionApproval,
  getVisibleBriefSections,
  lbsProjectTypeChoices,
  type WebsiteBriefFieldDef,
  type WebsiteBriefWithApprovals,
} from "@/modules/deals/websiteBriefSchema";
import type { LbsDeal } from "@/modules/types";

const getProjectTypeLabel = (value?: string | null) =>
  lbsProjectTypeChoices.find((choice) => choice.value === value)?.label ??
  value?.replace(/-/g, " ") ??
  "—";

const slugifyFilename = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "project";

const isEmptyBriefValue = (value: unknown): boolean => {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) {
    return (
      value.length === 0 ||
      value.every(
        (entry) =>
          entry == null ||
          (typeof entry === "string" && entry.trim().length === 0),
      )
    );
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("url" in record && String(record.url ?? "").trim()) return false;
    return Object.values(record).every(isEmptyBriefValue);
  }
  return false;
};

const formatObjectBriefValue = (value: Record<string, unknown>): string => {
  if (typeof value.url === "string" && value.url.trim()) {
    const name = String(value.name ?? value.filename ?? "File").trim();
    return `[${name}](${value.url.trim()})`;
  }
  const parts = Object.entries(value)
    .filter(([, entry]) => !isEmptyBriefValue(entry))
    .map(([key, entry]) => `${key}: ${String(entry).trim()}`);
  return parts.length > 0 ? parts.join("; ") : "";
};

const formatBriefValueForMarkdown = (
  fieldKey: string,
  value: unknown,
): string => {
  if (isEmptyBriefValue(value)) return "";

  const display = formatBriefFieldForDisplay(fieldKey, value);
  if (display.trim()) return display.trim();

  if (Array.isArray(value)) {
    const lines = value
      .map((entry) => {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          if (!trimmed) return "";
          if (trimmed.includes("|")) {
            const [platform = "", url = ""] = trimmed.split("|");
            const label = platform.trim() || "Link";
            const href = url.trim();
            return href ? `- **${label}:** ${href}` : `- ${trimmed}`;
          }
          return `- ${trimmed}`;
        }
        if (entry && typeof entry === "object") {
          const formatted = formatObjectBriefValue(
            entry as Record<string, unknown>,
          );
          return formatted ? `- ${formatted}` : "";
        }
        return `- ${String(entry).trim()}`;
      })
      .filter(Boolean);
    return lines.join("\n");
  }

  if (value && typeof value === "object") {
    return formatObjectBriefValue(value as Record<string, unknown>);
  }

  return String(value).trim();
};

const approvalStatusLabel = (status?: string | null) => {
  if (status === "approved") return "Approved";
  if (status === "revision_requested") return "Revision requested";
  return "Pending";
};

const formatFieldBlock = (field: WebsiteBriefFieldDef, value: unknown) => {
  const formatted = formatBriefValueForMarkdown(field.key, value);
  if (!formatted) return "";

  const multiline = formatted.includes("\n") || field.multiline;
  if (multiline) {
    return `### ${field.label}\n\n${formatted}\n`;
  }
  return `**${field.label}:** ${formatted}\n`;
};

export const buildProjectBriefMarkdown = (record: LbsDeal): string => {
  const brief = (record.website_brief ?? {}) as WebsiteBriefWithApprovals;
  const answers = brief as Record<string, unknown>;
  const sections = getVisibleBriefSections(record.project_type);
  const exportedAt = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const projectName = record.name?.trim() || `Project #${record.id}`;
  const deliveryDate = formatProjectDeliveryDate(
    getProjectDeliveryDate(record),
  );

  const lines: string[] = [
    `# Project brief: ${projectName}`,
    "",
    `**Exported:** ${exportedAt}  `,
    `**Service type:** ${getProjectTypeLabel(record.project_type ?? record.category)}  `,
    deliveryDate ? `**Delivery date:** ${deliveryDate}  ` : "",
    "",
    "---",
    "",
    "## Project setup",
    "",
    `**Service type:** ${getProjectTypeLabel(record.project_type ?? record.category)}`,
  ];

  if (deliveryDate) {
    lines.push(`**Delivery date:** ${deliveryDate}`);
  }

  lines.push("");

  for (const section of sections) {
    const visibleFields = section.fields.filter((field) =>
      field.visibleWhen ? evaluateCondition(field.visibleWhen, answers) : true,
    );

    const fieldBlocks = visibleFields
      .map((field) => formatFieldBlock(field, answers[field.key]))
      .filter(Boolean);

    const approval = getBriefSectionApproval(brief, section.id);
    const approvalLine = `*Approval: ${approvalStatusLabel(approval?.status)}*`;

    lines.push(`## ${section.title}`);
    if (section.description?.trim()) {
      lines.push("");
      lines.push(`> ${section.description.trim()}`);
    }
    lines.push("");
    lines.push(approvalLine);
    lines.push("");

    if (fieldBlocks.length === 0) {
      lines.push("*No answers in this section yet.*");
    } else {
      lines.push(...fieldBlocks);
    }

    lines.push("");
  }

  const knownKeys = new Set<string>([
    ...sections.flatMap((section) => section.fields.map((field) => field.key)),
  ]);

  const extraEntries = Object.entries(brief).filter(([key, value]) => {
    if (isBriefMetadataKey(key)) return false;
    if (knownKeys.has(key)) return false;
    return !isEmptyBriefValue(value);
  });

  if (extraEntries.length > 0) {
    lines.push("## Additional fields");
    lines.push("");
    for (const [key, value] of extraEntries) {
      const label = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
      const formatted = formatBriefValueForMarkdown(key, value);
      if (!formatted) continue;
      if (formatted.includes("\n")) {
        lines.push(`### ${label}`, "", formatted, "");
      } else {
        lines.push(`**${label}:** ${formatted}`, "");
      }
    }
  }

  return `${lines
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n")
    .trim()}\n`;
};

export const downloadProjectBriefMarkdown = (
  record: LbsDeal,
  markdown = buildProjectBriefMarkdown(record),
) => {
  const slug = slugifyFilename(record.name ?? `project-${record.id}`);
  const filename = `${slug}-brief.md`;
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
};
