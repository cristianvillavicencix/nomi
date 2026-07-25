import { createContext, useContext } from "react";
import type { Identifier } from "ra-core";
import type { MailComposeMode } from "./MailComposeDialog";
import type { MailThread } from "./types";

export type MailComposeOpenArgs = {
  mode?: MailComposeMode;
  initialTo?: string;
  initialCc?: string;
  initialBcc?: string;
  initialSubject?: string;
  initialBody?: string;
  initialQuotedHtml?: string | null;
  initialInReplyTo?: string;
  initialDraftId?: number | null;
  initialAccountId?: number;
  initialThreadId?: number;
  replyTo?: MailThread | null;
  contactId?: Identifier;
  companyId?: Identifier;
};

export type MailComposeContextValue = {
  composeOpen: boolean;
  openCompose: (args?: MailComposeOpenArgs) => void;
  closeCompose: () => void;
};

export const MailComposeContext = createContext<MailComposeContextValue | null>(
  null,
);

export const useMailCompose = () => {
  const context = useContext(MailComposeContext);
  if (!context) {
    throw new Error("useMailCompose must be used within MailComposeProvider");
  }
  return context;
};

export const useMailComposeOptional = () => useContext(MailComposeContext);
