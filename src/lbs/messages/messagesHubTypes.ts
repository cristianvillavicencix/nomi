export type InboxTab =
  | "all"
  | "sms"
  | "whatsapp"
  | "calls"
  | "team"
  | "mine"
  | "unread";

export type InboxFilterState = {
  status: string | "all";
  assigneeMemberId: string | "all" | "mine";
  tag: string | "all";
  query: string;
};

export const DEFAULT_INBOX_FILTERS: InboxFilterState = {
  status: "all",
  assigneeMemberId: "all",
  tag: "all",
  query: "",
};
