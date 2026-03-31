"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimation } from "framer-motion";
type AnimationControls = ReturnType<typeof useAnimation>;
import { Play, Pause, Headphones, Volume2, Zap } from "lucide-react";
import type { Subtitle, Word } from "@/context/EditorContext";

// ─── Karaoke helper ──────────────────────────────────────────────────────────

const KARAOKE_LINE_SIZE = 4;

function getKaraokeState(
  transcript: Word[],
  currentTime: number,
): { lineWords: Word[]; activeId: string | null } {
  if (transcript.length === 0) return { lineWords: [], activeId: null };

  const activeIdx = transcript.findIndex(
    (w) => currentTime >= w.start && currentTime < w.end,
  );
  const anchorIdx =
    activeIdx >= 0
      ? activeIdx
      : Math.max(
          0,
          transcript.reduce(
            (best, w, i) => (w.end <= currentTime ? i : best),
            0,
          ),
        );
  const lineStart =
    Math.floor(anchorIdx / KARAOKE_LINE_SIZE) * KARAOKE_LINE_SIZE;
  const lineWords = transcript.slice(lineStart, lineStart + KARAOKE_LINE_SIZE);
  const activeId = activeIdx >= 0 ? transcript[activeIdx].id : null;
  return { lineWords, activeId };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  videoUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  audioUnlocked: boolean;
  subtitles: Subtitle[];
  transcript: Word[];
  visData: number[];
  videoControls: AnimationControls;
  jumpFlash: boolean;
  progress: number;
  onUnlock: () => void;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onLoadedMetadata: () => void;
  onTimeUpdate: () => void;
  onEnded: () => void;
  fmt: (s: number) => string;
}

