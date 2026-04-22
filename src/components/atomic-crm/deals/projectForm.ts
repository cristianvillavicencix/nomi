type GenericRecord = Record<string, unknown>;

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumericArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
};

export const normalizeProjectPayload = <T extends GenericRecord>(
  rawData: T,
): GenericRecord => {
  const data = { ...rawData };

  const contactId = toNumber(data.contact_id);
  const contactIds = toNumericArray(data.contact_ids);
  if (contactId != null) {
    data.contact_ids = [contactId];
  } else if (contactIds.length > 0) {
    data.contact_ids = [contactIds[0]];
    data.contact_id = contactIds[0];
  }

  const estimatedValue = toNumber(data.estimated_value);
  const originalProjectValue = toNumber(data.original_project_value);
  const currentProjectValue = toNumber(data.current_project_value);
  const amount = toNumber(data.amount);
  if (estimatedValue != null) {
    data.estimated_value = estimatedValue;
    data.amount = estimatedValue;
    if (originalProjectValue == null) {
      data.original_project_value = estimatedValue;
    }
  } else if (amount != null) {
    data.amount = amount;
    data.estimated_value = amount;
    if (originalProjectValue == null) {
      data.original_project_value = amount;
    }
  }
  if (currentProjectValue == null) {
    data.current_project_value = toNumber(data.original_project_value) ?? toNumber(data.amount);
  }
  if (typeof data.value_includes_material === "string") {
    data.value_includes_material = data.value_includes_material === "true";
  }

  const notes = typeof data.notes === "string" ? data.notes : undefined;
  const description =
    typeof data.description === "string" ? data.description : undefined;
  if (notes != null && notes !== "") {
    data.description = notes;
  } else if (description != null && description !== "") {
    data.notes = description;
  }

  if (!data.pipeline_id) {
    data.pipeline_id = "default";
  }

  data.salesperson_ids = toNumericArray(data.salesperson_ids);
  data.subcontractor_ids = toNumericArray(data.subcontractor_ids);

  if (!data.index) {
    data.index = 0;
  }

  return data;
};
