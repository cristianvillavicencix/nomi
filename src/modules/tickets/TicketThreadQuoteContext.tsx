import { createContext, useContext, type ReactNode } from "react";

type TicketThreadQuoteContextValue = {
  quoteMessage: (plainText: string) => void;
};

const TicketThreadQuoteContext =
  createContext<TicketThreadQuoteContextValue | null>(null);

export const TicketThreadQuoteProvider = ({
  children,
  onQuote,
}: {
  children: ReactNode;
  onQuote: (plainText: string) => void;
}) => (
  <TicketThreadQuoteContext.Provider value={{ quoteMessage: onQuote }}>
    {children}
  </TicketThreadQuoteContext.Provider>
);

export const useTicketThreadQuote = () => useContext(TicketThreadQuoteContext);
