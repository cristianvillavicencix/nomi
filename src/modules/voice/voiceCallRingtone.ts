type RingtoneMode = "incoming" | "outbound";

let audioContext: AudioContext | null = null;
let activeMode: RingtoneMode | null = null;
let loopTimer: ReturnType<typeof setTimeout> | null = null;
let activeNodes: AudioScheduledSourceNode[] = [];

const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const AudioCtx =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  return audioContext;
};

/** Resume audio after login / first interaction so ringtones can play. */
export const unlockVoiceCallAudio = async () => {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "suspended") return;
  try {
    await ctx.resume();
  } catch {
    // Browser may block until a user gesture; ringtone starts on next unlock.
  }
};

const clearScheduledLoop = () => {
  if (loopTimer != null) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
};

const stopActiveNodes = () => {
  for (const node of activeNodes) {
    try {
      node.stop();
    } catch {
      // Already stopped.
    }
    node.disconnect();
  }
  activeNodes = [];
};

const playDualToneBurst = (
  ctx: AudioContext,
  frequencyA: number,
  frequencyB: number,
  durationSec: number,
  gainValue: number,
) => {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + 0.02);
  gain.gain.setValueAtTime(gainValue, ctx.currentTime + durationSec - 0.04);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSec);
  gain.connect(ctx.destination);

  for (const frequency of [frequencyA, frequencyB]) {
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + durationSec);
    activeNodes.push(oscillator);
  }
};

/** North American ring pattern: two short bursts, then pause. */
const playIncomingBurst = (ctx: AudioContext) => {
  playDualToneBurst(ctx, 440, 480, 0.4, 0.12);
  setTimeout(() => {
    if (activeMode !== "incoming") return;
    playDualToneBurst(ctx, 440, 480, 0.4, 0.12);
  }, 550);
};

/** US ringback: 2s tone, 4s silence. */
const playOutboundBurst = (ctx: AudioContext) => {
  playDualToneBurst(ctx, 440, 480, 2, 0.1);
};

const scheduleLoop = (mode: RingtoneMode) => {
  clearScheduledLoop();
  const ctx = getAudioContext();
  if (!ctx || activeMode !== mode) return;

  if (mode === "incoming") {
    stopActiveNodes();
    playIncomingBurst(ctx);
    loopTimer = setTimeout(() => scheduleLoop("incoming"), 4000);
    return;
  }

  stopActiveNodes();
  playOutboundBurst(ctx);
  loopTimer = setTimeout(() => scheduleLoop("outbound"), 6000);
};

export const startVoiceCallRingtone = async (mode: RingtoneMode) => {
  if (activeMode === mode) return;
  stopVoiceCallRingtone();
  activeMode = mode;
  await unlockVoiceCallAudio();
  const ctx = getAudioContext();
  if (!ctx) return;
  scheduleLoop(mode);
};

export const stopVoiceCallRingtone = () => {
  activeMode = null;
  clearScheduledLoop();
  stopActiveNodes();
};
