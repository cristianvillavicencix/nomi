import * as XLSX from "xlsx";
import type { FormInstance, FormSubmissionV2 } from "@/lbs/forms-v2/types";
import { collectSchemaFields } from "@/lbs/forms-v2/submissions/submissionAnswerRenderer";

const readAnswer = (value: unknown): string => {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object" && "url" in item
          ? String((item as { url?: string }).url ?? "")
          : String(item),
      )
      .filter(Boolean)
      .join("; ");
  }
  if (typeof value === "object" && "url" in value) {
    return String((value as { url?: string }).url ?? "");
  }
  return String(value);
};

export type SubmissionExportRow = Record<string, string | number>;

export const flattenSubmission = (
  submission: FormSubmissionV2,
  formName: string,
  schemaFields: string[] = [],
): SubmissionExportRow => {
  const row: SubmissionExportRow = {
    id: submission.id,
    form_name: formName,
    form_instance_id: submission.form_instance_id,
    status: submission.status ?? "new",
    submitted_at: submission.submitted_at ?? "",
    submitter_name: submission.submitter_name ?? "",
    submitter_email: submission.submitter_email ?? "",
    submitter_phone: submission.submitter_phone ?? "",
    contact_id: submission.contact_id ?? "",
    deal_id: submission.deal_id ?? "",
    company_id: submission.company_id ?? "",
    source_url: submission.source_url ?? "",
    utm_source: submission.utm_source ?? "",
    utm_medium: submission.utm_medium ?? "",
    utm_campaign: submission.utm_campaign ?? "",
  };

  const answers = submission.answers ?? {};
  const keys =
    schemaFields.length > 0 ? schemaFields : Object.keys(answers).sort();

  for (const key of keys) {
    row[`answer_${key}`] = readAnswer(answers[key]);
  }

  return row;
};

export const buildExportRows = (
  submissions: FormSubmissionV2[],
  formsById: Map<number, FormInstance>,
): SubmissionExportRow[] => {
  const singleFormId =
    submissions.length > 0 &&
    submissions.every(
      (item) => item.form_instance_id === submissions[0]?.form_instance_id,
    )
      ? submissions[0]?.form_instance_id
      : null;

  const schemaFields =
    singleFormId != null
      ? collectSchemaFields(formsById.get(Number(singleFormId))?.schema).map(
          (field) => field.key,
        )
      : [];

  return submissions.map((submission) =>
    flattenSubmission(
      submission,
      formsById.get(Number(submission.form_instance_id))?.name ?? "Unknown",
      schemaFields,
    ),
  );
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const exportSubmissionsCsv = (
  submissions: FormSubmissionV2[],
  formsById: Map<number, FormInstance>,
) => {
  const rows = buildExportRows(submissions, formsById);
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0] ?? {});
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escape(row[header] ?? "")).join(","),
    ),
  ].join("\n");

  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `submissions-${stamp}.csv`,
  );
};

export const exportSubmissionsExcel = (
  submissions: FormSubmissionV2[],
  formsById: Map<number, FormInstance>,
) => {
  const rows = buildExportRows(submissions, formsById);
  if (rows.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `submissions-${stamp}.xlsx`);
};
