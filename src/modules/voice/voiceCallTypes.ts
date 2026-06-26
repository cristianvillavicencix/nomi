import type { Identifier } from "ra-core";

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
