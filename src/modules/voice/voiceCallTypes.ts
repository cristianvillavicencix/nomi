import type { Identifier } from "ra-core";

export type IncomingCallerInfo = {
  phoneE164: string | null;
  displayPhone: string;
  contactId?: Identifier;
  contactName?: string | null;
  companyName?: string | null;
  isKnownContact: boolean;
  isLookupPending: boolean;
};

/** Party linked to the active outbound/inbound call (for the in-call workspace). */
export type ActiveCallParty = {
  phoneLabel: string;
  contactId?: Identifier | null;
  conversationId?: Identifier | null;
  dealId?: Identifier | null;
  contactName?: string | null;
  companyName?: string | null;
};

export type VoiceCallState =
  | "idle"
  | "initializing"
  | "connecting"
  | "ringing"
  | "open"
  | "error";

export type PlaceVoiceCallParams = {
  to: string;
  contactId?: Identifier | null;
  conversationId?: Identifier | null;
  dealId?: Identifier | null;
};
