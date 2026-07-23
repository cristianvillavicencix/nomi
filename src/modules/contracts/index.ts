import * as React from "react";

const ContractsList = React.lazy(() =>
  import("./ContractsList").then((m) => ({ default: m.ContractsList })),
);
const ContractShow = React.lazy(() =>
  import("./ContractShow").then((m) => ({ default: m.ContractShow })),
);

export default {
  list: ContractsList,
  show: ContractShow,
};
