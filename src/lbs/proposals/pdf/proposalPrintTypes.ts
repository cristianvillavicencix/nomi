import type { ProposalTimelineBar } from "@/lbs/proposals/document/proposalDocumentTypes";

export type ProposalPrintLineItem = {
  description: string;
  sublabel?: string;
  amount: string;
  isRecurring?: boolean;
};

export type ProposalPrintInstallment = {
  badge: string;
  label: string;
  sublabel: string;
  amount: string;
};

export type ProposalPrintTimelineBar = {
  label: string;
  weekLabel: string;
  leftPercent: number;
  widthPercent: number;
  tone: ProposalTimelineBar["tone"];
};

/** Structured blocks rendered after section markdown (stats, team, timeline, etc.). */
export type ProposalPrintBlock =
  | { type: "stats"; rows: { value: string; label: string }[] }
  | {
      type: "team";
      members: { name: string; role: string; bio?: string }[];
    }
  | { type: "client_logos"; logos: { name?: string }[] }
  | { type: "portfolio"; items: { title: string; subtitle: string }[] }
  | { type: "reviews"; items: { rating: number; text: string; author: string }[] }
  | { type: "timeline"; bars: ProposalPrintTimelineBar[] };

export type ProposalPrintSection = {
  kicker: string;
  title: string;
  /** Section body markdown — same pipeline as contract terms. */
  bodyMarkdown: string;
  blocks: ProposalPrintBlock[];
};

export type ProposalPrintModel = {
  locale: "en" | "es";
  filenameBase: string;
  hero: {
    tag: string;
    title: string;
    subtitle: string;
    meta: { label: string; value: string }[];
  };
  intro: {
    title: string;
    bodyMarkdown: string;
    signatory?: string;
    signatoryOrg?: string;
  };
  sections: ProposalPrintSection[];
  investment: {
    kicker: string;
    title: string;
    notes?: string;
    packageLine?: ProposalPrintLineItem;
    lineItems: ProposalPrintLineItem[];
    oneTimeLabel: string;
    oneTimeAmount: string;
    recurringLabel?: string;
    recurringAmount?: string;
    grandLabel: string;
    grandAmount: string;
    paymentsTitle: string;
    installments: ProposalPrintInstallment[];
    paymentNotes?: string;
    warranty?: { title: string; bodyMarkdown: string };
  };
  terms?: { title: string; markdown: string };
  accept: { kicker: string; title: string; bodyMarkdown: string; pdfNote: string };
};
