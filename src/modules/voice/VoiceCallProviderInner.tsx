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

import {
  formatVoiceDeviceError,
  isTransientVoiceDeviceError,
} from "@/modules/voice/voiceDeviceErrors";
import {
  connectTelnyxClient,
  createTelnyxClient,
  disconnectTelnyxClient,
  getTelnyxRemotePhone,
  isTelnyxCallUpdate,
  isTelnyxInboundRinging,
  mapTelnyxCallState,
  type INotification,
  type TelnyxCall,
  type TelnyxRTC,
} from "@/modules/voice/telnyxVoiceClient";

/** US East primary edge (Stamford CT / Ashburn); roaming fallback if unreachable. */
const VOICE_DEVICE_EDGE: string[] = ["ashburn", "roaming"];

/** Avoid token refresh storms when the SDK reconnects repeatedly. */
const TOKEN_REFRESH_MIN_INTERVAL_MS = 30_000;

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
  const { voiceEnabled, messagingProvider, isPending } = useMessagingEnabled();
  const isTelnyx = messagingProvider === "telnyx";
  const deviceRef = useRef<Device | null>(null);
  const telnyxClientRef = useRef<TelnyxRTC | null>(null);
  const telnyxCallerIdRef = useRef<string | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  const activeTelnyxCallRef = useRef<TelnyxCall | null>(null);
  const incomingTelnyxCallRef = useRef<TelnyxCall | null>(null);
  const tokenRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const lastTokenRefreshAtRef = useRef(0);
  const ensureDeviceRef = useRef<() => Promise<unknown>>(async () => null);
  const [callState, setCallState] = useState<VoiceCallState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<unknown | null>(null);
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
    () =>
      Boolean(
        activeCallRef.current ||
          incomingCallRef.current ||
          activeTelnyxCallRef.current ||
          incomingTelnyxCallRef.current,
      ),
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
      try {
        activeTelnyxCallRef.current?.hangup();
      } catch {
        // ignore
      }
      activeTelnyxCallRef.current = null;
      try {
        incomingTelnyxCallRef.current?.hangup();
      } catch {
        // ignore
      }
      incomingTelnyxCallRef.current = null;
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
      const telnyx = telnyxClientRef.current;
      telnyxClientRef.current = null;
      telnyxCallerIdRef.current = null;
      void disconnectTelnyxClient(telnyx);
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
        setErrorMessage(formatVoiceDeviceError(error));
        setCallState("error");
        invalidateCallHistory();
      });

      // device.connect() / accept() may already be past the event we care about.
      syncFromCallStatus();
    },
    [invalidateCallHistory],
  );

  const refreshToken = useCallback(async () => {
    const now = Date.now();
    if (now - lastTokenRefreshAtRef.current < TOKEN_REFRESH_MIN_INTERVAL_MS) {
      return;
    }

    if (tokenRefreshInFlightRef.current) {
      await tokenRefreshInFlightRef.current.catch(() => undefined);
      return;
    }

    const refreshPromise = (async () => {
      if (isTelnyx) {
        if (hasLiveCall()) return;
        const existing = telnyxClientRef.current;
        telnyxClientRef.current = null;
        await disconnectTelnyxClient(existing);
        await ensureDeviceRef.current();
        lastTokenRefreshAtRef.current = Date.now();
        return;
      }

      const device = deviceRef.current;
      if (!device) return;
      const { token } = await dataProvider.getVoiceToken();
      await device.updateToken(token);
      lastTokenRefreshAtRef.current = Date.now();
    })();

    tokenRefreshInFlightRef.current = refreshPromise;
    try {
      await refreshPromise;
    } finally {
      if (tokenRefreshInFlightRef.current === refreshPromise) {
        tokenRefreshInFlightRef.current = null;
      }
    }
  }, [dataProvider, hasLiveCall, isTelnyx]);

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

  const clearIncomingUi = useCallback(() => {
    setIncomingCall(null);
    incomingCallRef.current = null;
    incomingTelnyxCallRef.current = null;
    setIncomingCallerLabel(null);
    setIncomingCallerInfo(null);
    setIncomingUiMinimized(false);
  }, []);

  const handleTelnyxNotification = useCallback(
    (notification: INotification) => {
      if (!isTelnyxCallUpdate(notification)) return;
      const call = notification.call;
      const mapped = mapTelnyxCallState(call.state);

      if (isTelnyxInboundRinging(call)) {
        const previous = incomingTelnyxCallRef.current;
        if (previous && previous.id !== call.id) {
          try {
            void previous.hangup();
          } catch {
            // ignore
          }
        }
        setIncomingUiMinimized(false);
        incomingTelnyxCallRef.current = call;
        setIncomingCall(call);
        const phone = getTelnyxRemotePhone(call);
        void resolveIncomingCaller(
          phone ? { From: phone, Caller: phone } : {},
        );
        return;
      }

      const isActive = activeTelnyxCallRef.current?.id === call.id;
      const isIncoming = incomingTelnyxCallRef.current?.id === call.id;

      if (mapped === "ended") {
        if (isIncoming) {
          clearIncomingUi();
        }
        if (isActive) {
          activeTelnyxCallRef.current = null;
          clearActiveCallUi({
            setActiveCallLabel,
            setActiveCallParty,
            setCallConnectedAt,
            setIsMuted,
            setCallWorkspaceOpen,
          });
          setCallState("idle");
          invalidateCallHistory();
        }
        return;
      }

      if (!isActive && !isIncoming) {
        // Outbound call we just placed may land here before we assign the ref.
        if (
          String(call.direction).toLowerCase() === "outbound" &&
          !activeTelnyxCallRef.current
        ) {
          activeTelnyxCallRef.current = call;
        } else {
          return;
        }
      }

      if (isIncoming && mapped === "open") {
        // Answered elsewhere / auto-accepted — promote to active.
        clearIncomingUi();
        activeTelnyxCallRef.current = call;
      }

      if (activeTelnyxCallRef.current?.id === call.id || isActive) {
        if (mapped === "open") {
          setErrorMessage(null);
          setCallConnectedAt((current) => current ?? Date.now());
          setIsMuted(Boolean(call.isAudioMuted));
          setCallState("open");
        } else if (mapped === "ringing") {
          setCallState("ringing");
          setErrorMessage(null);
        } else if (mapped === "connecting") {
          setCallState("connecting");
        }
      }
    },
    [clearIncomingUi, invalidateCallHistory, resolveIncomingCaller],
  );

  const ensureTelnyxClient = useCallback(async () => {
    if (telnyxClientRef.current) {
      return telnyxClientRef.current;
    }

    // Drop Twilio softphone if we switched providers.
    if (deviceRef.current) {
      const device = deviceRef.current;
      deviceRef.current = null;
      device.removeAllListeners();
      void device.unregister().catch(() => undefined);
      device.destroy();
    }

    setErrorMessage(null);
    const voice = await dataProvider.getVoiceToken();
    telnyxCallerIdRef.current = voice.caller_id?.trim() || null;

    const client = createTelnyxClient({
      token: voice.token,
      login: voice.login,
      password: voice.password,
      callerId: voice.caller_id,
    });

    client.on("telnyx.notification", handleTelnyxNotification);
    client.on("telnyx.error", (error) => {
      if (hasLiveCall()) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Telnyx voice error",
        );
        setCallState("error");
      }
    });

    telnyxClientRef.current = client;
    await connectTelnyxClient(client);
    void unlockVoiceCallAudio();
    setIsRegistered(true);
    if (!activeTelnyxCallRef.current && !incomingTelnyxCallRef.current) {
      setCallState("idle");
    }
    return client;
  }, [dataProvider, handleTelnyxNotification, hasLiveCall]);

  const ensureTwilioDevice = useCallback(async () => {
    if (deviceRef.current) {
      return deviceRef.current;
    }

    if (telnyxClientRef.current) {
      const telnyx = telnyxClientRef.current;
      telnyxClientRef.current = null;
      telnyxCallerIdRef.current = null;
      await disconnectTelnyxClient(telnyx);
    }

    setErrorMessage(null);

    const { token } = await dataProvider.getVoiceToken();
    const device = new Device(token, {
      codecPreferences: ["opus", "pcmu"],
      edge: VOICE_DEVICE_EDGE,
      maxCallSignalingTimeoutMs: 30_000,
      logLevel: import.meta.env.DEV ? 1 : 5,
      // Custom Web Audio ringtones in useVoiceCallRingtone (avoids Twilio output-device errors).
      sounds: {
        incoming: false,
        outgoing: false,
        disconnect: false,
      },
    });

    device.on("error", (error) => {
      const friendly = formatVoiceDeviceError(error);
      const liveCall = hasLiveCall();
      if (!liveCall && isTransientVoiceDeviceError(error)) {
        console.warn("[VoiceCallProvider] transient device error", error);
        return;
      }
      setErrorMessage(friendly);
      setCallState("error");
    });

    device.on("incoming", (call) => {
      setIncomingUiMinimized(false);
      setIncomingCall((current) => {
        if (
          current &&
          typeof current === "object" &&
          "reject" in current &&
          typeof (current as Call).reject === "function"
        ) {
          (current as Call).reject();
        }
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
      setErrorMessage(null);
      if (!activeCallRef.current && !incomingCallRef.current) {
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
  }, [dataProvider, hasLiveCall, refreshToken, resolveIncomingCaller]);

  const ensureDevice = useCallback(async () => {
    if (isTelnyx) {
      return ensureTelnyxClient();
    }
    return ensureTwilioDevice();
  }, [ensureTelnyxClient, ensureTwilioDevice, isTelnyx]);

  ensureDeviceRef.current = ensureDevice;

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
    // Register once per voice-enabled session / provider; ensureDevice is stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRegister, messagingProvider]);

  useEffect(
    () => () => {
      destroyDevice({ force: true });
    },
    [destroyDevice],
  );

  const hangUp = useCallback(() => {
    if (activeTelnyxCallRef.current) {
      try {
        void activeTelnyxCallRef.current.hangup();
      } catch (error) {
        console.error("[VoiceCallProvider] telnyx hangup failed", error);
      }
      activeTelnyxCallRef.current = null;
    } else {
      activeCallRef.current?.disconnect();
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
    setErrorMessage(null);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    setIsMuted(muted);
    const telnyxCall = activeTelnyxCallRef.current;
    if (telnyxCall) {
      try {
        if (muted) telnyxCall.muteAudio();
        else telnyxCall.unmuteAudio();
        setIsMuted(Boolean(telnyxCall.isAudioMuted));
      } catch (error) {
        console.error("[VoiceCallProvider] telnyx mute failed", error);
        setIsMuted(!muted);
      }
      return;
    }
    const call = activeCallRef.current;
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
    if (!digits) return;
    const telnyxCall = activeTelnyxCallRef.current;
    if (telnyxCall) {
      try {
        telnyxCall.dtmf(digits);
      } catch (error) {
        console.error("[VoiceCallProvider] telnyx dtmf failed", error);
      }
      return;
    }
    const call = activeCallRef.current;
    if (!call) return;
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

      if (isTelnyx) {
        const client = await ensureTelnyxClient();
        const callerNumber = telnyxCallerIdRef.current || undefined;
        const call = client.newCall({
          destinationNumber: normalizedTo,
          callerNumber,
        });
        activeTelnyxCallRef.current = call;
        return;
      }

      const device = await ensureTwilioDevice();
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
    },
    [
      bindCallEvents,
      ensureTelnyxClient,
      ensureTwilioDevice,
      identity?.id,
      isTelnyx,
      shouldRegister,
    ],
  );

  const acceptIncoming = useCallback(() => {
    if (isTelnyx) {
      const call = incomingTelnyxCallRef.current;
      if (!call) return;
      const info = incomingCallerInfo;
      const label =
        info?.contactName ??
        incomingCallerLabel ??
        info?.displayPhone ??
        null;
      const phoneLabel = info?.displayPhone ?? label ?? "Incoming call";
      clearIncomingUi();
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
      activeTelnyxCallRef.current = call;
      void call.answer().catch((error) => {
        console.error("[VoiceCallProvider] telnyx answer failed", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Could not answer call",
        );
        setCallState("error");
      });
      return;
    }

    const call = incomingCallRef.current;
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
  }, [
    bindCallEvents,
    clearIncomingUi,
    incomingCallerInfo,
    incomingCallerLabel,
    isTelnyx,
  ]);

  const rejectIncoming = useCallback(() => {
    if (isTelnyx) {
      try {
        void incomingTelnyxCallRef.current?.hangup();
      } catch {
        // ignore
      }
      clearIncomingUi();
      return;
    }
    incomingCallRef.current?.reject();
    setIncomingCall(null);
    incomingCallRef.current = null;
    setIncomingCallerLabel(null);
    setIncomingCallerInfo(null);
    setIncomingUiMinimized(false);
  }, [clearIncomingUi, isTelnyx]);

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
