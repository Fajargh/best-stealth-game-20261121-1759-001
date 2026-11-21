// All sound is synthesized with WebAudio — no audio files, no network.
// Footsteps, a rising alarm, a gem chime and a win arpeggio.
export function createAudio() {
  let context = null;
  let master = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, volume, when = 0, slideTo = 0) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  return {
    /** Call from any user gesture so the browser unlocks sound. */
    unlock() {
      ensure();
    },
    footstep(pan) {
      if (!ensure()) return;
      const start = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      const panner = context.createStereoPanner ? context.createStereoPanner() : null;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, start);
      osc.frequency.exponentialRampToValueAtTime(60, start + 0.07);
      gain.gain.setValueAtTime(0.35, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
      osc.connect(gain);
      if (panner) {
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        gain.connect(panner);
        panner.connect(master);
      } else {
        gain.connect(master);
      }
      osc.start(start);
      osc.stop(start + 0.1);
    },
    gem() {
      tone(880, 0.14, 'sine', 0.5);
      tone(1318, 0.2, 'sine', 0.4, 0.07);
    },
    spotted() {
      tone(392, 0.16, 'triangle', 0.5, 0, 523);
    },
    alarm() {
      tone(220, 0.5, 'sawtooth', 0.4, 0, 440);
      tone(220, 0.5, 'sawtooth', 0.35, 0.18, 440);
    },
    caught() {
      tone(330, 0.7, 'sawtooth', 0.5, 0, 82);
    },
    levelDone() {
      tone(523, 0.16, 'triangle', 0.5);
      tone(659, 0.16, 'triangle', 0.5, 0.12);
      tone(784, 0.3, 'triangle', 0.5, 0.24);
    },
    won() {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => tone(freq, 0.35, 'triangle', 0.45, i * 0.13));
    },
    click() {
      tone(660, 0.06, 'sine', 0.3);
    },
  };
}
