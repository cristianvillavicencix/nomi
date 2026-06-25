/** True when `id` is safe to pass to dataProvider.getOne / useGetOne. */
export const isValidRecordId = (id: unknown): id is string | number => {
  if (id == null) return false;
  if (typeof id === "number") {
    return Number.isFinite(id) && id > 0;
  }
  const trimmed = String(id).trim();
  if (!trimmed) return false;
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed)) {
    return parsed > 0;
  }
  return trimmed.length > 0;
};
