import { z } from "zod";

// Text to speech with ElevenLabs, called over plain HTTP.
// https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps

const API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const TIMEOUT_MS = 30_000;
// 64 kbps keeps a 90-second video under 1 MB of audio, so it fits in one API response.
const OUTPUT_FORMAT = "mp3_44100_64";
const BYTES_PER_SECOND = 64_000 / 8;
// Multilingual v2 is the most stable model for narration split into parts. It has no Norwegian, so
// Norwegian uses Flash v2.5.
const MODELS = { en: "eleven_multilingual_v2", no: "eleven_flash_v2_5" } as const;

const SpeechSchema = z.object({
  audio_base64: z.string(),
  alignment: z.object({ character_end_times_seconds: z.array(z.number()) }).nullish(),
});

export function voiceIsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
}

export type Speech = { audioBase64: string; durationSec: number };

// The text before and after helps the voice keep a natural flow across scenes.
export async function speak(input: {
  text: string;
  previousText?: string;
  nextText?: string;
  language: keyof typeof MODELS;
}): Promise<Speech> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) throw new Error("ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID is not set.");

  const started = performance.now();
  const response = await fetch(`${API_URL}/${voiceId}/with-timestamps?output_format=${OUTPUT_FORMAT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      text: input.text,
      model_id: MODELS[input.language],
      previous_text: input.previousText,
      next_text: input.nextText,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs failed with HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const speech = SpeechSchema.parse(await response.json());

  // The speech ends when the last character ends. Without timings, estimate it from the file size.
  const ends = speech.alignment?.character_end_times_seconds ?? [];
  const durationSec = ends.length > 0 ? ends[ends.length - 1] : (speech.audio_base64.length * 0.75) / BYTES_PER_SECOND;
  console.log(
    `[elevenlabs] ${input.text.length} characters, ${durationSec.toFixed(1)} s of speech, ${Math.round(performance.now() - started)} ms`,
  );
  return { audioBase64: speech.audio_base64, durationSec };
}
