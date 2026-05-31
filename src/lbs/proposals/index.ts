import { ProposalCreate } from "./ProposalCreate";
import { ProposalEdit } from "./ProposalEdit";
import { ProposalShow } from "./ProposalShow";
import { ProposalsList } from "./ProposalsList";

export default {
  list: ProposalsList,
  create: ProposalCreate,
  edit: ProposalEdit,
  show: ProposalShow,
};

export { ProposalsList, ProposalCreate, ProposalEdit, ProposalShow };
