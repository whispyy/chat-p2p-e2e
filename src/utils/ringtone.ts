let ctx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Play a repeating double-beep ringtone pattern. */
export function startRingtone(): void {
  stopRingtone();

  const audioCtx = getContext();
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 0;
  gainNode.connect(audioCtx.destination);

  oscillator = audioCtx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = 440;
  oscillator.connect(gainNode);
  oscillator.start();

  // Double-beep pattern: beep-beep ... beep-beep ...
  let step = 0;
  const pattern = () => {
    if (!gainNode) return;
    const now = audioCtx.currentTime;
    switch (step % 4) {
      case 0: // first beep on
        gainNode.gain.setValueAtTime(0.15, now);
        break;
      case 1: // first beep off
        gainNode.gain.setValueAtTime(0, now);
        break;
      case 2: // second beep on (higher pitch)
        if (oscillator) oscillator.frequency.setValueAtTime(520, now);
        gainNode.gain.setValueAtTime(0.15, now);
        break;
      case 3: // second beep off + reset pitch
        gainNode.gain.setValueAtTime(0, now);
        if (oscillator) oscillator.frequency.setValueAtTime(440, now);
        break;
    }
    step++;
  };

  pattern();
  intervalId = setInterval(pattern, 300);
}

export function stopRingtone(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (oscillator) {
    oscillator.stop();
    oscillator.disconnect();
    oscillator = null;
  }
  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }
}
