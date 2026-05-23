import type { DataProvider, Identifier } from "ra-core";
import { isLbsMode } from "@/lbs/productMode";

const toNumericIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
};

const syncManyToMany = async (
  dataProvider: DataProvider,
  resource: "deal_salespersons" | "deal_subcontractors",
  dealId: Identifier,
  personIds: unknown,
) => {
  const normalizedPersonIds = Array.from(new Set(toNumericIds(personIds)));

  const existing = await dataProvider.getList<{ id: Identifier }>(resource, {
    filter: { "deal_id@eq": dealId },
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
  });

  if (existing.data.length > 0) {
    await dataProvider.deleteMany(resource, {
      ids: existing.data.map((item) => item.id),
    });
  }

  await Promise.all(
    normalizedPersonIds.map((personId) =>
      dataProvider.create(resource, {
        data: {
          deal_id: dealId,
          person_id: personId,
        },
      }),
    ),
  );
};

/**
 * @deprecated LBS stores assignments in deals.salesperson_ids[]. Contractor mode
 * still syncs people junction tables via this helper.
 */
export const syncProjectAssignments = async (
  dataProvider: DataProvider,
  dealId: Identifier,
  salespersonIds: unknown,
  subcontractorIds: unknown,
) => {
  // LBS stores org member ids in deals.salesperson_ids[] — no people junction.
  if (isLbsMode()) {
    return;
  }

  await Promise.all([
    syncManyToMany(dataProvider, "deal_salespersons", dealId, salespersonIds),
    syncManyToMany(
      dataProvider,
      "deal_subcontractors",
      dealId,
      subcontractorIds,
    ),
  ]);
};
