const toNumericIdArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.map((item) => Number(item)).filter((item) => Number.isFinite(item)),
    ),
  );
};

export const syncTaskOwnerFromAssignees = (
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const assigneePersonIds = toNumericIdArray(data.assignee_person_ids);
  const assigneeSet = new Set(assigneePersonIds);
  const collaboratorPersonIds = toNumericIdArray(
    data.collaborator_person_ids,
  ).filter((id) => !assigneeSet.has(id));

  const ownerFromAssignees = assigneePersonIds[0];
  const legacyOwner = Number(data.organization_member_id);
  const organizationMemberId = Number.isFinite(ownerFromAssignees)
    ? ownerFromAssignees
    : Number.isFinite(legacyOwner)
      ? legacyOwner
      : null;

  const nextAssignees =
    assigneePersonIds.length > 0
      ? assigneePersonIds
      : organizationMemberId != null
        ? [organizationMemberId]
        : [];

  return {
    ...data,
    assignee_person_ids: nextAssignees,
    collaborator_person_ids: collaboratorPersonIds,
    organization_member_id: organizationMemberId,
  };
};
