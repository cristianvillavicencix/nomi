import { createContext, useContext, type ReactNode } from "react";
import type { TicketMessage } from "@/modules/types";

type TicketThreadQuoteContextValue = {
  quoteMessage: (message: TicketMessage) => void;
};

const TicketThreadQuoteContext =
  createContext<TicketThreadQuoteContextValue | null>(null);

export const TicketThreadQuoteProvider = ({
  children,
  onQuote,
}: {
  children: ReactNode;
  onQuote: (message: TicketMessage) => void;
}) => (
  <TicketThreadQuoteContext.Provider value={{ quoteMessage: onQuote }}>
    {children}
  </TicketThreadQuoteContext.Provider>
);

export const useTicketThreadQuote = () => useContext(TicketThreadQuoteContext);
