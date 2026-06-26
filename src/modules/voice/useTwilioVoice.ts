import { useVoiceCallContextOptional } from "@/modules/voice/voiceCallContext";
import type { PlaceVoiceCallParams, VoiceCallState } from "@/modules/voice/voiceCallTypes";

const idleVoice = {
  callState: "idle" as VoiceCallState,
  errorMessage: null as string | null,
  placeCall: async () => {
    throw new Error("Voice calling is not available");
  },
  hangUp: () => undefined,
  isBusy: false,
};

export type { PlaceVoiceCallParams, VoiceCallState };

export const useTwilioVoice = (enabled: boolean) => {
  const voice = useVoiceCallContextOptional();

  if (!enabled || !voice) {
    return idleVoice;
  }

  return {
    callState: voice.callState,
    errorMessage: voice.errorMessage,
    placeCall: voice.placeCall,
    hangUp: voice.hangUp,
    isBusy: voice.isBusy,
  };
};
