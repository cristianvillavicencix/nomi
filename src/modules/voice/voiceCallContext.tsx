import { createContext, useContext } from "react";
import type { Call } from "@twilio/voice-sdk";
import type { VoiceCallState, PlaceVoiceCallParams, IncomingCallerInfo } from "@/modules/voice/voiceCallTypes";

export type VoiceCallContextValue = {
  callState: VoiceCallState;
  errorMessage: string | null;
  incomingCall: Call | null;
  incomingCallerLabel: string | null;
  incomingCallerInfo: IncomingCallerInfo | null;
  activeCallLabel: string | null;
  placeCall: (params: PlaceVoiceCallParams) => Promise<Call>;
  hangUp: () => void;
  acceptIncoming: () => void;
  rejectIncoming: () => void;
  dismissIncomingUi: () => void;
  expandIncomingUi: () => void;
  incomingUiMinimized: boolean;
  isBusy: boolean;
  isRegistered: boolean;
};

export const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

export const useVoiceCallContext = () => {
  const context = useContext(VoiceCallContext);
  if (!context) {
    throw new Error("useVoiceCallContext must be used within VoiceCallProvider");
  }
  return context;
};

export const useVoiceCallContextOptional = () =>
  useContext(VoiceCallContext);
