import { Star } from "lucide-react";
import type { FormFieldDef, FormSchemaV2 } from "@/lbs/forms-v2/types";

const readString = (value: unknown): string => {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

const RatingStars = ({ value, max = 5 }: { value: number; max?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: max }, (_, index) => (
      <Star
        key={index}
        className={
          index < value
            ? "size-4 fill-amber-400 text-amber-400"
            : "size-4 text-muted-foreground/40"
        }
      />
    ))}
  </div>
);

const FileAnswer = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.map((item, index) => (
          <li key={index}>
            <FileAnswer value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (value && typeof value === "object" && "url" in value) {
    const file = value as { url?: string; name?: string };
    if (!file.url) return <span>—</span>;
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline"
      >
        {file.name || file.url}
      </a>
    );
  }

  if (typeof value === "string" && value.startsWith("http")) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline"
      >
        {value}
      </a>
    );
  }

  return <span>{readString(value) || "—"}</span>;
};

export const collectSchemaFields = (schema?: FormSchemaV2): FormFieldDef[] => {
  const fields: FormFieldDef[] = [];
  for (const section of schema?.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.type !== "hidden") {
        fields.push(field);
      }
    }
  }
  return fields;
};

export const SubmissionAnswerList = ({
  schema,
  answers = {},
}: {
  schema?: FormSchemaV2;
  answers?: Record<string, unknown>;
}) => {
  const fields = collectSchemaFields(schema);
  const answerKeys = new Set([
    ...fields.map((field) => field.key),
    ...Object.keys(answers),
  ]);

  if (answerKeys.size === 0) {
    return (
      <p className="text-sm text-muted-foreground">No answers recorded.</p>
    );
  }

  const rendered = fields.length
    ? fields.filter((field) => field.key in answers)
    : [...answerKeys].map((key) => ({ key, label: key, type: "text" }));

  return (
    <dl className="space-y-4">
      {rendered.map((field) => {
        const value = answers[field.key];
        const label = field.label ?? field.key;
        return (
          <div key={field.key} className="rounded-lg border p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-2 text-sm">
              {field.type === "rating" ? (
                <RatingStars value={Number(value) || 0} max={field.max ?? 5} />
              ) : field.type === "file" ||
                field.type === "file_multi" ||
                field.type === "signature" ? (
                <FileAnswer value={value} />
              ) : field.type === "textarea" ? (
                <pre className="whitespace-pre-wrap font-sans">
                  {readString(value)}
                </pre>
              ) : (
                readString(value) || "—"
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
};
