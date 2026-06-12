import { ProjectTeamChat } from "@/modules/messages/ProjectTeamChat";
import type { LbsDeal } from "@/modules/types";

export const ProjectContextPanel = ({ record }: { record: LbsDeal }) => (
  <ProjectTeamChat record={record} variant="sidebar" />
);
