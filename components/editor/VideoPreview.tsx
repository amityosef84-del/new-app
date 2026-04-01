"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimation } from "framer-motion";
type AnimationControls = ReturnType<typeof useAnimation>;
import { Play, Pause, Headphones, Volume2, Zap, GripVertical } from "lucide-react";
import type { Subtitle, Word } from "@/context/EditorContext";
import { useEditor } from "@/context/EditorContext";

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
      : Math.max(0, transcript.reduce((best, w, i) => (w.end <= currentTime ? i : best), 0));
  const lineStart = Math.floor(anchorIdx / KARAOKE_LINE_SIZE) * KARAOKE_LINE_SIZE;
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
  const { state, dispatch } = useEditor();
  const { subtitleStyle } = state;

  // ── Aspect ratio & box height ───────────────────────────────────────────────
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const [boxHeight, setBoxHeight] = useState(0);

  useEffect(() => {
    const el = videoBoxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setBoxHeight(entries[0].contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (v && v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
    onLoadedMetadata();
  };

  // ── Font size = boxHeight × scale × 5.5 %, clamped 13–40 px ───────────────
  const baseFontSize = boxHeight > 0 ? Math.max(13, Math.min(40, boxHeight * 0.055)) : 18;
  const fontSize = baseFontSize * subtitleStyle.scale;

  // ── Karaoke / sentence state ────────────────────────────────────────────────
  const useKaraoke = transcript.length > 0;
  const { lineWords, activeId } = useKaraoke
    ? getKaraokeState(transcript, currentTime)
    : { lineWords: [], activeId: null };
  const activeSubtitle = !useKaraoke
    ? subtitles.find((s) => currentTime >= s.startSec && currentTime < s.endSec)
    : null;
  const karaokeLineKey = lineWords[0]?.id ?? "empty";

  // ── Editable word ───────────────────────────────────────────────────────────
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editValue,     setEditValue]     = useState("");
  const editingWordIdRef = useRef<string | null>(null);
  const editValueRef     = useRef("");

  // Freeze the visible line while an edit is active so advancing
  // currentTime cannot change karaokeLineKey and destroy the active <input>.
  const frozenLineRef = useRef<Word[] | null>(null);

  const startEdit = useCallback((word: Word) => {
    frozenLineRef.current    = lineWords;
    editingWordIdRef.current = word.id;
    editValueRef.current     = word.text;
    setEditingWordId(word.id);
    setEditValue(word.text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineWords]);

  const commitEdit = useCallback(() => {
    const id  = editingWordIdRef.current;
    const val = editValueRef.current.trim();
    if (id && val) dispatch({ type: "UPDATE_WORD", id, text: val });
    frozenLineRef.current    = null;
    editingWordIdRef.current = null;
    setEditingWordId(null);
  }, [dispatch]);

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    editValueRef.current = e.target.value;
    setEditValue(e.target.value);
  };

  // ── Draggable vertical position ─────────────────────────────────────────────
  const dragPosRef    = useRef(subtitleStyle.verticalPos);
  const dragStartRef  = useRef<{ y: number; pos: number } | null>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { dragPosRef.current = subtitleStyle.verticalPos; }, [subtitleStyle.verticalPos]);

  const onDragPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = { y: e.clientY, pos: dragPosRef.current };
    setIsDragging(true);
  }, []);

  const onDragPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || !videoBoxRef.current) return;
    const boxH = videoBoxRef.current.getBoundingClientRect().height;
    if (boxH === 0) return;
    const deltaPercent = ((e.clientY - dragStartRef.current.y) / boxH) * 100;
    const newPos = Math.max(5, Math.min(88, dragStartRef.current.pos + deltaPercent));
    dragPosRef.current = newPos;
    if (dragHandleRef.current) dragHandleRef.current.style.top = `${newPos}%`;
  }, []);

  const onDragPointerUp = useCallback(() => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    setIsDragging(false);
    dispatch({ type: "SET_SUBTITLE_STYLE", style: { verticalPos: dragPosRef.current } });
  }, [dispatch]);

  const subtitleTopStyle = `${subtitleStyle.verticalPos}%`;

  return (
    <div className="flex flex-col flex-1 min-h-0 p-3 gap-3">

      {/* ── Outer centering wrapper ─────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center">

        {/* ── Video box ──────────────────────────────────────────────────────── */}
        <div
          ref={videoBoxRef}
          className="relative rounded-2xl overflow-hidden bg-black"
          style={{
            aspectRatio: videoAspect ? String(videoAspect) : "16 / 9",
            maxWidth: "100%",
            maxHeight: "100%",
            width: videoAspect ? "auto" : "100%",
            height: videoAspect ? "auto" : "100%",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {videoUrl ? (
            <>
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

              {/* ── Subtitle / karaoke overlay (draggable) ──────────────────── */}
              {videoUrl && (useKaraoke ? lineWords.length > 0 : !!activeSubtitle) && (
                <div
                  ref={dragHandleRef}
                  className="absolute inset-x-0 flex flex-col items-center cursor-move"
                  style={{
                    top: subtitleTopStyle,
                    transform: "translateY(-50%)",
                    paddingLeft:  "10%",
                    paddingRight: "10%",
                    zIndex: 20,
                  }}
                >
                  {/* Drag handle */}
                  <div
                    className="pointer-events-auto mb-1 flex items-center gap-1 px-2 py-0.5 rounded-full opacity-40 hover:opacity-100 transition-opacity"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      cursor: isDragging ? "grabbing" : "grab",
                    }}
                    onPointerDown={onDragPointerDown}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                  >
                    <GripVertical size={12} className="text-white/60" />
                    <span className="text-white/40 text-[9px] font-mono select-none">גרור</span>
                  </div>

                  {/* Words */}
                  <AnimatePresence>
                    {useKaraoke ? (
                      <motion.div
                        key={karaokeLineKey}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.12 }}
                        dir="rtl"
                        className="flex items-baseline justify-center gap-[0.35em] flex-wrap pointer-events-auto"
                        style={{ fontSize }}
                      >
                        {(frozenLineRef.current ?? lineWords).map((word) =>
                          editingWordId === word.id ? (
                            <input
                              key={word.id}
                              autoFocus
                              value={editValue}
                              onChange={handleEditChange}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                                if (e.key === "Escape") { setEditingWordId(null); frozenLineRef.current = null; }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="outline-none rounded-lg px-2 text-center"
                              style={{
                                fontFamily: subtitleStyle.fontFamily + ", sans-serif",
                                fontWeight: 900,
                                fontSize:   "inherit",
                                color:      subtitleStyle.activeColor,
                                background: "rgba(0,0,0,0.82)",
                                border:     "2px solid rgba(255,226,52,0.85)",
                                boxShadow:  "0 0 12px rgba(255,226,52,0.35)",
                                width:      `${Math.max(3, editValue.length + 2)}ch`,
                                minWidth:   "3ch",
                              }}
                            />
                          ) : (
                            <motion.span
                              key={word.id}
                              className="subtitle-overlay cursor-text select-none"
                              style={{
                                fontFamily:       subtitleStyle.fontFamily + ", sans-serif",
                                fontSize:         "inherit",
                                WebkitTextStroke: `2px ${subtitleStyle.shadowColor}`,
                                textShadow: `0 2px 10px ${subtitleStyle.shadowColor}cc, 0 0 24px ${subtitleStyle.shadowColor}aa`,
                              }}
                              animate={{
                                color: word.id === activeId
                                  ? subtitleStyle.activeColor
                                  : subtitleStyle.textColor,
                              }}
                              transition={{ duration: 0.08 }}
                              onClick={(e) => { e.stopPropagation(); startEdit(word); }}
                              title="לחץ לעריכה"
                            >
                              {word.text}
                            </motion.span>
                          )
                        )}
                      </motion.div>
                    ) : (
                      activeSubtitle && (
                        <motion.div
                          key={activeSubtitle.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.1 }}
                          className="pointer-events-auto"
                        >
                          <span
                            className="subtitle-overlay cursor-text"
                            dir="rtl"
                            style={{
                              fontFamily:       subtitleStyle.fontFamily + ", sans-serif",
                              fontSize,
                              color:            subtitleStyle.textColor,
                              WebkitTextStroke: `2px ${subtitleStyle.shadowColor}`,
                            }}
                          >
                            {activeSubtitle.text}
                          </span>
                        </motion.div>
                      )
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Jump-cut flash */}
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
                      <p className="text-white font-bold text-xl leading-snug">לחץ להפעלה עם שמע</p>
                      <p className="text-white/45 text-sm mt-1 flex items-center gap-1.5 justify-center">
                        <Headphones size={13} />
                        שמע מקורי + מוזיקת רקע
                      </p>
                    </div>
                  </motion.button>
                </motion.div>
              )}

              {/* Play/pause tap target */}
              {audioUnlocked && (
                <motion.button
                  onClick={onTogglePlay}
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ opacity: isPlaying ? 0 : 1 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  style={{ pointerEvents: isPlaying ? "none" : "auto" }}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
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
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-1.5 shrink-0 pr-2 pb-0.5">
          <Zap size={11} className={audioUnlocked && isPlaying ? "text-blue-400" : "text-white/20"} />
          <span className="text-[10px] text-white/25 font-mono">{audioUnlocked && isPlaying ? "LIVE" : "IDLE"}</span>
        </div>
        {visData.map((h, i) => (
          <div key={i} className="flex-1 rounded-t transition-all" style={{
            height: audioUnlocked && isPlaying ? `${h}px` : `${4 + Math.sin(i * 0.9) * 3}px`,
            background: `linear-gradient(to top, rgba(59,130,246,${0.5 + (i / visData.length) * 0.4}), rgba(139,92,246,0.6))`,
            transitionDuration: "60ms",
          }} />
        ))}
        <div className="flex items-center gap-1 shrink-0 pl-2 pb-0.5">
          <Volume2 size={11} className="text-white/20" />
        </div>
      </div>

      {/* ── Scrubber ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-1 shrink-0">
        <button onClick={onTogglePlay} className="text-white/50 hover:text-white transition-colors shrink-0">
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="text-white/30 text-xs font-mono w-10 shrink-0">{fmt(currentTime)}</span>
        <input
          type="range" min={0} max={duration || 100} step={0.05} value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="flex-1"
          style={{ background: `linear-gradient(to right, rgba(139,92,246,0.75) ${progress}%, rgba(255,255,255,0.1) ${progress}%)` }}
        />
        <span className="text-white/30 text-xs font-mono w-10 shrink-0 text-left">{fmt(duration)}</span>
      </div>
    </div>
  );
}
