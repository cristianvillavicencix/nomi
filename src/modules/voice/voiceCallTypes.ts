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
