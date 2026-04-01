import type { Word, Subtitle, Clip } from "@/context/EditorContext";

// ─── Time formatting ──────────────────────────────────────────────────────────

const p2 = (n: number) => String(n).padStart(2, "0");
const p3 = (n: number) => String(n).padStart(3, "0");

function srtTime(sec: number): string {
  const h  = Math.floor(sec / 3600);
  const m  = Math.floor((sec % 3600) / 60);
  const s  = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${p2(h)}:${p2(m)}:${p2(s)},${p3(ms)}`;
}

// ─── Timeline remapping ───────────────────────────────────────────────────────

/**
 * Maps an original-video timestamp to the post-auto-cut virtual timeline.
 * Returns -1 if `t` falls inside a removed silence gap.
 */
export function remapTime(t: number, clips: Clip[]): number {
  if (clips.length === 0) return t;

  // Sort defensively (they should already be ordered)
  const sorted = [...clips].sort((a, b) => a.startSec - b.startSec);
  let virtualOffset = 0;

  for (const clip of sorted) {
    if (t < clip.startSec) return -1;             // inside a gap
    if (t <= clip.endSec)  return virtualOffset + (t - clip.startSec);
    virtualOffset += clip.endSec - clip.startSec;
  }
  return virtualOffset; // past the last clip
}

// ─── SRT generator ────────────────────────────────────────────────────────────

const WORDS_PER_LINE = 4;

/**
 * Generates an SRT subtitle string from transcript words (preferred) or
 * subtitle chunks, with timestamps remapped for any auto-cut gaps.
 */
export function generateSrt(
  transcript: Word[],
  subtitles: Subtitle[],
  clips: Clip[],
): string {
  const lines: { start: number; end: number; text: string }[] = [];

  if (transcript.length > 0) {
    for (let i = 0; i < transcript.length; i += WORDS_PER_LINE) {
      const chunk = transcript.slice(i, i + WORDS_PER_LINE);
      lines.push({
        start: chunk[0].start,
        end:   chunk[chunk.length - 1].end,
        text:  chunk.map(w => w.text).join(" "),
      });
    }
  } else {
    for (const sub of subtitles) {
      lines.push({ start: sub.startSec, end: sub.endSec, text: sub.text });
    }
  }

  let srt = "";
  let idx = 1;

  for (const line of lines) {
    const vs = remapTime(line.start, clips);
    const ve = remapTime(line.end,   clips);
    if (vs < 0 || ve < 0 || ve <= vs + 0.01) continue; // in gap or zero-duration
    srt += `${idx}\n${srtTime(vs)} --> ${srtTime(ve)}\n${line.text}\n\n`;
    idx++;
  }

  return srt;
}
