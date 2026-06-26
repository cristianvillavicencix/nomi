import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Device, type Call } from "@twilio/voice-sdk";
import { useDataProvider, useGetIdentity } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { normalizeUsPhoneToE164, formatUsPhoneDisplayFromAny } from "@/utils/phone";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import {
  VoiceCallContext,
  type VoiceCallContextValue,
} from "@/modules/voice/voiceCallContext";
import { IncomingCallDialog } from "@/modules/voice/IncomingCallDialog";
import { IncomingCallBanner } from "@/modules/voice/IncomingCallBanner";
import { ActiveCallBar } from "@/modules/voice/ActiveCallBar";
import type {
  IncomingCallerInfo,
  PlaceVoiceCallParams,
  VoiceCallState,
} from "@/modules/voice/voiceCallTypes";
import { useVoiceCallRingtone } from "@/modules/voice/useVoiceCallRingtone";
import { stopVoiceCallRingtone, unlockVoiceCallAudio } from "@/modules/voice/voiceCallRingtone";
import {
  formatCallerPhoneLabel,
  resolveIncomingCallerPhone,
} from "@/modules/voice/voiceCallerUtils";

const emptyIncomingCallerInfo = (
  params: Record<string, string | undefined>,
): IncomingCallerInfo => {
  const phoneE164 = resolveIncomingCallerPhone(params);
  const displayPhone = formatCallerPhoneLabel(params);
  return {
    phoneE164,
    displayPhone,
    isKnownContact: false,
    isLookupPending: Boolean(phoneE164),
  };
};

