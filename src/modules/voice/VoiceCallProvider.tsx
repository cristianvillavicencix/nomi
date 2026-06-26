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
import { ActiveCallBar } from "@/modules/voice/ActiveCallBar";
import type {
  PlaceVoiceCallParams,
  VoiceCallState,
} from "@/modules/voice/voiceCallTypes";

const resolveCallLabel = (params: Record<string, string | undefined>) => {
  const raw =
    params.To ??
    params.From ??
    params.Called ??
    params.Caller ??
    params.phone ??
    null;
  if (!raw) return "Unknown number";
  if (raw.startsWith("client:")) return "CRM user";
  return formatUsPhoneDisplayFromAny(raw);
};

export const VoiceCallProvider = ({ children }: { children: ReactNode }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const { voiceEnabled, isPending } = useMessagingEnabled();
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const [callState, setCallState] = useState<VoiceCallState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [incomingCallerLabel, setIncomingCallerLabel] = useState<string | null>(
    null,
  );
  const [activeCallLabel, setActiveCallLabel] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  const canUseVoice = hasMemberCapability(
    identity as AccessIdentity | undefined,
    "voice.calls.make",
  );
  const shouldRegister = voiceEnabled && canUseVoice && !isPending && !!identity?.id;

  const invalidateCallHistory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["voice_calls"] });
  }, [queryClient]);

  const destroyDevice = useCallback(() => {
    activeCallRef.current?.disconnect();
    activeCallRef.current = null;
    setIncomingCall(null);
    setIncomingCallerLabel(null);
    setActiveCallLabel(null);
    setIsRegistered(false);
    const device = deviceRef.current;
    deviceRef.current = null;
    if (device) {
      device.removeAllListeners();
      void device.unregister().catch(() => undefined);
      device.destroy();
    }
  }, []);

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
        activeCallRef.current = null;
        setActiveCallLabel(null);
        setCallState("idle");
        invalidateCallHistory();
      });
      call.on("cancel", () => {
        activeCallRef.current = null;
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

  const ensureDevice = useCallback(async () => {
    if (deviceRef.current) {
      return deviceRef.current;
    }

    setCallState("initializing");
    setErrorMessage(null);

    const { token } = await dataProvider.getVoiceToken();
    const device = new Device(token, {
      codecPreferences: ["opus", "pcmu"],
      logLevel: 1,
    });

    device.on("error", (error) => {
      setErrorMessage(error.message);
      setCallState("error");
    });

    device.on("incoming", (call) => {
      setIncomingCall((current) => {
        current?.reject();
        return call;
      });
      setIncomingCallerLabel(resolveCallLabel(call.parameters ?? {}));
      call.on("cancel", () => {
        setIncomingCall((current) => (current === call ? null : current));
        setIncomingCallerLabel((current) => (current ? null : current));
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
    setIsRegistered(true);
    if (!activeCallRef.current) {
      setCallState("idle");
    }
    return device;
  }, [dataProvider, refreshToken]);

  useEffect(() => {
    if (!shouldRegister) {
      destroyDevice();
      setCallState("idle");
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
      destroyDevice();
    };
    // Register once per voice-enabled session; ensureDevice is stable enough for this flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRegister]);

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
    setIncomingCall(null);
    setIncomingCallerLabel(null);
    setActiveCallLabel(incomingCallerLabel);
    setCallState("connecting");
    activeCallRef.current = call;
    bindCallEvents(call);
    call.accept();
  }, [bindCallEvents, incomingCall, incomingCallerLabel]);

  const rejectIncoming = useCallback(() => {
    incomingCall?.reject();
    setIncomingCall(null);
    setIncomingCallerLabel(null);
  }, [incomingCall]);

  const value: VoiceCallContextValue = {
    callState,
    errorMessage,
    incomingCall,
    incomingCallerLabel,
    activeCallLabel,
    placeCall,
    hangUp,
    acceptIncoming,
    rejectIncoming,
    isBusy: callState !== "idle" && callState !== "error",
    isRegistered,
  };

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
      <IncomingCallDialog />
      <ActiveCallBar />
    </VoiceCallContext.Provider>
  );
};
