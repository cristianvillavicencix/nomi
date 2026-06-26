import { lbsProjectTypeChoices } from "@/modules/deals/lbsProjectConstants";

const projectTypeLabel = (projectType?: string | null) => {
  if (!projectType) return "";
  return (
    lbsProjectTypeChoices.find((choice) => choice.value === projectType)
      ?.label ?? projectType.replace(/-/g, " ")
  );
};

export const buildAutoProjectName = ({
  companyName,
  contactName,
  projectType,
  proposalTitle,
}: {
  companyName?: string | null;
  contactName?: string | null;
  projectType?: string | null;
  proposalTitle?: string | null;
}) => {
  const client = companyName?.trim() || contactName?.trim() || "";
  if (!client) return "";

  const proposal = proposalTitle?.trim();
  if (proposal) return `${client} — ${proposal}`;

  const service = projectTypeLabel(projectType);
  return service ? `${client} — ${service}` : client;
};
