import { ModulePlaceholderPage } from "@/lbs/ModulePlaceholderPage";
import { LBS_PLACEHOLDER_MODULES } from "@/lbs/navigation";

export const ProposalsPlaceholderPage = () => (
  <ModulePlaceholderPage {...LBS_PLACEHOLDER_MODULES.proposals} />
);

export const ContractsPlaceholderPage = () => (
  <ModulePlaceholderPage {...LBS_PLACEHOLDER_MODULES.contracts} />
);

export const WebFormsPlaceholderPage = () => (
  <ModulePlaceholderPage {...LBS_PLACEHOLDER_MODULES.webForms} />
);

export const TicketsPlaceholderPage = () => (
  <ModulePlaceholderPage {...LBS_PLACEHOLDER_MODULES.tickets} />
);
