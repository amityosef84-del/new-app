"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimation } from "framer-motion";
type AnimationControls = ReturnType<typeof useAnimation>;
import { Play, Pause, Headphones, Volume2, Zap } from "lucide-react";
import type { Subtitle, Word } from "@/context/EditorContext";

// ─── Karaoke helper ──────────────────────────────────────────────────────────

const KARAOKE_LINE_SIZE = 4; // words per display line

function getKaraokeState(
  transcript: Word[],
  currentTime: number,
): { lineWords: Word[]; activeId: string | null } {
  if (transcript.length === 0) return { lineWords: [], activeId: null };

  // Find the word currently being spoken
  const activeIdx = transcript.findIndex(
    (w) => currentTime >= w.start && currentTime < w.end,
  );

  // If between words, anchor to the last word that already ended
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

  // Line = group of KARAOKE_LINE_SIZE words containing the anchor
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
  // Prefer word-level karaoke when transcript is available;
  // fall back to sentence-level subtitles for backward compatibility.
  const useKaraoke = transcript.length > 0;
  const { lineWords, activeId } = useKaraoke
    ? getKaraokeState(transcript, currentTime)
    : { lineWords: [], activeId: null };

  // Sentence-level fallback
  const activeSubtitle = !useKaraoke
    ? subtitles.find((s) => currentTime >= s.startSec && currentTime < s.endSec)
    : null;

  // Key the AnimatePresence on the line's first word id so the transition
  // fires when the line changes, not on every individual word highlight.
  const karaokeLineKey = lineWords[0]?.id ?? "empty";

  return (
    <div className="flex flex-col flex-1 min-h-0 p-3 gap-3">

      {/* ── Video container ── */}
      <div
        className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-black"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {videoUrl ? (
          <>
            {/* Video element with jump-cut transform */}
            <motion.video
              ref={videoRef as React.RefObject<HTMLVideoElement>}
              src={videoUrl}
              className="w-full h-full object-contain"
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => {}}
              onPause={() => {}}
              onEnded={onEnded}
              animate={videoControls}
            />

            {/* ── Karaoke / subtitle overlay ── */}
            <AnimatePresence>
              {audioUnlocked && useKaraoke && lineWords.length > 0 && (
                <motion.div
                  key={karaokeLineKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-10 inset-x-0 flex justify-center px-4 pointer-events-none"
                >
                  {/*
                    dir="rtl" + flex row → first array item appears on the RIGHT.
                    Words are in chronological order, so word[0] (spoken first)
                    sits at the right — correct Hebrew reading direction.
                  */}
                  <div dir="rtl" className="flex items-baseline justify-center gap-2 flex-wrap">
                    {lineWords.map((word) => (
                      <motion.span
                        key={word.id}
                        className="subtitle-overlay"
                        animate={{
                          color: word.id === activeId ? "#ffe234" : "rgba(255,255,255,0.92)",
                        }}
                        transition={{ duration: 0.08 }}
                      >
                        {word.text}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Sentence-level fallback (when no transcript yet) */}
              {audioUnlocked && !useKaraoke && activeSubtitle && (
                <motion.div
                  key={activeSubtitle.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute bottom-10 inset-x-0 flex justify-center px-6 pointer-events-none"
                >
                  <span className="subtitle-overlay" dir="rtl">
                    {activeSubtitle.text}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* White flash on jump cut */}
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

            {/* Audio unlock overlay (shown before first interaction) */}
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
                  {/* Pulsing play button */}
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

            {/* Play/pause click-through (after unlock) */}
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

      {/* ── Audio visualizer bar ── */}
      <div
        className="flex items-end gap-0.5 h-10 px-3 rounded-xl shrink-0"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Label */}
        <div className="flex items-center gap-1.5 shrink-0 pr-2 pb-0.5">
          <Zap
            size={11}
            className={audioUnlocked && isPlaying ? "text-blue-400" : "text-white/20"}
          />
          <span className="text-[10px] text-white/25 font-mono">
            {audioUnlocked && isPlaying ? "LIVE" : "IDLE"}
          </span>
        </div>

        {/* Bars */}
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

        {/* Volume indicators */}
        <div className="flex items-center gap-1 shrink-0 pl-2 pb-0.5">
          <Volume2 size={11} className="text-white/20" />
        </div>
      </div>

      {/* ── Scrubber ── */}
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
