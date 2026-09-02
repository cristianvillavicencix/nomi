export type VoiceAudioInputDevice = {
  deviceId: string;
  label: string;
};

const PREFERRED_MIC_STORAGE_KEY = "nomi.voice.preferredMicrophoneId";

export const loadPreferredMicrophoneId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(PREFERRED_MIC_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
};

export const savePreferredMicrophoneId = (deviceId: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERRED_MIC_STORAGE_KEY, deviceId);
  } catch {
    // Ignore quota / private mode.
  }
};

/** Request mic permission so enumerateDevices returns real labels. */
export const ensureMicrophonePermission = async (): Promise<boolean> => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return true;
  } catch {
    return false;
  }
};

export const listVoiceAudioInputDevices = async (): Promise<
  VoiceAudioInputDevice[]
> => {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }

  await ensureMicrophonePermission();
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "audioinput" && device.deviceId)
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label.trim() || `Microphone ${index + 1}`,
    }));
};

export const resolvePreferredMicrophoneId = (
  devices: VoiceAudioInputDevice[],
  preferredId: string | null,
): string | null => {
  if (devices.length === 0) return null;
  if (preferredId && devices.some((device) => device.deviceId === preferredId)) {
    return preferredId;
  }
  return devices[0]?.deviceId ?? null;
};
