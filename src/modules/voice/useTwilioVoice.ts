import { useCallback, useEffect, useRef, useState } from "react";
import { Device, type Call } from "@twilio/voice-sdk";
import { useDataProvider, useGetIdentity } from "ra-core";
import type { Identifier } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

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

export const useTwilioVoice = (enabled: boolean) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const [callState, setCallState] = useState<VoiceCallState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const destroyDevice = useCallback(() => {
    activeCallRef.current?.disconnect();
    activeCallRef.current = null;
    const device = deviceRef.current;
    deviceRef.current = null;
    if (device) {
      device.removeAllListeners();
      void device.unregister().catch(() => undefined);
      device.destroy();
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      destroyDevice();
      setCallState("idle");
    }
    return () => {
      destroyDevice();
    };
  }, [destroyDevice, enabled]);

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

    deviceRef.current = device;
    await device.register();
    setCallState("idle");
    return device;
  }, [dataProvider]);

  const hangUp = useCallback(() => {
    activeCallRef.current?.disconnect();
    activeCallRef.current = null;
    setCallState("idle");
    setErrorMessage(null);
  }, []);

  const placeCall = useCallback(
    async (params: PlaceVoiceCallParams) => {
      if (!enabled) {
        throw new Error("Voice calling is not enabled");
      }

      const memberId = identity?.id;
      if (!memberId) {
        throw new Error("You must be signed in to place a call");
      }

      setErrorMessage(null);
      setCallState("connecting");

      const device = await ensureDevice();
      const connectParams: Record<string, string> = {
        To: params.to,
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

      call.on("ringing", () => setCallState("ringing"));
      call.on("accept", () => setCallState("open"));
      call.on("disconnect", () => {
        activeCallRef.current = null;
        setCallState("idle");
      });
      call.on("error", (error) => {
        setErrorMessage(error.message);
        setCallState("error");
      });

      return call;
    },
    [enabled, ensureDevice, identity?.id],
  );

  return {
    callState,
    errorMessage,
    placeCall,
    hangUp,
    isBusy: callState !== "idle" && callState !== "error",
  };
};
