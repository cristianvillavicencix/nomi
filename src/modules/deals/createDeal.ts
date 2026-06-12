import type { Identifier } from "ra-core";

import { normalizeProjectPayload } from "@/components/atomic-crm/deals/projectForm";
import type { ConfigurationContextValue } from "@/components/atomic-crm/root/ConfigurationContext";
import { getDefaultPipeline } from "@/components/atomic-crm/deals/pipelines";
import {
  deliveryStatusForStage,
  LBS_DEFAULT_AGENCY_STAGE,
  LBS_DEFAULT_LIFECYCLE_PHASE,
  LBS_DEFAULT_PROJECT_PRIORITY,
  type LbsLifecyclePhase,
} from "@/modules/deals/lbsAgencyProjectModel";
import { LBS_DEFAULT_PROJECT_CATEGORY } from "@/modules/deals/lbsProjectConstants";

export type CreateDealPayload = {
  name: string;
  companyId: Identifier;
  contactId?: Identifier | null;
  organizationMemberId: Identifier;
  orgId?: Identifier | null;
  stage?: string;
  lifecyclePhase?: LbsLifecyclePhase;
  amount?: number | null;
  estimatedValue?: number | null;
  projectType?: string | null;
  expectedClosingDate?: string | null;
  notes?: string | null;
  convertedFromContactId?: Identifier | null;
  pipelineId?: string;
  category?: string;
  index?: number;
};

export const getDefaultDealStage = (
  config: Pick<ConfigurationContextValue, "dealPipelines" | "dealStages">,
) => {
  const defaultPipeline = getDefaultPipeline(config);
  const firstStage = defaultPipeline?.stages[0]?.id;
  return firstStage ?? config.dealStages[0]?.value ?? LBS_DEFAULT_AGENCY_STAGE;
};

export const buildDealInsertRecord = (payload: CreateDealPayload) => {
  const contactId = payload.contactId ?? null;
  const amount = payload.amount ?? payload.estimatedValue ?? 0;
  const estimatedValue = payload.estimatedValue ?? payload.amount ?? 0;
  const stage = payload.stage ?? LBS_DEFAULT_AGENCY_STAGE;

  return {
    name: payload.name.trim(),
    stage,
    lifecycle_phase: payload.lifecyclePhase ?? LBS_DEFAULT_LIFECYCLE_PHASE,
    amount,
    estimated_value: estimatedValue,
    company_id: payload.companyId,
    contact_id: contactId,
    contact_ids: contactId != null ? [String(contactId)] : [],
    project_type: payload.projectType ?? null,
    organization_member_id: payload.organizationMemberId,
    org_id: payload.orgId ?? null,
    converted_from_contact_id: payload.convertedFromContactId ?? null,
    expected_closing_date: payload.expectedClosingDate ?? null,
    notes: payload.notes ?? null,
    description: payload.notes?.trim() ? payload.notes.trim() : "",
    pipeline_id: payload.pipelineId ?? "default",
    category: payload.category ?? LBS_DEFAULT_PROJECT_CATEGORY,
    index: payload.index ?? 0,
    delivery_status: deliveryStatusForStage(stage),
    priority: LBS_DEFAULT_PROJECT_PRIORITY,
    subcontractor_ids: [],
    worker_ids: [],
    salesperson_ids: [],
  };
};

export const buildNormalizedDealInsertRecord = (payload: CreateDealPayload) =>
  normalizeProjectPayload(buildDealInsertRecord(payload));
