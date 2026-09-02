import { createContext, useContext } from "react";
import type {
  ActiveCallParty,
  IncomingCallerInfo,
  PlaceVoiceCallParams,
  VoiceCallState,
} from "@/modules/voice/voiceCallTypes";

export type VoiceCallContextValue = {
  callState: VoiceCallState;
  errorMessage: string | null;
  /** Truthy while an inbound invite is pending (Twilio or Telnyx). */
  incomingCall: unknown | null;
  incomingCallerLabel: string | null;
  incomingCallerInfo: IncomingCallerInfo | null;
  activeCallLabel: string | null;
  activeCallParty: ActiveCallParty | null;
  /** Epoch ms when the call became connected (`open`), or null. */
  callConnectedAt: number | null;
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  /** Selected microphone deviceId for the active / next call. */
  selectedMicrophoneId: string | null;
  setMicrophoneDevice: (deviceId: string) => Promise<void>;
  sendDigits: (digits: string) => void;
  callWorkspaceOpen: boolean;
  setCallWorkspaceOpen: (open: boolean) => void;
  placeCall: (params: PlaceVoiceCallParams) => Promise<void>;
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
