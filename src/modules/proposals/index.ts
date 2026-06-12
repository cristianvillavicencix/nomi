import { ProposalCreate } from "./ProposalCreate";
import { ProposalEdit } from "./ProposalEdit";
import { ProposalViewPage } from "./ProposalViewPage";
import { ProposalsList } from "./ProposalsList";

export default {
  list: ProposalsList,
  create: ProposalCreate,
  edit: ProposalEdit,
  show: ProposalViewPage,
};

export { ProposalsList, ProposalCreate, ProposalEdit, ProposalViewPage };
