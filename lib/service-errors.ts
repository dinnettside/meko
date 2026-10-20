import OpenAI from "openai";

const STILL_PLAY = "Videos already made still play.";

// The HTTP status of a Token Factory error from the openai SDK. Checked by shape too, since a second copy of the SDK
// (as when a script loads it another way) makes `instanceof` fail.
function modelStatus(error: unknown): number | undefined {
  if (error instanceof OpenAI.APIError) return error.status;
  const shaped = error as { status?: unknown; headers?: unknown; error?: unknown } | null;
  return error instanceof Error && typeof shaped?.status === "number" && "headers" in error && "error" in error ? shaped.status : undefined;
}

// A sentence people can act on when a paid service refuses the work: it is out of credit, it does not accept its key,
// or it is busy. Null for every other error. The original error may sit in the `cause` of the one thrown.
export function serviceProblem(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const message = current instanceof Error ? current.message : String(current);
    const status = modelStatus(current);
    if (status !== undefined) {
      if (status === 402 || /insufficient|balance|credit|quota|billing|payment/i.test(message)) {
        return `The language model service (Nebius Token Factory) has run out of credit, so new videos cannot be made right now. ${STILL_PLAY}`;
      }
      if (status === 401 || status === 403) {
        return `The language model service (Nebius Token Factory) did not accept its key, so new videos cannot be made right now. ${STILL_PLAY}`;
      }
      if (status === 429) return "The language model service is busy. Wait a minute, then try again.";
    }
    const search = /^Tavily search failed with HTTP (\d+)/.exec(message);
    if (search) {
      if (search[1] === "432" || search[1] === "433") {
        return `Web search (Tavily) has used up its credits for this month, so new videos cannot be made right now. ${STILL_PLAY}`;
      }
      if (search[1] === "401" || search[1] === "403") return `Web search (Tavily) did not accept its key, so new videos cannot be made right now. ${STILL_PLAY}`;
      if (search[1] === "429") return "Web search is busy. Wait a minute, then try again.";
    }
    const voice = /^ElevenLabs failed with HTTP (\d+): ([\s\S]*)/.exec(message);
    if (voice) {
      if (voice[1] === "402" || /quota|credit|characters/i.test(voice[2])) {
        return "The voice service (ElevenLabs) has used up its characters for this month, so the video plays without a voice, with captions.";
      }
      if (voice[1] === "401" || voice[1] === "403") return "The voice service (ElevenLabs) did not accept its key, so the video plays without a voice, with captions.";
      if (voice[1] === "429") return "The voice service is busy. Wait a minute, then try again.";
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}
