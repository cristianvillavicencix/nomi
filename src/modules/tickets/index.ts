import * as React from "react";

const TicketsOverview = React.lazy(() =>
  import("./TicketsOverview").then((m) => ({ default: m.TicketsOverview })),
);
const TicketShow = React.lazy(() =>
  import("./TicketShow").then((m) => ({ default: m.TicketShow })),
);

export default {
  list: TicketsOverview,
  show: TicketShow,
};
