import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PROPOSAL_LOCALE_KEY,
  type ProposalLocale,
} from "@/lbs/proposals/document/proposalDocumentI18n";

const readStoredLocale = (): ProposalLocale => {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(PROPOSAL_LOCALE_KEY);
  return stored === "es" ? "es" : "en";
};

const ProposalLocaleContext = createContext<{
  locale: ProposalLocale;
  setLocale: (locale: ProposalLocale) => void;
} | null>(null);

export const ProposalLocaleProvider = ({
  children,
  defaultLocale,
}: {
  children: ReactNode;
  defaultLocale?: ProposalLocale;
}) => {
  const [locale, setLocaleState] = useState<ProposalLocale>(
    () => defaultLocale ?? readStoredLocale(),
  );

  const setLocale = useCallback((next: ProposalLocale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROPOSAL_LOCALE_KEY, next);
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <ProposalLocaleContext.Provider value={value}>
      {children}
    </ProposalLocaleContext.Provider>
  );
};

export const useProposalLocale = () => {
  const context = useContext(ProposalLocaleContext);
  if (!context) {
    throw new Error("useProposalLocale must be used within ProposalLocaleProvider");
  }
  return context;
};

/** Optional locale when document is rendered outside provider (staff editor). */
export const useProposalLocaleOptional = () => useContext(ProposalLocaleContext);
