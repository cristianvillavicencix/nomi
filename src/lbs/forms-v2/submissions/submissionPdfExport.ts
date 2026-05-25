import { jsPDF } from "jspdf";
import type { FormInstance, FormSubmissionV2 } from "@/lbs/forms-v2/types";
import { collectSchemaFields } from "@/lbs/forms-v2/submissions/submissionAnswerRenderer";

const readAnswer = (value: unknown): string => {
  if (value == null) return "—";
  if (Array.isArray(value))
    return value.map((item) => readAnswer(item)).join(", ");
  if (typeof value === "object" && "url" in value) {
    return String(
      (value as { url?: string; name?: string }).name ??
        (value as { url?: string }).url ??
        "—",
    );
  }
  return String(value);
};

export const exportSubmissionPdf = (
  submission: FormSubmissionV2,
  form?: FormInstance | null,
) => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  let y = margin;
  const lineHeight = 16;
  const pageHeight = doc.internal.pageSize.getHeight();

  const writeln = (
    text: string,
    options?: { bold?: boolean; size?: number },
  ) => {
    const size = options?.size ?? 11;
    doc.setFontSize(size);
    doc.setFont("helvetica", options?.bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, 516);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  if (form?.logo_url) {
    writeln(form.name, { bold: true, size: 16 });
  } else {
    writeln(form?.name ?? "Form submission", { bold: true, size: 16 });
  }

  y += 4;
  writeln(`Submitted: ${submission.submitted_at ?? "—"}`);
  if (submission.submitter_name) writeln(`Name: ${submission.submitter_name}`);
  if (submission.submitter_email)
    writeln(`Email: ${submission.submitter_email}`);
  if (submission.submitter_phone)
    writeln(`Phone: ${submission.submitter_phone}`);
  if (submission.status) writeln(`Status: ${submission.status}`);

  y += 8;
  writeln("Answers", { bold: true, size: 13 });
  y += 4;

  const fields = collectSchemaFields(form?.schema);
  const answers = submission.answers ?? {};
  const entries = fields.length
    ? fields.map((field) => [field.label ?? field.key, answers[field.key]])
    : Object.entries(answers);

  for (const [label, value] of entries) {
    writeln(String(label), { bold: true });
    writeln(readAnswer(value));
    y += 4;
  }

  doc.save(`submission-${submission.id}.pdf`);
};
