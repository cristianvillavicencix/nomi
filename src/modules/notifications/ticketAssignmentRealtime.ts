/** True when Realtime old/new rows show a real assignee change. */
export const ticketAssigneeChanged = (
  next: { assignee_id?: unknown } | null | undefined,
  previous: Record<string, unknown> | null | undefined,
) => {
  if (!next) return false;
  // PK-only replica identity omits assignee_id on UPDATE old rows.
  if (previous == null || !Object.hasOwn(previous, "assignee_id")) {
    return false;
  }
  return String(next.assignee_id ?? "") !== String(previous.assignee_id ?? "");
};
