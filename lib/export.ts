"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { Clip, Word, Subtitle, SubtitleStyle } from "@/context/EditorContext";
import { generateSrt, generateAss } from "./subtitleExport";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportProgress {
  phase: "loading" | "writing" | "encoding" | "done" | "error";
  percent: number;
  message: string;
}

export interface ExportResult {
  videoUrl: string;   // object URL — caller must revoke when done
  srtContent: string; // raw SRT text for a separate .srt download
}

// ─── FFmpeg core (single-threaded — no SharedArrayBuffer / COOP required) ────

const ST_CDN = "https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/esm";

// ─── Main export function ─────────────────────────────────────────────────────

export async function exportVideo(
  file: File,
  clips: Clip[],
  transcript: Word[],
  subtitles: Subtitle[],
  subtitleStyle: SubtitleStyle,
  onProgress: (p: ExportProgress) => void,
  musicUrl?: string,
): Promise<ExportResult> {

  // ── 1. Load FFmpeg WASM ────────────────────────────────────────────────────
  onProgress({ phase: "loading", percent: 2, message: "טוען FFmpeg…" });

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${ST_CDN}/ffmpeg-core.js`,   "text/javascript"),
    wasmURL: await toBlobURL(`${ST_CDN}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpeg.on("progress", ({ progress }) => {
    const pct = Math.round(15 + progress * 78);
    onProgress({ phase: "encoding", percent: pct, message: `מרנדר… ${pct}%` });
  });

  // ── 2. Write source video ──────────────────────────────────────────────────
  onProgress({ phase: "writing", percent: 6, message: "קורא קובץ וידאו…" });
  await ffmpeg.writeFile("input.mp4", await fetchFile(file));

  // ── 3. Fetch & write Hebrew font for libass ────────────────────────────────
  onProgress({ phase: "writing", percent: 9, message: "טוען פונט עברי…" });
  try {
    const fontResp = await fetch(
      "https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/static/Heebo-Bold.ttf",
    );
    if (fontResp.ok) {
      await ffmpeg.writeFile("Heebo-Bold.ttf", new Uint8Array(await fontResp.arrayBuffer()));
    }
  } catch { /* libass built-in fallback */ }

  // ── 4. Fetch & write background music ─────────────────────────────────────
  let hasMusicInput = false;
  if (musicUrl) {
    onProgress({ phase: "writing", percent: 11, message: "טוען מוזיקת רקע…" });
    try {
      const musicResp = await fetch(musicUrl);
      if (musicResp.ok) {
        await ffmpeg.writeFile("bgmusic.mp3", new Uint8Array(await musicResp.arrayBuffer()));
        hasMusicInput = true;
      }
    } catch { /* proceed without music */ }
  }

  // ── 5. Generate subtitles (ASS for karaoke word highlight + SRT for DL) ───
  const sorted = [...clips].sort((a, b) => a.startSec - b.startSec);
  const srtContent = generateSrt(transcript, subtitles, sorted);

  const assContent = generateAss(transcript, subtitles, sorted, subtitleStyle);
  const hasSubs    = assContent.trim().length > 0;

  if (hasSubs) {
    await ffmpeg.writeFile("subs.ass", new TextEncoder().encode(assContent));
  }

  // ── 6. Compute virtual timeline duration (for audio fade-out) ─────────────
  const virtualDuration = sorted.reduce((sum, c) => sum + (c.endSec - c.startSec), 0);
  const fadeStart = Math.max(0, virtualDuration - 0.5).toFixed(3);

  // ── 7. Build FFmpeg arguments ──────────────────────────────────────────────
  onProgress({ phase: "encoding", percent: 13, message: "בונה פקודת עריכה…" });

  const args: string[] = ["-i", "input.mp4"];
  if (hasMusicInput) args.push("-i", "bgmusic.mp3");

  // Detect whether auto-cut created actual gaps between clips
  const hasGaps = sorted.length > 1 &&
    sorted.some((c, i) => i > 0 && c.startSec > sorted[i - 1].endSec + 0.15);

  // subtitle filter — fontsdir=. lets libass find Heebo-Bold.ttf
  const subFilter = `ass=subs.ass:fontsdir=.`;

  // music audio filter: loop → volume 12% → mix with video audio → fade out
  const musicFilter = hasMusicInput
    ? `[${hasGaps ? "ac" : "0:a"}][1:a]` +
      `amix=inputs=2:duration=first:dropout_transition=2,` +
      `afade=t=out:st=${fadeStart}:d=0.5[aout]`
    : "";

  // Simplified: build a single music-only filter (input 1 looped + volume)
  // then mix: [origAudio][music]amix...
  const musicSetup = hasMusicInput
    ? `[1:a]aloop=loop=-1:size=2000000000,volume=0.12[bgm];`
    : "";

  if (hasGaps) {
    // ── Trim each talking segment, then concat ──────────────────────────────
    const n = sorted.length;
    const fcParts: string[] = [];

    for (let i = 0; i < n; i++) {
      const { startSec: s, endSec: e } = sorted[i];
      fcParts.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
      fcParts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
    }

    const vIn = sorted.map((_, i) => `[v${i}]`).join("");
    const aIn = sorted.map((_, i) => `[a${i}]`).join("");
    fcParts.push(`${vIn}concat=n=${n}:v=1:a=0[vc]`);
    fcParts.push(`${aIn}concat=n=${n}:v=0:a=1[ac]`);

    if (hasSubs) {
      fcParts.push(`[vc]${subFilter}[vout]`);
    }

    if (hasMusicInput) {
      fcParts.push(`${musicSetup}[ac][bgm]amix=inputs=2:duration=first:dropout_transition=2,afade=t=out:st=${fadeStart}:d=0.5[aout]`);
      args.push(
        "-filter_complex", fcParts.join(";"),
        "-map", hasSubs ? "[vout]" : "[vc]",
        "-map", "[aout]",
      );
    } else {
      // No music — add simple audio fade-out
      fcParts.push(`[ac]afade=t=out:st=${fadeStart}:d=0.5[aout]`);
      args.push(
        "-filter_complex", fcParts.join(";"),
        "-map", hasSubs ? "[vout]" : "[vc]",
        "-map", "[aout]",
      );
    }

  } else {
    // ── Full video (no trim/concat needed) ─────────────────────────────────
    if (hasMusicInput) {
      // Need filter_complex for both subtitle burn and audio mix
      const fc: string[] = [];
      if (hasSubs) fc.push(`[0:v]${subFilter}[vout]`);
      fc.push(`${musicSetup}[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2,afade=t=out:st=${fadeStart}:d=0.5[aout]`);
      args.push(
        "-filter_complex", fc.join(";"),
        "-map", hasSubs ? "[vout]" : "0:v",
        "-map", "[aout]",
      );
    } else {
      // Simple: just burn subs + audio fade
      if (hasSubs) {
        args.push(
          "-filter_complex", `[0:v]${subFilter}[vout];[0:a]afade=t=out:st=${fadeStart}:d=0.5[aout]`,
          "-map", "[vout]",
          "-map", "[aout]",
        );
      } else {
        args.push(
          "-filter_complex", `[0:a]afade=t=out:st=${fadeStart}:d=0.5[aout]`,
          "-map", "0:v",
          "-map", "[aout]",
        );
      }
    }
  }

  // Encoding settings: H.264 + AAC, web-optimised
  args.push(
    "-c:v", "libx264", "-crf", "23", "-preset", "fast", "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "128k",
    "output.mp4",
  );

  // ── 8. Run FFmpeg ──────────────────────────────────────────────────────────
  await ffmpeg.exec(args);

  // ── 9. Package result ──────────────────────────────────────────────────────
  const data = await ffmpeg.readFile("output.mp4") as Uint8Array;
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });

  onProgress({ phase: "done", percent: 100, message: "הרינדור הושלם!" });

  return { videoUrl: URL.createObjectURL(blob), srtContent };
}
