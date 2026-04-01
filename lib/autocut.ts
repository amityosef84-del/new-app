import { Clip, CLIP_COLORS } from "@/context/EditorContext";

export interface SilenceSegment { start: number; end: number; }

export interface AutoCutResult {
  clips: Clip[];
  silenceSegments: SilenceSegment[];
  removedDuration: number;
}

interface AutoCutOptions {
  /** RMS amplitude below which a window is classified as silent (0–1). Default 0.015. */
  silenceThreshold?: number;
  /** Minimum consecutive silence duration to remove, in seconds. Default 0.5. */
  minSilenceDuration?: number;
  /** Analysis window size in milliseconds. Default 50. */
  windowMs?: number;
  /** How many ms of audio to preserve before / after each silence boundary. Default 50. */
  paddingMs?: number;
}

/**
 * Analyses the audio track of `file` using the Web Audio API, identifies
 * silent regions, and returns a clip list covering only the talking parts.
 */
export async function runAutoCut(
  file: File,
  duration: number,
  options: AutoCutOptions = {},
): Promise<AutoCutResult> {
  const {
    silenceThreshold  = 0.015,
    minSilenceDuration = 0.5,
    windowMs          = 50,
    paddingMs         = 120,
  } = options;

  // ── 1. Decode audio ───────────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  const decodeCtx   = new AudioContext();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    await decodeCtx.close();
  }

  // ── 2. Mix channels → mono Float32 ───────────────────────────────────────
  const { sampleRate, numberOfChannels, length } = audioBuffer;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / numberOfChannels;
  }

  // ── 3. RMS per window ─────────────────────────────────────────────────────
  const windowSamples = Math.ceil((windowMs / 1000) * sampleRate);
  const numWindows    = Math.ceil(length / windowSamples);
  const windowRms: number[] = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSamples;
    const end   = Math.min(start + windowSamples, length);
    let sum = 0;
    for (let i = start; i < end; i++) sum += mono[i] * mono[i];
    windowRms.push(Math.sqrt(sum / (end - start)));
  }

  // Use at most 10 % of peak as silence floor (handles quiet recordings)
  const peakRms    = Math.max(...windowRms, 0.001);
  const threshold  = Math.min(silenceThreshold, peakRms * 0.1);
  const windowSec  = windowMs / 1000;
  const paddingSec = paddingMs / 1000;

  // ── 4. Merge consecutive silent windows → silence segments ────────────────
  const rawSilences: SilenceSegment[] = [];
  let silStart = -1;

  for (let w = 0; w <= numWindows; w++) {
    const silent = w < numWindows && windowRms[w] < threshold;
    if (silent) {
      if (silStart === -1) silStart = w;
    } else {
      if (silStart !== -1) {
        const s = silStart * windowSec;
        const e = w * windowSec;
        if (e - s >= minSilenceDuration) rawSilences.push({ start: s, end: e });
        silStart = -1;
      }
    }
  }

  // ── 5. Shrink silences by paddingSec to preserve natural boundaries ───────
  const silences = rawSilences
    .map(s => ({ start: s.start + paddingSec, end: s.end - paddingSec }))
    .filter(s => s.end > s.start + 0.05);

  // ── 6. Talking segments = complement of silences ──────────────────────────
  const talking: Array<{ start: number; end: number }> = [];
  let pos = 0;

  for (const sil of silences) {
    if (sil.start > pos + 0.05) {
      talking.push({ start: Math.max(0, pos), end: Math.min(duration, sil.start) });
    }
    pos = sil.end;
  }
  if (pos < duration - 0.05) {
    talking.push({ start: Math.max(0, pos), end: duration });
  }

  // Fallback: no silence found → single full-duration clip
  if (talking.length === 0) talking.push({ start: 0, end: duration });

  // ── 7. Convert to Clip objects ────────────────────────────────────────────
  const LABELS = ["פתיחה", "תוכן", "חלק ב׳", "שיא", "סיכום", "סיום"];
  const clips: Clip[] = talking.map((seg, i) => ({
    id:         `ac${i}`,
    startSec:   parseFloat(seg.start.toFixed(3)),
    endSec:     parseFloat(seg.end.toFixed(3)),
    label:      LABELS[i] ?? `קטע ${i + 1}`,
    transition: (i > 0 ? "zoom" : "none") as Clip["transition"],
    color:      CLIP_COLORS[i % CLIP_COLORS.length],
  }));

  const removedDuration = silences.reduce((acc, s) => acc + (s.end - s.start), 0);

  return { clips, silenceSegments: silences, removedDuration };
}
