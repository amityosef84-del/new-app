"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { Clip, Word, Subtitle, SubtitleStyle } from "@/context/EditorContext";
import { generateSrt } from "./subtitleExport";

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

// ─── Color helpers ────────────────────────────────────────────────────────────

/** Convert CSS hex "#RRGGBB" → ASS "&H00BBGGRR&" little-endian hex. */
function hexToAss(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "00FFFFFF";
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `00${b}${g}${r}`.toUpperCase();
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function exportVideo(
  file: File,
  clips: Clip[],
  transcript: Word[],
  subtitles: Subtitle[],
  subtitleStyle: SubtitleStyle,
  onProgress: (p: ExportProgress) => void,
): Promise<ExportResult> {

  // ── 1. Load FFmpeg WASM ────────────────────────────────────────────────────
  onProgress({ phase: "loading", percent: 2, message: "טוען FFmpeg…" });

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${ST_CDN}/ffmpeg-core.js`,   "text/javascript"),
    wasmURL: await toBlobURL(`${ST_CDN}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpeg.on("progress", ({ progress }) => {
    const pct = Math.round(15 + progress * 80);
    onProgress({ phase: "encoding", percent: pct, message: `מרנדר… ${pct}%` });
  });

  // ── 2. Write source video ──────────────────────────────────────────────────
  onProgress({ phase: "writing", percent: 6, message: "קורא קובץ וידאו…" });
  await ffmpeg.writeFile("input.mp4", await fetchFile(file));

  // ── 3. Fetch & write Hebrew font for libass ────────────────────────────────
  // Heebo Bold TTF from Google Fonts GitHub mirror — needed for correct Hebrew
  // character rendering and RTL layout inside FFmpeg's libass engine.
  onProgress({ phase: "writing", percent: 9, message: "טוען פונט עברי…" });
  let fontName = "sans-serif"; // fallback if fetch fails
  try {
    const fontResp = await fetch(
      "https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/static/Heebo-Bold.ttf",
    );
    if (fontResp.ok) {
      const fontBytes = new Uint8Array(await fontResp.arrayBuffer());
      await ffmpeg.writeFile("Heebo-Bold.ttf", fontBytes);
      fontName = "Heebo";
    }
  } catch {
    // Font fetch failed — libass will use its built-in fallback
  }

  // ── 4. Generate & write ASS subtitles ─────────────────────────────────────
  const sorted = [...clips].sort((a, b) => a.startSec - b.startSec);
  const srtContent = generateSrt(transcript, subtitles, sorted);
  const hasSubs = srtContent.trim().length > 0;

  if (hasSubs) {
    await ffmpeg.writeFile("subs.srt", new TextEncoder().encode(srtContent));
  }

  // ── 4. Build FFmpeg arguments ──────────────────────────────────────────────
  onProgress({ phase: "encoding", percent: 12, message: "בונה פקודת עריכה…" });

  const args: string[] = ["-i", "input.mp4"];

  // Detect whether auto-cut created actual gaps between clips
  const hasGaps = sorted.length > 1 &&
    sorted.some((c, i) => i > 0 && c.startSec > sorted[i - 1].endSec + 0.15);

  // ASS force_style for subtitle burn-in.
  // - FontName references the TTF we wrote to the WASM FS (or falls back to system).
  // - MarginV is measured from the bottom of the frame in pixels.
  //   We approximate using a 720-line baseline; for 9:16 (1080×1920) the
  //   proportions still hold because MarginV scales with video height in libass.
  // - Alignment=2 = bottom-center; the user's verticalPos is reflected by MarginV.
  const marginV = Math.max(5, Math.round(720 * (1 - subtitleStyle.verticalPos / 100) - 30));
  const primaryHex = hexToAss(
    subtitleStyle.textColor.startsWith("rgba") ? "#ffffff" : subtitleStyle.textColor,
  );
  const assStyle = [
    `FontName=${fontName}`,
    "FontSize=22",
    `PrimaryColour=&H${primaryHex}&`,
    `OutlineColour=&H${hexToAss(subtitleStyle.shadowColor)}&`,
    "Outline=2",
    "Bold=1",
    "Alignment=2",
    `MarginV=${marginV}`,
  ].join(",");

  // subtitle filter string: fontsdir=. tells libass to search the WASM working
  // directory for font files (where we wrote Heebo-Bold.ttf).
  const subFilter = `subtitles=subs.srt:fontsdir=.:force_style='${assStyle}'`;

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
      args.push("-filter_complex", fcParts.join(";"), "-map", "[vout]", "-map", "[ac]");
    } else {
      args.push("-filter_complex", fcParts.join(";"), "-map", "[vc]", "-map", "[ac]");
    }

  } else {
    // ── Full video, just burn subtitles if present ──────────────────────────
    if (hasSubs) {
      args.push("-vf", subFilter);
    }
  }

  // Encoding settings: H.264 + AAC, web-optimised
  args.push(
    "-c:v", "libx264", "-crf", "23", "-preset", "fast", "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "128k",
    "output.mp4",
  );

  // ── 5. Run FFmpeg ──────────────────────────────────────────────────────────
  await ffmpeg.exec(args);

  // ── 6. Package result ──────────────────────────────────────────────────────
  const data = await ffmpeg.readFile("output.mp4") as Uint8Array;
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });

  onProgress({ phase: "done", percent: 100, message: "הרינדור הושלם!" });

  return { videoUrl: URL.createObjectURL(blob), srtContent };
}
