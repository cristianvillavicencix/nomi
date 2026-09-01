import type { TelnyxRTC } from "@telnyx/webrtc";

const REMOTE_AUDIO_ID = "telnyx-remote-media";

let remoteAudioElement: HTMLAudioElement | null = null;

/** Hidden autoplay element required by Telnyx WebRTC to hear the remote party. */
export const getTelnyxRemoteAudioElement = (): HTMLAudioElement => {
  if (typeof document === "undefined") {
    throw new Error("Telnyx remote audio is only available in the browser");
  }

  const existing = document.getElementById(REMOTE_AUDIO_ID);
  if (existing instanceof HTMLAudioElement) {
    remoteAudioElement = existing;
    return existing;
  }

  if (!remoteAudioElement) {
    const audio = document.createElement("audio");
    audio.id = REMOTE_AUDIO_ID;
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    audio.style.display = "none";
    document.body.appendChild(audio);
    remoteAudioElement = audio;
  }

  return remoteAudioElement;
};

export const attachTelnyxRemoteElement = (client: TelnyxRTC) => {
  client.remoteElement = getTelnyxRemoteAudioElement();
};
