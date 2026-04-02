import type { Word, Subtitle, Clip, SubtitleStyle } from "@/context/EditorContext";

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

/** ASS time format h:mm:ss.cs */
function assTime(sec: number): string {
  const h  = Math.floor(sec / 3600);
  const m  = Math.floor((sec % 3600) / 60);
  const s  = Math.floor(sec % 60);
  const cs = Math.round((sec % 1) * 100);
  return `${h}:${p2(m)}:${p2(s)}.${p2(cs)}`;
}

/**
 * Convert CSS colour string (#RRGGBB, rgba(...)) to
 * ASS hex "00BBGGRR" (little-endian BGR, no ampersands).
 */
function cssToAssHex(css: string): string {
  if (css.startsWith("rgba") || css.startsWith("rgb")) {
    const m = css.match(/\d+/g);
    if (!m || m.length < 3) return "00FFFFFF";
    const r = parseInt(m[0]).toString(16).padStart(2, "0");
    const g = parseInt(m[1]).toString(16).padStart(2, "0");
    const b = parseInt(m[2]).toString(16).padStart(2, "0");
    return `00${b}${g}${r}`.toUpperCase();
  }
  const clean = css.replace("#", "");
  if (clean.length !== 6) return "00FFFFFF";
  return `00${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}`.toUpperCase();
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

// ─── ASS generator (word-level karaoke highlighting) ─────────────────────────

const WORDS_PER_LINE_ASS = 4;

/**
 * Generates an ASS subtitle file with per-word karaoke highlighting.
 *
 * Primary colour  = subtitleStyle.activeColor  (the word currently being spoken)
 * Secondary colour = subtitleStyle.textColor   (words not yet reached)
 *
 * libass `\k<cs>` advances the karaoke highlight word by word. Each word
 * becomes primary colour for its spoken duration, then stays primary; upcoming
 * words show in secondary (white). This gives a clean "current word = yellow"
 * look on the exported video.
 */
export function generateAss(
  transcript: Word[],
  subtitles: Subtitle[],
  clips: Clip[],
  subtitleStyle: SubtitleStyle,
): string {
  const sorted = [...clips].sort((a, b) => a.startSec - b.startSec);

  const primaryHex   = cssToAssHex(subtitleStyle.activeColor);
  const secondaryHex = cssToAssHex(
    subtitleStyle.textColor.startsWith("rgba") ? "#ffffff" : subtitleStyle.textColor,
  );
  const outlineHex = cssToAssHex(subtitleStyle.shadowColor);
  const marginV    = Math.max(5, Math.round(720 * (1 - subtitleStyle.verticalPos / 100) - 30));

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1080",
    "PlayResY: 1920",
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,Heebo,52,&H${primaryHex}&,&H${secondaryHex}&,&H${outlineHex}&,&H00000000&,-1,0,0,0,100,100,0,0,1,3,0,2,20,20,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");

  const events: string[] = [];

  if (transcript.length > 0) {
    // ── Word-level karaoke from transcript ─────────────────────────────────
    for (let i = 0; i < transcript.length; i += WORDS_PER_LINE_ASS) {
      const chunk = transcript.slice(i, i + WORDS_PER_LINE_ASS);
      const lineStart = remapTime(chunk[0].start, sorted);
      const lineEnd   = remapTime(chunk[chunk.length - 1].end, sorted);
      if (lineStart < 0 || lineEnd < 0 || lineEnd <= lineStart + 0.01) continue;

      let kText = "";
      for (const word of chunk) {
        const wStart = remapTime(word.start, sorted);
        const wEnd   = remapTime(word.end,   sorted);
        if (wStart < 0 || wEnd < 0) continue;
        // \k<cs> = duration of this syllable in centiseconds
        const cs = Math.max(1, Math.round((wEnd - wStart) * 100));
        kText += `{\\k${cs}}${word.text} `;
      }

      events.push(
        `Dialogue: 0,${assTime(lineStart)},${assTime(lineEnd)},Default,,0,0,0,,${kText.trim()}`,
      );
    }
  } else {
    // ── Fallback: one event per subtitle line, no karaoke ──────────────────
    for (const sub of subtitles) {
      const vs = remapTime(sub.startSec, sorted);
      const ve = remapTime(sub.endSec,   sorted);
      if (vs < 0 || ve < 0 || ve <= vs + 0.01) continue;
      events.push(
        `Dialogue: 0,${assTime(vs)},${assTime(ve)},Default,,0,0,0,,${sub.text}`,
      );
    }
  }

  return header + "\n" + events.join("\n");
}
