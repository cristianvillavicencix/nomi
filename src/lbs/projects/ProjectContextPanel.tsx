import { ProjectTeamChat } from "@/lbs/messages/ProjectTeamChat";
import type { LbsDeal } from "@/lbs/types";

export const ProjectContextPanel = ({ record }: { record: LbsDeal }) => (
  <ProjectTeamChat record={record} variant="sidebar" />
);
