import type { DealResource } from "@/modules/types";

export type BeforeAfterPairView = {
  id: string;
  description: string;
  before: DealResource | null;
  after: DealResource | null;
};

const parseBeforeAfterLabel = (label?: string | null) => {
  const raw = String(label ?? "").trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith("before")) {
    const description = raw.replace(/^before\s*[—–\-:]\s*/i, "").trim();
    return {
      type: "before" as const,
      description: description.toLowerCase() === "before" ? "" : description,
    };
  }
  if (lower.startsWith("after")) {
    const description = raw.replace(/^after\s*[—–\-:]\s*/i, "").trim();
    return {
      type: "after" as const,
      description: description.toLowerCase() === "after" ? "" : description,
    };
  }
  return { type: null, description: raw };
};

const resourceSortKey = (resource: DealResource) =>
  String(resource.created_at ?? resource.id ?? "");

/**
 * Group flat before/after deal_resources into one-to-one pairs.
 * Prefers matching by shared description (`Before — Kitchen` + `After — Kitchen`),
 * then zips remaining items by upload time.
 */
export const groupBeforeAfterResourcesIntoPairs = (
  items: DealResource[],
): BeforeAfterPairView[] => {
  const befores: Array<{ resource: DealResource; description: string }> = [];
  const afters: Array<{ resource: DealResource; description: string }> = [];
  const other: DealResource[] = [];

  for (const resource of items) {
    const parsed = parseBeforeAfterLabel(resource.label);
    if (parsed.type === "before") {
      befores.push({ resource, description: parsed.description });
    } else if (parsed.type === "after") {
      afters.push({ resource, description: parsed.description });
    } else {
      other.push(resource);
    }
  }

  befores.sort((a, b) =>
    resourceSortKey(a.resource).localeCompare(resourceSortKey(b.resource)),
  );
  afters.sort((a, b) =>
    resourceSortKey(a.resource).localeCompare(resourceSortKey(b.resource)),
  );

  const pairs: BeforeAfterPairView[] = [];
  const usedAfterIds = new Set<string>();

  for (const before of befores) {
    const matchIndex = afters.findIndex(
      (after) =>
        !usedAfterIds.has(String(after.resource.id)) &&
        after.description === before.description &&
        before.description !== "",
    );
    if (matchIndex >= 0) {
      const after = afters[matchIndex];
      usedAfterIds.add(String(after.resource.id));
      pairs.push({
        id: `pair-${before.resource.id}-${after.resource.id}`,
        description: before.description,
        before: before.resource,
        after: after.resource,
      });
      continue;
    }
    pairs.push({
      id: `pair-before-${before.resource.id}`,
      description: before.description,
      before: before.resource,
      after: null,
    });
  }

  const unmatchedAfters = afters.filter(
    (after) => !usedAfterIds.has(String(after.resource.id)),
  );

  // Zip leftover before-only pairs with unmatched afters (same upload batch / no caption).
  let afterCursor = 0;
  for (const pair of pairs) {
    if (pair.after || !pair.before) continue;
    if (pair.description) continue;
    const nextAfter = unmatchedAfters[afterCursor];
    if (!nextAfter) break;
    pair.after = nextAfter.resource;
    if (!pair.description) pair.description = nextAfter.description;
    pair.id = `pair-${pair.before.id}-${nextAfter.resource.id}`;
    usedAfterIds.add(String(nextAfter.resource.id));
    afterCursor += 1;
  }

  for (let index = afterCursor; index < unmatchedAfters.length; index += 1) {
    const after = unmatchedAfters[index];
    pairs.push({
      id: `pair-after-${after.resource.id}`,
      description: after.description,
      before: null,
      after: after.resource,
    });
  }

  for (const resource of other) {
    pairs.push({
      id: `pair-other-${resource.id}`,
      description: String(resource.label ?? "").trim(),
      before: resource,
      after: null,
    });
  }

  return pairs;
};
