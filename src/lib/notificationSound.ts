import type { NotificationCategory } from "@/modules/notifications/types";

let audioContext: AudioContext | null = null;
let primed = false;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

export const primeNotificationAudioContext = () => {
  if (primed) return;
  const context = getAudioContext();
  if (!context) return;
  void context
    .resume()
    .then(() => {
      primed = true;
    })
    .catch(() => {});
};

/** @deprecated use primeNotificationAudioContext */
export const primeAudioContext = primeNotificationAudioContext;

type PulseOptions = {
  frequency: number;
  startTime: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
};

const playPulse = (
  context: AudioContext,
  { frequency, startTime, duration, volume, type = "square" }: PulseOptions,
) => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.01);
};

const playPattern = (
  context: AudioContext,
  pulses: Omit<PulseOptions, "startTime">[],
) => {
  let startTime = context.currentTime;
  for (const pulse of pulses) {
    playPulse(context, { ...pulse, startTime });
    startTime += pulse.duration + 0.1;
  }
};

/** Distinct loud patterns per category (all clearly audible). */
export const playNotificationSoundForCategory = (
  category: NotificationCategory,
) => {
  const context = getAudioContext();
  if (!context) return;

  void context.resume().then(() => {
    primed = true;
    const loud = 0.36;

    switch (category) {
      case "messages_sms":
        playPattern(context, [
          { frequency: 1046, duration: 0.1, volume: loud, type: "square" },
          { frequency: 1318, duration: 0.12, volume: loud, type: "square" },
        ]);
        break;
      case "messages_internal":
        playPattern(context, [
          { frequency: 740, duration: 0.09, volume: loud * 0.95, type: "sawtooth" },
          { frequency: 988, duration: 0.09, volume: loud, type: "sawtooth" },
          { frequency: 1175, duration: 0.11, volume: loud, type: "sawtooth" },
        ]);
        break;
      case "tickets_message":
        playPattern(context, [
          { frequency: 440, duration: 0.1, volume: loud, type: "square" },
          { frequency: 880, duration: 0.1, volume: loud + 0.02, type: "sawtooth" },
          { frequency: 660, duration: 0.14, volume: loud, type: "square" },
        ]);
        break;
      case "tickets_assigned":
        playPattern(context, [
          { frequency: 523, duration: 0.08, volume: loud, type: "square" },
          { frequency: 659, duration: 0.08, volume: loud, type: "square" },
          { frequency: 784, duration: 0.14, volume: loud + 0.03, type: "sawtooth" },
        ]);
        break;
      case "tasks_mention":
        playPattern(context, [
          { frequency: 622, duration: 0.09, volume: loud, type: "triangle" },
          { frequency: 932, duration: 0.12, volume: loud, type: "square" },
        ]);
        break;
      case "leads_followup_due":
        playPattern(context, [
          { frequency: 392, duration: 0.11, volume: loud, type: "sawtooth" },
          { frequency: 523, duration: 0.11, volume: loud, type: "sawtooth" },
        ]);
        break;
      case "leads_stale":
        playPattern(context, [
          { frequency: 349, duration: 0.1, volume: loud, type: "square" },
          { frequency: 466, duration: 0.1, volume: loud, type: "square" },
          { frequency: 587, duration: 0.12, volume: loud, type: "square" },
        ]);
        break;
      case "bookings_new":
        playPattern(context, [
          { frequency: 880, duration: 0.08, volume: loud, type: "triangle" },
          { frequency: 1108, duration: 0.1, volume: loud + 0.02, type: "triangle" },
          { frequency: 1320, duration: 0.12, volume: loud, type: "triangle" },
        ]);
        break;
      default:
        playPattern(context, [
          { frequency: 880, duration: 0.1, volume: loud, type: "square" },
          { frequency: 1175, duration: 0.12, volume: loud, type: "square" },
        ]);
    }
  });
};

/** @deprecated use playNotificationSoundForCategory */
export const playNotificationSound = () => {
  playNotificationSoundForCategory("messages_internal");
};

/** @deprecated use playNotificationSoundForCategory */
export const playTicketNotificationSound = () => {
  playNotificationSoundForCategory("tickets_message");
};

/** @deprecated use playNotificationSoundForCategory */
export const playMessageNotificationSound = playNotificationSound;
