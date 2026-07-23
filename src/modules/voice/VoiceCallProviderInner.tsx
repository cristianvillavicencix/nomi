import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Device, type Call } from "@twilio/voice-sdk";
import { useDataProvider, useGetIdentity } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { memberHasVoiceCallCapability } from "@/lib/permissions/voiceCallCapability";
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
  ActiveCallParty,
  IncomingCallerInfo,
  PlaceVoiceCallParams,
  VoiceCallState,
} from "@/modules/voice/voiceCallTypes";
import { useVoiceCallRingtone } from "@/modules/voice/useVoiceCallRingtone";
import { stopVoiceCallRingtone, unlockVoiceCallAudio } from "@/modules/voice/voiceCallRingtone";
import {
  formatCallerPhoneLabel,
  resolveIncomingCallerPhone,
  resolveSmsThreadDisplayName,
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
    isKnownFromMessages: false,
    isLookupPending: Boolean(phoneE164),
  };
};

const clearActiveCallUi = (
  setters: {
    setActiveCallLabel: (v: string | null) => void;
    setActiveCallParty: (v: ActiveCallParty | null) => void;
    setCallConnectedAt: (v: number | null) => void;
    setIsMuted: (v: boolean) => void;
    setCallWorkspaceOpen: (v: boolean) => void;
  },
) => {
  setters.setActiveCallLabel(null);
  setters.setActiveCallParty(null);
  setters.setCallConnectedAt(null);
  setters.setIsMuted(false);
  setters.setCallWorkspaceOpen(false);
};

