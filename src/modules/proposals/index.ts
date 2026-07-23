import * as React from "react";

const ProposalsList = React.lazy(() =>
  import("./ProposalsList").then((m) => ({ default: m.ProposalsList })),
);
const ProposalCreate = React.lazy(() =>
  import("./ProposalCreate").then((m) => ({ default: m.ProposalCreate })),
);
const ProposalEdit = React.lazy(() =>
  import("./ProposalEdit").then((m) => ({ default: m.ProposalEdit })),
);
const ProposalViewPage = React.lazy(() =>
  import("./ProposalViewPage").then((m) => ({ default: m.ProposalViewPage })),
);

export default {
  list: ProposalsList,
  create: ProposalCreate,
  edit: ProposalEdit,
  show: ProposalViewPage,
};
