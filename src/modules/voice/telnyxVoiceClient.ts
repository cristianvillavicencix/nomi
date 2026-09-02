import {
  TelnyxRTC,
  NOTIFICATION_TYPE,
  type Call as TelnyxCall,
  type IClientOptions,
  type INotification,
} from "@telnyx/webrtc";
import type { VoiceCallState } from "@/modules/voice/voiceCallTypes";

export type TelnyxVoiceCreds = {
  token?: string | null;
  login?: string | null;
  password?: string | null;
  callerId?: string | null;
};

export type { TelnyxCall, INotification };

export { TelnyxRTC, NOTIFICATION_TYPE };

export function buildTelnyxClientOptions(
  creds: TelnyxVoiceCreds,
): IClientOptions {
  const token = creds.token?.trim();
  if (token) {
    return { login_token: token };
  }
  const login = creds.login?.trim();
  const password = creds.password?.trim();
  if (login && password) {
    return { login, password };
  }
  throw new Error("Telnyx voice credentials are incomplete");
}

export function createTelnyxClient(creds: TelnyxVoiceCreds): TelnyxRTC {
  return new TelnyxRTC({
    ...buildTelnyxClientOptions(creds),
    // Custom Web Audio ringtones in useVoiceCallRingtone.
    ringtoneFile: undefined,
    ringbackFile: undefined,
  });
}

/** Wait until TelnyxRTC emits telnyx.ready (or reject on telnyx.error). */
export function connectTelnyxClient(client: TelnyxRTC): Promise<void> {
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (event: unknown) => {
      cleanup();
      const message =
        event instanceof Error
          ? event.message
          : typeof event === "object" &&
              event &&
              "error" in event &&
              (event as { error?: { message?: string } }).error?.message
            ? String((event as { error?: { message?: string } }).error?.message)
            : "Telnyx voice connection failed";
      reject(new Error(message));
    };
    const cleanup = () => {
      client.off("telnyx.ready", onReady);
      client.off("telnyx.error", onError);
    };
    client.on("telnyx.ready", onReady);
    client.on("telnyx.error", onError);
    void client.connect().catch(onError);
  });
}

export function mapTelnyxCallState(
  state: string | undefined | null,
): VoiceCallState | "ended" | null {
  switch ((state ?? "").toLowerCase()) {
    case "active":
    case "held":
      return "open";
    case "ringing":
      return "ringing";
    case "new":
    case "trying":
    case "requesting":
    case "recovering":
    case "answering":
      return "connecting";
    case "early":
      // Early media = remote ringback while the callee's phone is ringing.
      return "ringing";
    case "hangup":
    case "destroy":
    case "purge":
      return "ended";
    default:
      return null;
  }
}

export function isTelnyxCallUpdate(
  notification: INotification,
): notification is INotification & { call: TelnyxCall } {
  return (
    notification.type === NOTIFICATION_TYPE.callUpdate &&
    Boolean(notification.call)
  );
}

export function isTelnyxInboundRinging(call: TelnyxCall): boolean {
  return (
    String(call.direction).toLowerCase() === "inbound" &&
    String(call.state).toLowerCase() === "ringing"
  );
}

export function getTelnyxRemotePhone(call: TelnyxCall): string | undefined {
  const opts = call.options;
  const raw =
    opts?.remoteCallerNumber?.trim() ||
    opts?.callerNumber?.trim() ||
    opts?.destinationNumber?.trim();
  return raw || undefined;
}

export async function disconnectTelnyxClient(
  client: TelnyxRTC | null,
): Promise<void> {
  if (!client) return;
  try {
    client.off("telnyx.notification");
    client.off("telnyx.ready");
    client.off("telnyx.error");
  } catch {
    // ignore
  }
  try {
    await client.disconnect();
  } catch {
    // ignore
  }
}
