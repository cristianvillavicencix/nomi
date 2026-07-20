import { createContext, useContext } from "react";
import type { Call } from "@twilio/voice-sdk";
import type {
  ActiveCallParty,
  IncomingCallerInfo,
  PlaceVoiceCallParams,
  VoiceCallState,
} from "@/modules/voice/voiceCallTypes";

export type VoiceCallContextValue = {
  callState: VoiceCallState;
  errorMessage: string | null;
  incomingCall: Call | null;
  incomingCallerLabel: string | null;
  incomingCallerInfo: IncomingCallerInfo | null;
  activeCallLabel: string | null;
  activeCallParty: ActiveCallParty | null;
  /** Epoch ms when the call became connected (`open`), or null. */
  callConnectedAt: number | null;
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  sendDigits: (digits: string) => void;
  callWorkspaceOpen: boolean;
  setCallWorkspaceOpen: (open: boolean) => void;
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

export const VoiceCallContext = createContext<VoiceCallContextValue | null>(
  null,
);

export const useVoiceCallContext = () => {
  const context = useContext(VoiceCallContext);
  if (!context) {
    throw new Error(
      "useVoiceCallContext must be used within VoiceCallProvider",
    );
  }
  return context;
};

export const useVoiceCallContextOptional = () => useContext(VoiceCallContext);
