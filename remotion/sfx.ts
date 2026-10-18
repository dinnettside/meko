// Sound effects made in code: short noises and tones synthesized as WAV files, so the video has no recorded or
// licensed sound. Each is a data: URL an audio tag can play. They are quiet and short, under the voice.

const RATE = 22050;

// A mono 16-bit WAV file of the samples, as a data: URL.
function wav(samples: Float32Array): string {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // size of the format chunk
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 32767, true));
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

// The same noise every time, so the video sounds the same each time it plays.
function noise(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 31 - 1;
  };
}

// Air rushing past: noise through a low-pass filter that opens and closes, swelling and fading. For a map's camera
// that zooms in.
function whoosh(seconds: number, seed: number): Float32Array {
  const samples = new Float32Array(Math.round(seconds * RATE));
  const random = noise(seed);
  let low = 0;
  samples.forEach((_, index) => {
    const t = index / samples.length;
    const swell = Math.sin(Math.PI * t) ** 2;
    // The filter opens to about 2.4 kHz in the middle and closes again, so the rush rises and falls in pitch.
    const cutoff = 300 + 2100 * Math.sin(Math.PI * t);
    const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
    low += alpha * (random() - low);
    samples[index] = low * swell * 0.9;
  });
  return samples;
}

// A soft, short pop with a falling pitch, for a thing that appears.
function pop(): Float32Array {
  const samples = new Float32Array(Math.round(0.09 * RATE));
  let phase = 0;
  samples.forEach((_, index) => {
    const t = index / RATE;
    phase += (2 * Math.PI * (700 - 2800 * t)) / RATE;
    samples[index] = Math.sin(phase) * Math.exp(-t * 45) * 0.6;
  });
  return samples;
}

// A low, round thud, for a number or a stamp that lands.
function thud(): Float32Array {
  const samples = new Float32Array(Math.round(0.25 * RATE));
  let phase = 0;
  samples.forEach((_, index) => {
    const t = index / RATE;
    phase += (2 * Math.PI * (110 - 120 * t)) / RATE;
    samples[index] = Math.sin(phase) * Math.exp(-t * 14) * 0.8;
  });
  return samples;
}

// A soft bell of two tones, for the title and the end.
function chime(): Float32Array {
  const samples = new Float32Array(Math.round(1.4 * RATE));
  samples.forEach((_, index) => {
    const t = index / RATE;
    const attack = Math.min(1, t / 0.01);
    samples[index] = attack * (Math.sin(2 * Math.PI * 659 * t) * 0.5 + Math.sin(2 * Math.PI * 988 * t) * 0.25) * Math.exp(-t * 3.2) * 0.5;
  });
  return samples;
}

// Built when first asked for, since only the browser plays them.
let cache: Record<"flight" | "pop" | "thud" | "chime", string> | null = null;
export function sounds() {
  cache ??= {
    flight: wav(whoosh(1.4, 11)),
    pop: wav(pop()),
    thud: wav(thud()),
    chime: wav(chime()),
  };
  return cache;
}
