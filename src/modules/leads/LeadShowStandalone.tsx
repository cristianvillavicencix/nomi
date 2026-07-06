import { ShowBase } from "ra-core";
import { LeadShowContent } from "@/modules/leads/LeadShowContent";
import type { LeadStageId } from "@/modules/leads/leadStages";

type LeadShowStandaloneProps = {
  contactId: string;
  kanbanStage?: LeadStageId | null;
};

export const LeadShowStandalone = ({
  contactId,
  kanbanStage = null,
}: LeadShowStandaloneProps) => (
  <ShowBase resource="contacts" id={contactId} key={contactId}>
    <LeadShowContent kanbanStage={kanbanStage} />
  </ShowBase>
);
