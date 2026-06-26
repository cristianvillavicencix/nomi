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

export const playNotificationSound = () => {
  const context = getAudioContext();
  if (!context) return;

  const playTone = (frequency: number, startTime: number, duration: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.08, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };

  void context.resume().then(() => {
    primed = true;
    const now = context.currentTime;
    playTone(880, now, 0.12);
    playTone(1175, now + 0.13, 0.16);
  });
};

/** Loud alert for ticket messages and assignments. */
export const playTicketNotificationSound = () => {
  const context = getAudioContext();
  if (!context) return;

  const playPulse = (
    frequency: number,
    startTime: number,
    duration: number,
    volume: number,
    type: OscillatorType = "square",
  ) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.01);
  };

  void context.resume().then(() => {
    primed = true;
    const now = context.currentTime;
    playPulse(440, now, 0.1, 0.34, "square");
    playPulse(880, now + 0.11, 0.1, 0.38, "sawtooth");
    playPulse(660, now + 0.22, 0.14, 0.36, "square");
  });
};

/** @deprecated use playNotificationSound */
export const playMessageNotificationSound = playNotificationSound;
