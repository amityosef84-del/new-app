import { NextRequest, NextResponse } from "next/server";
import { DeepgramClient } from "@deepgram/sdk";

export async function POST(req: NextRequest) {
  const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();
  const openaiKey   = process.env.OPENAI_API_KEY?.trim();

  if (!deepgramKey && !openaiKey) {
    return NextResponse.json({ error: "TRANSCRIPTION_SERVICE_NOT_CONFIGURED" }, { status: 501 });
  }

  if (deepgramKey) return handleDeepgram(req, deepgramKey);
  return handleWhisper(req, openaiKey!);
}

// ─── Deepgram (SDK v5) ────────────────────────────────────────────────────────

async function handleDeepgram(req: NextRequest, apiKey: string) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  console.log(`[Deepgram] file=${file.name} type=${file.type} size=${buffer.length}B`);

  // SDK v5: constructor option key is `apiKey`
  const client = new DeepgramClient({ apiKey });

  const dgParams = { model: "general", language: "he" };
  console.log("[Deepgram] request params:", JSON.stringify(dgParams));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let response: any;
  try {
    response = await client.listen.v1.media.transcribeFile(buffer, dgParams);
  } catch (err) {
    const msg = JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2);
    console.error("[Deepgram] SDK error:", msg);
    return NextResponse.json({ error: "Deepgram SDK error", detail: String(err) }, { status: 500 });
  }

  console.log("[Deepgram] response keys:", Object.keys(response ?? {}).join(", "));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alt: any = response?.results?.channels?.[0]?.alternatives?.[0];
  console.log("[Deepgram] transcript:", String(alt?.transcript ?? "").slice(0, 120));
  console.log("[Deepgram] word count:", alt?.words?.length ?? 0);
  if (alt?.words?.length) console.log("[Deepgram] first word:", JSON.stringify(alt.words[0]));

  if (!alt) {
    console.error("[Deepgram] unexpected shape:", JSON.stringify(response, null, 2).slice(0, 600));
    return NextResponse.json({ words: [] });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const words = (alt.words ?? []).map((w: any, i: number) => ({
    id:         `w${i}`,
    text:       w.word ?? "",
    start:      w.start      ?? 0,
    end:        w.end        ?? 0,
    confidence: w.confidence ?? 0.9,
  }));

  return NextResponse.json({ words });
}

// ─── OpenAI Whisper ───────────────────────────────────────────────────────────

interface WhisperWord { word?: string; text?: string; start: number; end: number; }

async function handleWhisper(req: NextRequest, apiKey: string) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const whisperForm = new FormData();
  whisperForm.append("file",                      file, file.name || "audio.wav");
  whisperForm.append("model",                     "whisper-1");
  whisperForm.append("language",                  "he");
  whisperForm.append("response_format",           "verbose_json");
  whisperForm.append("timestamp_granularities[]", "word");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperForm,
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`[Whisper] error ${res.status}:`, detail);
    return NextResponse.json({ error: "Whisper API error", detail }, { status: res.status });
  }

  const data = await res.json() as { words?: WhisperWord[] };
  const words = (data?.words ?? []).map((w, i) => ({
    id:         `w${i}`,
    text:       w.word ?? w.text ?? "",
    start:      w.start,
    end:        w.end,
    confidence: 0.95,
  }));

  return NextResponse.json({ words });
}