export const VoiceCallProviderInner = ({ children }: { children: ReactNode }) => {
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
  const [activeCallParty, setActiveCallParty] =
    useState<ActiveCallParty | null>(null);
  const [callConnectedAt, setCallConnectedAt] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callWorkspaceOpen, setCallWorkspaceOpen] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const canUseVoice = memberHasVoiceCallCapability(
    identity as AccessIdentity | undefined,
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
      clearActiveCallUi({
        setActiveCallLabel,
        setActiveCallParty,
        setCallConnectedAt,
        setIsMuted,
        setCallWorkspaceOpen,
      });
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
      const syncFromCallStatus = () => {
        const status = call.status();
        if (status === "open") {
          setErrorMessage(null);
          setCallConnectedAt((current) => current ?? Date.now());
          setIsMuted(call.isMuted());
          setCallState("open");
        } else if (status === "ringing") {
          setCallState("ringing");
          setErrorMessage(null);
        } else if (status === "connecting" || status === "reconnecting") {
          setCallState("connecting");
        }
      };

      call.on("ringing", () => {
        setCallState("ringing");
        setErrorMessage(null);
      });
      call.on("accept", () => {
        setErrorMessage(null);
        setCallConnectedAt(Date.now());
        setIsMuted(call.isMuted());
        setCallState("open");
      });
      call.on("mute", (muted: boolean) => {
        setIsMuted(Boolean(muted));
      });
      call.on("disconnect", () => {
        if (activeCallRef.current === call) {
          activeCallRef.current = null;
        }
        clearActiveCallUi({
          setActiveCallLabel,
          setActiveCallParty,
          setCallConnectedAt,
          setIsMuted,
          setCallWorkspaceOpen,
        });
        setCallState("idle");
        invalidateCallHistory();
      });
      call.on("cancel", () => {
        if (activeCallRef.current === call) {
          activeCallRef.current = null;
        }
        clearActiveCallUi({
          setActiveCallLabel,
          setActiveCallParty,
          setCallConnectedAt,
          setIsMuted,
          setCallWorkspaceOpen,
        });
        setCallState("idle");
        invalidateCallHistory();
      });
      call.on("reject", () => {
        activeCallRef.current = null;
        clearActiveCallUi({
          setActiveCallLabel,
          setActiveCallParty,
          setCallConnectedAt,
          setIsMuted,
          setCallWorkspaceOpen,
        });
        setErrorMessage("Call was rejected or could not connect.");
        setCallState("error");
        invalidateCallHistory();
      });
      call.on("error", (error) => {
        setErrorMessage(error.message);
        setCallState("error");
        invalidateCallHistory();
      });

      // device.connect() / accept() may already be past the event we care about.
      syncFromCallStatus();
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
        if (contact?.id) {
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
            isKnownFromMessages: false,
            isLookupPending: false,
          });
          setIncomingCallerLabel(contactName);
          return;
        }

        const conversation = await dataProvider.findClientConversationByPhone(
          base.phoneE164,
        );

        if (conversation?.contact_id != null) {
          try {
            const { data: linked } = await dataProvider.getOne("contacts", {
              id: conversation.contact_id,
            });
            const contactName =
              `${linked?.first_name ?? ""} ${linked?.last_name ?? ""}`.trim() ||
              resolveSmsThreadDisplayName(
                conversation.title,
                base.phoneE164,
                base.displayPhone,
              ) ||
              base.displayPhone;
            setIncomingCallerInfo({
              phoneE164: base.phoneE164,
              displayPhone: base.displayPhone,
              contactId: conversation.contact_id,
              conversationId: conversation.id,
              contactName,
              companyName: linked?.company_name ?? null,
              isKnownContact: true,
              isKnownFromMessages: false,
              isLookupPending: false,
            });
            setIncomingCallerLabel(contactName);
            return;
          } catch {
            // Fall through to SMS title / unknown.
          }
        }

        const smsName = resolveSmsThreadDisplayName(
          conversation?.title,
          base.phoneE164,
          base.displayPhone,
        );

        if (conversation?.id && smsName) {
          setIncomingCallerInfo({
            phoneE164: base.phoneE164,
            displayPhone: base.displayPhone,
            conversationId: conversation.id,
            contactName: smsName,
            isKnownContact: false,
            isKnownFromMessages: true,
            isLookupPending: false,
          });
          setIncomingCallerLabel(smsName);
          return;
        }

        setIncomingCallerInfo({
          ...base,
          conversationId: conversation?.id,
          isLookupPending: false,
        });
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
    clearActiveCallUi({
      setActiveCallLabel,
      setActiveCallParty,
      setCallConnectedAt,
      setIsMuted,
      setCallWorkspaceOpen,
    });
    setCallState("idle");
    setErrorMessage(null);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    const call = activeCallRef.current;
    // Optimistic UI so the bar reacts even if Twilio is slow to emit `mute`.
    setIsMuted(muted);
    if (!call) return;
    try {
      call.mute(muted);
      setIsMuted(call.isMuted());
    } catch (error) {
      console.error("[VoiceCallProvider] mute failed", error);
      setIsMuted(!muted);
    }
  }, []);

  const sendDigits = useCallback((digits: string) => {
    const call = activeCallRef.current;
    if (!call || !digits) return;
    try {
      call.sendDigits(digits);
    } catch (error) {
      console.error("[VoiceCallProvider] sendDigits failed", error);
    }
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

      const phoneLabel = formatUsPhoneDisplayFromAny(normalizedTo);
      setErrorMessage(null);
      setCallState("connecting");
      setCallConnectedAt(null);
      setIsMuted(false);
      setActiveCallLabel(phoneLabel);
      setActiveCallParty({
        phoneLabel,
        contactId: params.contactId ?? null,
        conversationId: params.conversationId ?? null,
        dealId: params.dealId ?? null,
      });

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
    const info = incomingCallerInfo;
    const label =
      info?.contactName ??
      incomingCallerLabel ??
      info?.displayPhone ??
      null;
    const phoneLabel = info?.displayPhone ?? label ?? "Incoming call";
    setIncomingCall(null);
    incomingCallRef.current = null;
    setIncomingCallerLabel(null);
    setIncomingCallerInfo(null);
    setIncomingUiMinimized(false);
    setActiveCallLabel(label);
    setActiveCallParty({
      phoneLabel,
      contactId: info?.contactId ?? null,
      conversationId: info?.conversationId ?? null,
      contactName: info?.contactName ?? null,
      companyName: info?.companyName ?? null,
    });
    setCallConnectedAt(null);
    setIsMuted(false);
    setCallState("connecting");
    activeCallRef.current = call;
    bindCallEvents(call);
    call.accept();
    // accept() can move the call to open before/without a late event.
    if (call.status() === "open") {
      setCallConnectedAt(Date.now());
      setIsMuted(call.isMuted());
      setCallState("open");
    }
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
    activeCallParty,
    callConnectedAt,
    isMuted,
    setMuted,
    sendDigits,
    callWorkspaceOpen,
    setCallWorkspaceOpen,
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
