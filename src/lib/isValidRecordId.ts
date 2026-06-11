/** True when `id` is safe to pass to dataProvider.getOne / useGetOne. */
export const isValidRecordId = (id: unknown): id is string | number => {
  if (id == null) return false;
  if (typeof id === "number") return Number.isFinite(id);
  return String(id).trim().length > 0;
};
