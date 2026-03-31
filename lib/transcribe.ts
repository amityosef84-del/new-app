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

// ─── Client-side audio extraction ────────────────────────────────────────────
// Decodes the video/audio file in the browser using Web Audio API,
// downsamples to 16 kHz mono PCM, and returns a tiny WAV File.
// A 60-second clip at 16 kHz mono → ~1.9 MB, well inside Vercel's 4.5 MB limit.

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataLen = samples.length * 2; // 16-bit samples
  const buf     = new ArrayBuffer(44 + dataLen);
  const view    = new DataView(buf);

  writeString(view, 0,  "RIFF");
  view.setUint32(4,  36 + dataLen,    true); // file size - 8
  writeString(view, 8,  "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16,              true); // sub-chunk size
  view.setUint16(20, 1,               true); // PCM format
  view.setUint16(22, 1,               true); // mono
  view.setUint32(24, sampleRate,      true); // sample rate
  view.setUint32(28, sampleRate * 2,  true); // byte rate
  view.setUint16(32, 2,               true); // block align
  view.setUint16(34, 16,              true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataLen,         true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buf;
}

async function extractAudio(file: File): Promise<File> {
  const TARGET_RATE = 16_000; // 16 kHz — ideal for speech recognition

  // 1. Decode audio from the video container (any format the browser supports)
  const arrayBuffer = await file.arrayBuffer();
  const decodeCtx   = new AudioContext();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    await decodeCtx.close();
  }

  // 2. Resample to 16 kHz mono via OfflineAudioContext
  //    Connecting a multi-channel source to a 1-channel destination is enough —
  //    the Web Audio spec mandates automatic stereo→mono downmix.
  const numSamples = Math.ceil(audioBuffer.duration * TARGET_RATE);
  const offlineCtx = new OfflineAudioContext(1, numSamples, TARGET_RATE);
  const source     = offlineCtx.createBufferSource();
  source.buffer    = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();

  // 3. Encode as 16-bit PCM WAV
  const pcm    = rendered.getChannelData(0);
  const wav    = encodeWav(pcm, TARGET_RATE);
  const sizeMB = (wav.byteLength / 1_048_576).toFixed(2);
  console.log(`[extractAudio] ${audioBuffer.duration.toFixed(1)}s → WAV ${sizeMB} MB (16 kHz mono)`);

  return new File([wav], "audio.wav", { type: "audio/wav" });
}

// ─── API transcription ────────────────────────────────────────────────────────

export async function transcribeVideo(file: File): Promise<Word[]> {
  // Extract audio client-side first to keep payload small (avoids 413 on Vercel)
  let audioFile: File;
  try {
    audioFile = await extractAudio(file);
  } catch (err) {
    console.warn("[transcribeVideo] audio extraction failed, sending original file:", err);
    audioFile = file; // fall back to original if Web Audio API unavailable
  }

  let response: Response;
  try {
    const formData = new FormData();
    formData.append("file", audioFile);
    response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });
  } catch {
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
