import {
  deliveryStatusForStage,
  LBS_DEFAULT_LIFECYCLE_PHASE,
  LBS_DEFAULT_PROJECT_PRIORITY,
  normalizeAgencyProjectType,
} from "@/lbs/deals/lbsAgencyProjectModel";
import { normalizeGithubRepoInput } from "@/lbs/deals/githubRepo";
import { normalizeLbsProjectStage } from "@/lbs/deals/lbsProjectConstants";
import { isLbsMode } from "@/lbs/productMode";

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

  if (isLbsMode()) {
    if (estimatedValue != null) {
      data.estimated_value = estimatedValue;
      data.amount = estimatedValue;
    } else if (amount != null) {
      data.amount = amount;
      data.estimated_value = amount;
    }
    if (typeof data.project_type === "string") {
      data.project_type = normalizeAgencyProjectType(data.project_type);
    }
    data.lifecycle_phase = LBS_DEFAULT_LIFECYCLE_PHASE;
    data.delivery_status =
      typeof data.delivery_status === "string" && data.delivery_status
        ? data.delivery_status
        : deliveryStatusForStage(
            typeof data.stage === "string" ? data.stage : undefined,
          );
    data.priority =
      typeof data.priority === "string" && data.priority
        ? data.priority
        : LBS_DEFAULT_PROJECT_PRIORITY;
    data.subcontractor_ids = [];
    data.worker_ids = [];
  } else {
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
      data.current_project_value =
        toNumber(data.original_project_value) ?? toNumber(data.amount);
    }
    if (typeof data.value_includes_material === "string") {
      data.value_includes_material = data.value_includes_material === "true";
    }
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

  if (isLbsMode() && typeof data.stage === "string") {
    data.stage = normalizeLbsProjectStage(data.stage);
  }

  if (typeof data.github_repo === "string") {
    data.github_repo = normalizeGithubRepoInput(data.github_repo);
  }

  data.salesperson_ids = toNumericArray(data.salesperson_ids);
  if (!isLbsMode()) {
    data.subcontractor_ids = toNumericArray(data.subcontractor_ids);
  }

  if (!data.index) {
    data.index = 0;
  }

  return data;
};