export const VoiceCallProvider = ({ children }: { children: ReactNode }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const { voiceEnabled, isPending } = useMessagingEnabled();
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  const [callState, setCallState] = useState<VoiceCallState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [incomingCallerLabel, setIncomingCallerLabel] = useState<string | null>(
    null,
  );
  const [incomingCallerInfo, setIncomingCallerInfo] =
    useState<IncomingCallerInfo | null>(null);
  const [incomingUiMinimized, setIncomingUiMinimized] = useState(false);
  const [activeCallLabel, setActiveCallLabel] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  const canUseVoice = hasMemberCapability(
    identity as AccessIdentity | undefined,
    "voice.calls.make",
  );

  const hasLiveCall = useCallback(
    () => Boolean(activeCallRef.current || incomingCallRef.current),
    [],
  );

  const shouldRegister =
    voiceEnabled &&
    canUseVoice &&
    !!identity?.id &&
    (!isPending || isRegistered || hasLiveCall());

  useVoiceCallRingtone({ incomingCall, callState, activeCallLabel });

  const invalidateCallHistory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["voice_calls"] });
  }, [queryClient]);

  const destroyDevice = useCallback(
    (options?: { force?: boolean }) => {
      if (!options?.force && hasLiveCall()) {
        return;
      }

      stopVoiceCallRingtone();
      activeCallRef.current?.disconnect();
      activeCallRef.current = null;
      incomingCallRef.current = null;
      setIncomingCall(null);
      setIncomingCallerLabel(null);
      setIncomingCallerInfo(null);
      setIncomingUiMinimized(false);
      setActiveCallLabel(null);
      setIsRegistered(false);
      const device = deviceRef.current;
      deviceRef.current = null;
      if (device) {
        device.removeAllListeners();
        void device.unregister().catch(() => undefined);
        device.destroy();
      }
    },
    [hasLiveCall],
  );

  const bindCallEvents = useCallback(
    (call: Call) => {
      call.on("ringing", () => {
        setCallState("ringing");
        setErrorMessage(null);
      });
      call.on("accept", () => {
        setErrorMessage(null);
        setCallState("open");
      });
      call.on("disconnect", () => {
        if (activeCallRef.current === call) {
          activeCallRef.current = null;
        }
        setActiveCallLabel(null);
        setCallState("idle");
        invalidateCallHistory();
      });
      call.on("cancel", () => {
        if (activeCallRef.current === call) {
          activeCallRef.current = null;
        }
        setActiveCallLabel(null);
        setCallState("idle");
        invalidateCallHistory();
      });
      call.on("reject", () => {
        activeCallRef.current = null;
        setActiveCallLabel(null);
        setErrorMessage("Call was rejected or could not connect.");
        setCallState("error");
        invalidateCallHistory();
      });
      call.on("error", (error) => {
        setErrorMessage(error.message);
        setCallState("error");
        invalidateCallHistory();
      });
    },
    [invalidateCallHistory],
  );

  const refreshToken = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) return;
    const { token } = await dataProvider.getVoiceToken();
    await device.updateToken(token);
  }, [dataProvider]);

  const resolveIncomingCaller = useCallback(
    async (params: Record<string, string | undefined>) => {
      const base = emptyIncomingCallerInfo(params);
      setIncomingCallerInfo(base);
      setIncomingCallerLabel(base.displayPhone);

      if (!base.phoneE164) {
        setIncomingCallerInfo({ ...base, isLookupPending: false });
        return;
      }

      try {
        const contact = await dataProvider.lookupContactByPhone(base.phoneE164);
        if (!contact?.id) {
          setIncomingCallerInfo({ ...base, isLookupPending: false });
          return;
        }

        const contactName =
          contact.full_name?.trim() ||
          `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
          base.displayPhone;

        setIncomingCallerInfo({
          phoneE164: base.phoneE164,
          displayPhone: base.displayPhone,
          contactId: contact.id,
          contactName,
          companyName: contact.company_name,
          isKnownContact: true,
          isLookupPending: false,
        });
        setIncomingCallerLabel(contactName);
      } catch {
        setIncomingCallerInfo({ ...base, isLookupPending: false });
      }
    },
    [dataProvider],
  );

  const ensureDevice = useCallback(async () => {
    if (deviceRef.current) {
      return deviceRef.current;
    }

    setErrorMessage(null);

    const { token } = await dataProvider.getVoiceToken();
    const device = new Device(token, {
      codecPreferences: ["opus", "pcmu"],
      logLevel: 1,
      // Custom Web Audio ringtones in useVoiceCallRingtone (avoids Twilio output-device errors).
      sounds: {
        incoming: false,
        outgoing: false,
        disconnect: false,
      },
    });

    device.on("error", (error) => {
      setErrorMessage(error.message);
      setCallState("error");
    });

    device.on("incoming", (call) => {
      setIncomingUiMinimized(false);
      setIncomingCall((current) => {
        current?.reject();
        return call;
      });
      incomingCallRef.current = call;
      void resolveIncomingCaller(call.parameters ?? {});
      call.on("cancel", () => {
        setIncomingCall((current) => (current === call ? null : current));
        if (incomingCallRef.current === call) {
          incomingCallRef.current = null;
        }
        setIncomingCallerLabel(null);
        setIncomingCallerInfo(null);
        setIncomingUiMinimized(false);
      });
    });

    device.on("registered", () => {
      setIsRegistered(true);
      if (!activeCallRef.current && !incomingCall) {
        setCallState("idle");
      }
    });

    device.on("unregistered", () => {
      setIsRegistered(false);
    });

    device.on("tokenWillExpire", () => {
      void refreshToken().catch((error) => {
        console.error("[VoiceCallProvider] token refresh failed", error);
      });
    });

    deviceRef.current = device;
    await device.register();
    void unlockVoiceCallAudio();
    setIsRegistered(true);
    if (!activeCallRef.current) {
      setCallState("idle");
    }
    return device;
  }, [dataProvider, refreshToken, resolveIncomingCaller]);

  useEffect(() => {
    if (!shouldRegister) {
      if (!hasLiveCall()) {
        destroyDevice();
        setCallState("idle");
      }
      return;
    }

    let cancelled = false;
    void ensureDevice().catch((error) => {
      if (cancelled) return;
      setErrorMessage(
        error instanceof Error ? error.message : "Could not register voice device",
      );
      setCallState("error");
    });

    return () => {
      cancelled = true;
    };
    // Register once per voice-enabled session; ensureDevice is stable enough for this flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRegister]);

  useEffect(
    () => () => {
      destroyDevice({ force: true });
    },
    [destroyDevice],
  );

  const hangUp = useCallback(() => {
    activeCallRef.current?.disconnect();
    activeCallRef.current = null;
    setActiveCallLabel(null);
    setCallState("idle");
    setErrorMessage(null);
  }, []);

  const placeCall = useCallback(
    async (params: PlaceVoiceCallParams) => {
      if (!shouldRegister) {
        throw new Error("Voice calling is not enabled");
      }

      const memberId = identity?.id;
      if (!memberId) {
        throw new Error("You must be signed in to place a call");
      }

      const normalizedTo =
        normalizeUsPhoneToE164(params.to.trim()) ?? params.to.trim();
      if (!normalizedTo.startsWith("+")) {
        throw new Error(
          "Invalid phone number. Use a 10-digit US number or E.164 format (+1…).",
        );
      }

      setErrorMessage(null);
      setCallState("connecting");
      setActiveCallLabel(formatUsPhoneDisplayFromAny(normalizedTo));

      const device = await ensureDevice();
      const connectParams: Record<string, string> = {
        To: normalizedTo,
        member_id: String(memberId),
      };
      if (params.contactId != null) {
        connectParams.contact_id = String(params.contactId);
      }
      if (params.conversationId != null) {
        connectParams.conversation_id = String(params.conversationId);
      }
      if (params.dealId != null) {
        connectParams.deal_id = String(params.dealId);
      }

      const call = await device.connect({ params: connectParams });
      activeCallRef.current = call;
      bindCallEvents(call);
      return call;
    },
    [bindCallEvents, ensureDevice, identity?.id, shouldRegister],
  );

  const acceptIncoming = useCallback(() => {
    const call = incomingCall;
    if (!call) return;
    const label =
      incomingCallerInfo?.contactName ??
      incomingCallerLabel ??
      incomingCallerInfo?.displayPhone ??
      null;
    setIncomingCall(null);
    incomingCallRef.current = null;
    setIncomingCallerLabel(null);
    setIncomingCallerInfo(null);
    setIncomingUiMinimized(false);
    setActiveCallLabel(label);
    setCallState("connecting");
    activeCallRef.current = call;
    bindCallEvents(call);
    call.accept();
  }, [bindCallEvents, incomingCall, incomingCallerInfo, incomingCallerLabel]);

  const rejectIncoming = useCallback(() => {
    incomingCall?.reject();
    setIncomingCall(null);
    incomingCallRef.current = null;
    setIncomingCallerLabel(null);
    setIncomingCallerInfo(null);
    setIncomingUiMinimized(false);
  }, [incomingCall]);

  const dismissIncomingUi = useCallback(() => {
    setIncomingUiMinimized(true);
  }, []);

  const expandIncomingUi = useCallback(() => {
    setIncomingUiMinimized(false);
  }, []);

  const value: VoiceCallContextValue = {
    callState,
    errorMessage,
    incomingCall,
    incomingCallerLabel,
    incomingCallerInfo,
    incomingUiMinimized,
    activeCallLabel,
    placeCall,
    hangUp,
    acceptIncoming,
    rejectIncoming,
    dismissIncomingUi,
    expandIncomingUi,
    isBusy: callState !== "idle" && callState !== "error",
    isRegistered,
  };

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
      <IncomingCallDialog />
      <IncomingCallBanner />
      <ActiveCallBar />
    </VoiceCallContext.Provider>
  );
};
