// All sound is synthesized with WebAudio — no audio files, no network.
// Footsteps, a rising alarm, a gem chime and a win arpeggio.
export function createAudio() {
  let actx = null;
  let bus = null;

  function ensure() {
    if (actx) {
      if (actx.state === "suspended") void actx.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      actx = new AudioContext();
      bus = actx.createGain();
      bus.gain.value = 0.16;
      bus.connect(actx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(pitch, len, wave, loud, delay = 0, glide = 0) {
    if (!ensure()) return;
    const at = actx.currentTime + delay;
    const voice = actx.createOscillator();
    const level = actx.createGain();
    voice.type = wave;
    voice.frequency.setValueAtTime(pitch, at);
    if (glide > 0) voice.frequency.exponentialRampToValueAtTime(glide, at + len);
    level.gain.setValueAtTime(0, at);
    level.gain.linearRampToValueAtTime(loud, at + 0.012);
    level.gain.exponentialRampToValueAtTime(0.001, at + len);
    voice.connect(level);
    level.connect(bus);
    voice.start(at);
    voice.stop(at + len + 0.05);
  }

  return {
    /** Call from any user gesture so the browser unlocks sound. */
    unlock() {
      ensure();
    },
    footstep(pan) {
      if (!ensure()) return;
      const at = actx.currentTime;
      const voice = actx.createOscillator();
      const level = actx.createGain();
      const panner = actx.createStereoPanner ? actx.createStereoPanner() : null;
      voice.type = "sine";
      voice.frequency.setValueAtTime(95, at);
      voice.frequency.exponentialRampToValueAtTime(60, at + 0.07);
      level.gain.setValueAtTime(0.35, at);
      level.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
      voice.connect(level);
      if (panner) {
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        level.connect(panner);
        panner.connect(bus);
      } else {
        level.connect(bus);
      }
      voice.start(at);
      voice.stop(at + 0.1);
    },
    gem() {
      tone(880, 0.14, "sine", 0.5);
      tone(1318, 0.2, "sine", 0.4, 0.07);
    },
    spotted() {
      tone(392, 0.16, "triangle", 0.5, 0, 523);
    },
    alarm() {
      tone(220, 0.5, "sawtooth", 0.4, 0, 440);
      tone(220, 0.5, "sawtooth", 0.35, 0.18, 440);
    },
    caught() {
      tone(330, 0.7, "sawtooth", 0.5, 0, 82);
    },
    levelDone() {
      tone(523, 0.16, "triangle", 0.5);
      tone(659, 0.16, "triangle", 0.5, 0.12);
      tone(784, 0.3, "triangle", 0.5, 0.24);
    },
    won() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((pitch, i) => tone(pitch, 0.35, "triangle", 0.45, i * 0.13));
    },
    click() {
      tone(660, 0.06, "sine", 0.3);
    },
  };
}
