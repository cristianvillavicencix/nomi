import { groupBeforeAfterResourcesIntoPairs } from "../beforeAfterResourcePairs";
import type { DealResource } from "@/modules/types";

describe("groupBeforeAfterResourcesIntoPairs", () => {
  const resource = (
    id: number,
    label: string,
    createdAt = `2026-01-0${id}T00:00:00Z`,
  ): DealResource =>
    ({
      id,
      label,
      created_at: createdAt,
      file: { title: label, type: "image/jpeg", path: `${id}.jpg`, src: "" },
    }) as DealResource;

  it("pairs matching descriptions one-to-one", () => {
    const pairs = groupBeforeAfterResourcesIntoPairs([
      resource(1, "Before — Kitchen remodel"),
      resource(2, "After — Kitchen remodel"),
      resource(3, "Before — Deck"),
      resource(4, "After — Deck"),
    ]);

    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatchObject({
      description: "Kitchen remodel",
      before: { id: 1 },
      after: { id: 2 },
    });
    expect(pairs[1]).toMatchObject({
      description: "Deck",
      before: { id: 3 },
      after: { id: 4 },
    });
  });

  it("zips plain Before/After labels by upload order", () => {
    const pairs = groupBeforeAfterResourcesIntoPairs([
      resource(1, "Before"),
      resource(2, "After"),
      resource(3, "Before"),
    ]);

    expect(pairs).toHaveLength(2);
    expect(pairs[0].before?.id).toBe(1);
    expect(pairs[0].after?.id).toBe(2);
    expect(pairs[1].before?.id).toBe(3);
    expect(pairs[1].after).toBeNull();
  });
});
