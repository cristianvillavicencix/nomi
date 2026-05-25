import type { FormSchemaV2 } from "@/lbs/forms-v2/types";

export type SchemaDiffEntry = {
  kind: "added" | "removed" | "changed";
  path: string;
  detail?: string;
};

const collectFieldPaths = (schema: FormSchemaV2 | undefined): Map<string, string> => {
  const paths = new Map<string, string>();
  for (const section of schema?.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (!field.key) continue;
      paths.set(field.key, `${section.title || section.id} → ${field.label || field.key}`);
    }
  }
  return paths;
};

export const diffFormSchemas = (
  current: FormSchemaV2 | undefined,
  previous: FormSchemaV2 | undefined,
): SchemaDiffEntry[] => {
  const currentFields = collectFieldPaths(current);
  const previousFields = collectFieldPaths(previous);
  const diff: SchemaDiffEntry[] = [];

  for (const [key, label] of currentFields.entries()) {
    if (!previousFields.has(key)) {
      diff.push({ kind: "added", path: label, detail: key });
    }
  }

  for (const [key, label] of previousFields.entries()) {
    if (!currentFields.has(key)) {
      diff.push({ kind: "removed", path: label, detail: key });
    }
  }

  const currentSectionCount = current?.sections?.length ?? 0;
  const previousSectionCount = previous?.sections?.length ?? 0;
  if (currentSectionCount !== previousSectionCount) {
    diff.push({
      kind: "changed",
      path: "Sections",
      detail: `${previousSectionCount} → ${currentSectionCount}`,
    });
  }

  return diff;
};

export const summarizeSchemaDiff = (entries: SchemaDiffEntry[]): string[] => {
  if (entries.length === 0) return ["No structural changes detected"];
  return entries.slice(0, 8).map((entry) => {
    if (entry.kind === "added") return `Added ${entry.path}`;
    if (entry.kind === "removed") return `Removed ${entry.path}`;
    return `Changed ${entry.path}${entry.detail ? `: ${entry.detail}` : ""}`;
  });
};
