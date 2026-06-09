import type { DataProvider, Identifier } from "ra-core";

/**
 * @deprecated LBS stores salesperson assignments in deals.salesperson_ids[].
 * Contractor people junction tables were removed in product-mode cleanup.
 */
export const syncProjectAssignments = async (
  _dataProvider: DataProvider,
  _dealId: Identifier,
  _salespersonIds: unknown,
  _subcontractorIds: unknown,
) => undefined;