export default function VideoPreview({
  videoUrl, videoRef, currentTime, duration, isPlaying,
  audioUnlocked, subtitles, transcript, visData, videoControls, jumpFlash,
  progress, onUnlock, onTogglePlay, onSeek,
  onLoadedMetadata, onTimeUpdate, onEnded, fmt,
}: Props) {

  // ── Aspect ratio detected from the video's natural dimensions ──────────────
  const [videoAspect, setVideoAspect] = useState<number | null>(null);

  // ── Track the rendered height of the video box to scale subtitles ──────────
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const [boxHeight, setBoxHeight] = useState(0);

  useEffect(() => {
    const el = videoBoxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setBoxHeight(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wrap the parent's onLoadedMetadata so we can read natural dimensions here
  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (v && v.videoWidth && v.videoHeight) {
      setVideoAspect(v.videoWidth / v.videoHeight);
    }
    onLoadedMetadata();
  };

  // ── Subtitle sizing — clamp between 13 px and 36 px, ~5.5% of box height ──
  const subtitleFontSize = boxHeight > 0
    ? Math.max(13, Math.min(36, boxHeight * 0.055))
    : 18;

  // ── Karaoke / sentence fallback logic ─────────────────────────────────────
  const useKaraoke = transcript.length > 0;
  const { lineWords, activeId } = useKaraoke
    ? getKaraokeState(transcript, currentTime)
    : { lineWords: [], activeId: null };
  const activeSubtitle = !useKaraoke
    ? subtitles.find((s) => currentTime >= s.startSec && currentTime < s.endSec)
    : null;
  const karaokeLineKey = lineWords[0]?.id ?? "empty";

  return (
    <div className="flex flex-col flex-1 min-h-0 p-3 gap-3">

      {/* ── Outer: fills available space, centres the video box ─────────────── */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center">

        {/* ── Video box: constrained to natural aspect ratio ─────────────────── */}
        <div
          ref={videoBoxRef}
          className="relative rounded-2xl overflow-hidden bg-black w-full h-full"
          style={{
            // Use natural aspect ratio once known; default 16/9 for the placeholder
            aspectRatio: videoAspect ? String(videoAspect) : "16 / 9",
            // Constrain within the flex parent — never overflow either axis
            maxWidth: "100%",
            maxHeight: "100%",
            // Override w-full / h-full so the aspect-ratio rule wins
            width: videoAspect ? "auto" : "100%",
            height: videoAspect ? "auto" : "100%",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {videoUrl ? (
            <>
              {/* Video — fills the box exactly; no letter/pillar boxing needed */}
              <motion.video
                ref={videoRef as React.RefObject<HTMLVideoElement>}
                src={videoUrl}
                className="w-full h-full object-contain"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onPlay={() => {}}
                onPause={() => {}}
                onEnded={onEnded}
                animate={videoControls}
              />

              {/* ── Subtitle / karaoke overlay ──────────────────────────────── */}
              <AnimatePresence>
                {audioUnlocked && useKaraoke && lineWords.length > 0 && (
                  <motion.div
                    key={karaokeLineKey}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute pointer-events-none flex justify-center"
                    style={{
                      // Lower third with 10 % safe zone on all sides
                      bottom: "10%",
                      left:   "10%",
                      right:  "10%",
                    }}
                  >
                    <div
                      dir="rtl"
                      className="flex items-baseline justify-center gap-[0.35em] flex-wrap"
                      style={{ fontSize: subtitleFontSize }}
                    >
                      {lineWords.map((word) => (
                        <motion.span
                          key={word.id}
                          className="subtitle-overlay"
                          style={{ fontSize: "inherit" }}
                          animate={{
                            color: word.id === activeId
                              ? "#ffe234"
                              : "rgba(255,255,255,0.92)",
                          }}
                          transition={{ duration: 0.08 }}
                        >
                          {word.text}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Sentence-level fallback */}
                {audioUnlocked && !useKaraoke && activeSubtitle && (
                  <motion.div
                    key={activeSubtitle.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.1 }}
                    className="absolute pointer-events-none flex justify-center"
                    style={{ bottom: "10%", left: "10%", right: "10%" }}
                  >
                    <span
                      className="subtitle-overlay"
                      dir="rtl"
                      style={{ fontSize: subtitleFontSize }}
                    >
                      {activeSubtitle.text}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Jump-cut white flash */}
              <AnimatePresence>
                {jumpFlash && (
                  <motion.div
                    initial={{ opacity: 0.28 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.38 }}
                    className="absolute inset-0 bg-white pointer-events-none"
                  />
                )}
              </AnimatePresence>

              {/* Audio unlock overlay */}
              {!audioUnlocked && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center z-20"
                  style={{ background: "rgba(8,11,20,0.78)", backdropFilter: "blur(6px)" }}
                >
                  <motion.button
                    onClick={onUnlock}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.93 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="relative">
                      {[0, 1].map((i) => (
                        <motion.div
                          key={i}
                          className="absolute inset-0 rounded-full"
                          style={{ border: "2px solid rgba(59,130,246,0.45)" }}
                          animate={{ scale: [1, 1.75], opacity: [0.7, 0] }}
                          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.6 }}
                        />
                      ))}
                      <div
                        className="relative w-20 h-20 rounded-full flex items-center justify-center"
                        style={{
                          background: "linear-gradient(135deg,#3b82f6,#8b5cf6)",
                          boxShadow: "0 0 50px rgba(59,130,246,0.5),0 0 90px rgba(139,92,246,0.3)",
                        }}
                      >
                        <Play size={34} className="text-white ml-1.5" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-xl leading-snug">
                        לחץ להפעלה עם שמע
                      </p>
                      <p className="text-white/45 text-sm mt-1 flex items-center gap-1.5 justify-center">
                        <Headphones size={13} />
                        שמע מקורי + מוזיקת רקע
                      </p>
                    </div>
                  </motion.button>
                </motion.div>
              )}

              {/* Play/pause tap target (after unlock) */}
              {audioUnlocked && (
                <motion.button
                  onClick={onTogglePlay}
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ opacity: isPlaying ? 0 : 1 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    <Play size={22} className="text-white ml-1" />
                  </div>
                </motion.button>
              )}
            </>
          ) : (
            /* No file yet */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <Play size={24} className="text-white/20 ml-0.5" />
              </div>
              <p className="text-white/25 text-sm">לא הועלה וידאו</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Audio visualizer bar ─────────────────────────────────────────────── */}
      <div
        className="flex items-end gap-0.5 h-10 px-3 rounded-xl shrink-0"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center gap-1.5 shrink-0 pr-2 pb-0.5">
          <Zap
            size={11}
            className={audioUnlocked && isPlaying ? "text-blue-400" : "text-white/20"}
          />
          <span className="text-[10px] text-white/25 font-mono">
            {audioUnlocked && isPlaying ? "LIVE" : "IDLE"}
          </span>
        </div>
        {visData.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all"
            style={{
              height: audioUnlocked && isPlaying ? `${h}px` : `${4 + Math.sin(i * 0.9) * 3}px`,
              background: `linear-gradient(to top,
                rgba(59,130,246,${0.5 + (i / visData.length) * 0.4}),
                rgba(139,92,246,0.6))`,
              transitionDuration: "60ms",
            }}
          />
        ))}
        <div className="flex items-center gap-1 shrink-0 pl-2 pb-0.5">
          <Volume2 size={11} className="text-white/20" />
        </div>
      </div>

      {/* ── Scrubber ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-1 shrink-0">
        <button
          onClick={onTogglePlay}
          className="text-white/50 hover:text-white transition-colors shrink-0"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="text-white/30 text-xs font-mono w-10 shrink-0">
          {fmt(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.05}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="flex-1"
          style={{
            background: `linear-gradient(to right,
              rgba(139,92,246,0.75) ${progress}%,
              rgba(255,255,255,0.1) ${progress}%)`,
          }}
        />
        <span className="text-white/30 text-xs font-mono w-10 shrink-0 text-left">
          {fmt(duration)}
        </span>
      </div>
    </div>
  );
}
