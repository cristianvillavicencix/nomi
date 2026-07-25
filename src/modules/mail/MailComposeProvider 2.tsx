import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MailComposeDialog,
  type MailComposeMode,
} from "./MailComposeDialog";
import {
  MailComposeContext,
  type MailComposeContextValue,
  type MailComposeOpenArgs,
} from "./mailComposeContext";
import { useMailAccounts } from "./useMailAccounts";
import type { MailThread } from "./types";

export {
  useMailCompose,
  useMailComposeOptional,
} from "./mailComposeContext";

const defaultComposeState = {
  mode: "new" as MailComposeMode,
  initialTo: "",
  initialCc: "",
  initialSubject: "",
  initialBody: "<p><br></p>",
  initialQuotedHtml: null as string | null,
  initialInReplyTo: undefined as string | undefined,
  initialDraftId: null as number | null,
  initialAccountId: undefined as number | undefined,
  initialThreadId: undefined as number | undefined,
  replyTo: null as MailThread | null,
};

export const MailComposeProvider = ({ children }: { children: ReactNode }) => {
  const { data: accounts = [] } = useMailAccounts();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeState, setComposeState] = useState(defaultComposeState);

  const openCompose = useCallback((args: MailComposeOpenArgs = {}) => {
    setComposeState({
      mode: args.mode ?? "new",
      initialTo: args.initialTo ?? "",
      initialCc: args.initialCc ?? "",
      initialSubject: args.initialSubject ?? "",
      initialBody: args.initialBody ?? "<p><br></p>",
      initialQuotedHtml: args.initialQuotedHtml ?? null,
      initialInReplyTo: args.initialInReplyTo,
      initialDraftId: args.initialDraftId ?? null,
      initialAccountId: args.initialAccountId,
      initialThreadId: args.initialThreadId,
      replyTo: args.replyTo ?? null,
    });
    setComposeOpen(true);
  }, []);

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
    setComposeState((prev) => ({
      ...defaultComposeState,
      replyTo: prev.replyTo,
    }));
  }, []);

  const value = useMemo<MailComposeContextValue>(
    () => ({
      composeOpen,
      openCompose,
      closeCompose,
    }),
    [closeCompose, composeOpen, openCompose],
  );

  return (
    <MailComposeContext.Provider value={value}>
      {children}
      <MailComposeDialog
        open={composeOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeCompose();
          } else {
            setComposeOpen(true);
          }
        }}
        accounts={accounts}
        replyTo={composeState.replyTo}
        mode={composeState.mode}
        initialTo={composeState.initialTo}
        initialCc={composeState.initialCc}
        initialSubject={composeState.initialSubject}
        initialBody={composeState.initialBody}
        initialQuotedHtml={composeState.initialQuotedHtml}
        initialInReplyTo={composeState.initialInReplyTo}
        initialDraftId={composeState.initialDraftId}
        initialAccountId={composeState.initialAccountId}
        initialThreadId={composeState.initialThreadId}
      />
    </MailComposeContext.Provider>
  );
};
