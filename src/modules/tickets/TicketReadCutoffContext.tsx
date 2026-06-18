import { createContext, useContext } from "react";

export const TicketReadCutoffContext = createContext<string | null | undefined>(
  undefined,
);

export const useTicketReadCutoff = () => useContext(TicketReadCutoffContext);
