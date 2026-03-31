import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/transcribe
 *
 * Accepts a multipart FormData body with a "file" field (video/audio).
 *
 * Priority:
 *  1. Deepgram Nova-2  — if DEEPGRAM_API_KEY is set (best Hebrew word-level timestamps)
 *  2. OpenAI Whisper   — if OPENAI_API_KEY is set (verbose_json with word timestamps)
 *  3. 501 Not Implemented — if neither key is present; the client falls back to
 *     local Web Audio amplitude analysis automatically.
 */
export async function POST(req: NextRequest) {
  const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();
  const openaiKey   = process.env.OPENAI_API_KEY?.trim();

  if (!deepgramKey && !openaiKey) {
    return NextResponse.json(
      {
        error: "TRANSCRIPTION_SERVICE_NOT_CONFIGURED",
        message:
          "No transcription API key found. Set DEEPGRAM_API_KEY or OPENAI_API_KEY " +
          "in your environment variables to enable real speech-to-text. " +
          "The editor is currently using local amplitude analysis as a fallback.",
      },
      { status: 501 },
    );
  }

  // Deepgram preferred — better Hebrew support and richer word-level timestamps
  if (deepgramKey) return handleDeepgram(req, deepgramKey);
  return handleWhisper(req, openaiKey!);
}

// ─── Deepgram Nova-2 ──────────────────────────────────────────────────────────

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

async function handleDeepgram(req: NextRequest, apiKey: string) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  const url = new URL("https://api.deepgram.com/v1/listen");
  url.searchParams.set("model",        "nova-2");
  url.searchParams.set("language",     "he");        // Hebrew
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("utterances",   "true");
  url.searchParams.set("words",        "true");
  url.searchParams.set("punctuate",    "true");

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": file.type || "audio/webm",
    },
    body: buffer,
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: "Deepgram API error", detail },
      { status: res.status },
    );
  }

  const data = await res.json() as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ words?: DeepgramWord[] }>;
      }>;
    };
  };

  const raw: DeepgramWord[] =
    data?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];

  const words = raw.map((w, i) => ({
    id:         `w${i}`,
    text:       w.word,
    start:      w.start,
    end:        w.end,
    confidence: w.confidence,
  }));

  return NextResponse.json({ words });
}

// ─── OpenAI Whisper Large V3 ──────────────────────────────────────────────────

interface WhisperWord {
  word?: string;
  text?: string;
  start: number;
  end: number;
}

async function handleWhisper(req: NextRequest, apiKey: string) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const whisperForm = new FormData();
  whisperForm.append("file",  file, file.name || "audio.webm");
  whisperForm.append("model", "whisper-1");
  // Hebrew ISO 639-1 code
  whisperForm.append("language",                   "he");
  whisperForm.append("response_format",            "verbose_json");
  // Request word-level timestamps
  whisperForm.append("timestamp_granularities[]",  "word");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperForm,
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: "OpenAI Whisper API error", detail },
      { status: res.status },
    );
  }

  const data = await res.json() as { words?: WhisperWord[] };
  const raw: WhisperWord[] = data?.words ?? [];

  const words = raw.map((w, i) => ({
    id:         `w${i}`,
    text:       w.word ?? w.text ?? "",
    start:      w.start,
    end:        w.end,
    // Whisper verbose_json omits per-word confidence — use a high default
    confidence: 0.95,
  }));

  return NextResponse.json({ words });
}
