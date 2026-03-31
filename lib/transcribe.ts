import { Word, Subtitle } from "@/context/EditorContext";

// ─── Error class ─────────────────────────────────────────────────────────────

export class TranscriptionError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "TranscriptionError";
    this.code = code;
  }
}

// ─── API transcription ────────────────────────────────────────────────────────

export async function transcribeVideo(file: File): Promise<Word[]> {
  let response: Response;

  try {
    const formData = new FormData();
    formData.append("file", file);
    response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });
  } catch {
    // Network error — propagate as transcription error
    throw new TranscriptionError(
      "Network error: could not reach transcription service",
      "NETWORK_ERROR"
    );
  }

  if (response.status === 501) {
    throw new TranscriptionError(
      "No transcription API key configured. Please set DEEPGRAM_API_KEY or OPENAI_API_KEY.",
      "NOT_CONFIGURED"
    );
  }

  if (!response.ok) {
    throw new TranscriptionError(
      `Transcription request failed with status ${response.status}`,
      `HTTP_${response.status}`
    );
  }

  const data = (await response.json()) as { words: Word[] };
  return data.words;
}

// ─── Words → subtitles ────────────────────────────────────────────────────────

export function wordsToSubtitles(words: Word[], wordsPerLine = 4): Subtitle[] {
  const subtitles: Subtitle[] = [];

  for (let i = 0; i < words.length; i += wordsPerLine) {
    const chunk = words.slice(i, i + wordsPerLine);
    subtitles.push({
      id: `sub-${i / wordsPerLine}`,
      startSec: chunk[0].start,
      endSec: chunk[chunk.length - 1].end,
      text: chunk.map((w) => w.text).join(" "),
    });
  }

  return subtitles;
}
