import { useEffect } from "react";
import type { VoiceCallState } from "@/modules/voice/voiceCallTypes";
import {
  startVoiceCallRingtone,
  stopVoiceCallRingtone,
  unlockVoiceCallAudio,
} from "@/modules/voice/voiceCallRingtone";

type UseVoiceCallRingtoneParams = {
  incomingCall: unknown;
  callState: VoiceCallState;
  activeCallLabel: string | null;
};

/**
 * Plays incoming ring and outbound ringback while calls are ringing.
 * Uses Web Audio so tones work even when Twilio cannot set output devices.
 */
export const useVoiceCallRingtone = ({
  incomingCall,
  callState,
  activeCallLabel,
}: UseVoiceCallRingtoneParams) => {
  useEffect(() => {
    const unlock = () => {
      void unlockVoiceCallAudio();
    };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (incomingCall) {
      void startVoiceCallRingtone("incoming");
      return () => stopVoiceCallRingtone();
    }
    return undefined;
  }, [incomingCall]);

  useEffect(() => {
    if (incomingCall) return undefined;

    const isOutboundRinging =
      activeCallLabel != null &&
      activeCallLabel !== "" &&
      (callState === "ringing" || callState === "connecting");

    if (isOutboundRinging) {
      void startVoiceCallRingtone("outbound");
      return () => stopVoiceCallRingtone();
    }

    if (callState !== "ringing" && callState !== "connecting") {
      stopVoiceCallRingtone();
    }
    return undefined;
  }, [activeCallLabel, callState, incomingCall]);
};
