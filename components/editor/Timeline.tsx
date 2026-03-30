"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Music, AlignRight, Film, ZoomIn, ZoomOut, Trash2 } from "lucide-react";
import { useEditor } from "@/context/EditorContext";

const BASE_PX_PER_SEC = 80; // pixels per second at zoom = 1

interface Props {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (t: number) => void;
  fmt: (s: number) => string;
}

export default function Timeline({ currentTime, duration, isPlaying, onSeek, fmt }: Props) {
  const { state, dispatch } = useEditor();
  const { clips, subtitles } = state;

  const scrollRef   = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const pxPerSec = BASE_PX_PER_SEC * zoom;

  // Dragging the playhead
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);

  // Simulated waveform (generated once)
  const [waveform] = useState(() =>
    Array.from({ length: 300 }, () => 0.25 + Math.random() * 0.75),
  );

  // Total timeline width
  const totalWidth = Math.max(duration * pxPerSec, 400);
  const playheadX  = currentTime * pxPerSec;

  // ── Auto-scroll to keep playhead in view ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || draggingRef.current) return;
    const margin = 120;
    const { scrollLeft, clientWidth } = el;
    if (playheadX > scrollLeft + clientWidth - margin) {
      el.scrollTo({ left: playheadX - clientWidth / 2, behavior: "smooth" });
    }
  }, [playheadX]);

  // ── Pointer-drag on playhead or ruler ──
  const handleRulerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      setDragging(true);
      seekFromPointer(e.nativeEvent);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duration, pxPerSec],
  );

  const handleRulerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      seekFromPointer(e.nativeEvent);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duration, pxPerSec],
  );

  const handleRulerPointerUp = useCallback(() => {
    draggingRef.current = false;
    setDragging(false);
  }, []);

  function seekFromPointer(e: PointerEvent) {
    const el = scrollRef.current;
    if (!el || duration === 0) return;
    const rect = el.getBoundingClientRect();
    const x    = e.clientX - rect.left + el.scrollLeft;
    onSeek(Math.max(0, Math.min(duration, x / pxPerSec)));
  }

  // Time ruler markers (every 5 s, or every 1 s if zoomed in)
  const markerInterval = zoom >= 2 ? 1 : zoom >= 1 ? 5 : 10;
  const markers: number[] = [];
  for (let t = 0; t <= duration; t += markerInterval) markers.push(t);

  return (
    <div
      className="shrink-0 flex flex-col border-t border-white/8"
      style={{
        height: 180,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      {/* ── Zoom controls + track labels column ── */}
      <div className="flex h-full">

        {/* Left labels column */}
        <div
          className="flex flex-col shrink-0 border-r border-white/8"
          style={{ width: 68 }}
        >
          {/* Zoom row */}
          <div className="flex items-center justify-between px-2 h-6 border-b border-white/8">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.3).toFixed(1)))}
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <ZoomOut size={11} />
            </button>
            <span className="text-[9px] text-white/25 font-mono">{zoom.toFixed(1)}×</span>
            <button
              onClick={() => setZoom((z) => Math.min(4, +(z + 0.3).toFixed(1)))}
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <ZoomIn size={11} />
            </button>
          </div>
          {/* Track labels */}
          {[
            { icon: Film,      label: "וידאו"   },
            { icon: AlignRight, label: "כתוביות" },
            { icon: Music,     label: "מוזיקה"  },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-2 flex-1 border-b border-white/5 last:border-0"
            >
              <Icon size={11} className="text-white/30 shrink-0" />
              <span className="text-[10px] text-white/30 font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* Scrollable timeline area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative"
          style={{ cursor: dragging ? "col-resize" : "default" }}
        >
          <div className="relative" style={{ width: totalWidth, height: "100%" }}>

            {/* ── Time ruler (draggable) ── */}
            <div
              className="absolute top-0 left-0 right-0 h-6 select-none"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                cursor: "col-resize",
              }}
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              onPointerUp={handleRulerPointerUp}
            >
              {markers.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 flex items-end pb-0.5"
                  style={{ left: t * pxPerSec }}
                >
                  <div
                    className="absolute top-0 bottom-0 w-px"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  />
                  <span
                    className="text-[9px] font-mono"
                    style={{ color: "rgba(255,255,255,0.3)", paddingLeft: 2 }}
                  >
                    {fmt(t)}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Video clips track ── */}
            <div
              className="absolute left-0 right-0"
              style={{ top: 24, height: 40, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              {clips.map((clip) => {
                const left  = clip.startSec * pxPerSec;
                const width = Math.max(4, (clip.endSec - clip.startSec) * pxPerSec - 2);
                return (
                  <motion.div
                    key={clip.id}
                    layout
                    className="absolute top-1 bottom-1 rounded-md flex items-center px-2 overflow-hidden group"
                    style={{
                      left,
                      width,
                      background: `${clip.color}28`,
                      border:     `1px solid ${clip.color}60`,
                    }}
                    whileHover={{ opacity: 0.85 }}
                  >
                    <span
                      className="text-[10px] font-medium truncate"
                      style={{ color: clip.color }}
                    >
                      {clip.label}
                    </span>
                    {/* Transition badge */}
                    {clip.transition !== "none" && (
                      <span
                        className="mr-auto text-[8px] px-1 rounded"
                        style={{
                          background: `${clip.color}30`,
                          color: clip.color,
                        }}
                      >
                        {clip.transition === "fade" ? "Fade" : "Zoom"}
                      </span>
                    )}
                    {/* Delete on hover */}
                    <button
                      onClick={() => dispatch({ type: "REMOVE_CLIP", id: clip.id })}
                      className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                      style={{ background: "rgba(239,68,68,0.7)" }}
                    >
                      <Trash2 size={8} className="text-white" />
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Subtitles track ── */}
            <div
              className="absolute left-0 right-0"
              style={{ top: 64, height: 36, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              {subtitles.map((sub) => {
                const left  = sub.startSec * pxPerSec;
                const width = Math.max(4, (sub.endSec - sub.startSec) * pxPerSec - 2);
                const isActive = currentTime >= sub.startSec && currentTime < sub.endSec;
                return (
                  <div
                    key={sub.id}
                    className="absolute top-1 bottom-1 rounded cursor-pointer flex items-center px-1.5 overflow-hidden"
                    style={{
                      left,
                      width,
                      background: isActive
                        ? "rgba(250,204,21,0.2)"
                        : "rgba(139,92,246,0.15)",
                      border: isActive
                        ? "1px solid rgba(250,204,21,0.5)"
                        : "1px solid rgba(139,92,246,0.35)",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                    onClick={() => onSeek(sub.startSec)}
                    title={sub.text}
                  >
                    <span
                      className="text-[9px] truncate"
                      style={{ color: isActive ? "#fde047" : "rgba(167,139,250,0.9)" }}
                      dir="rtl"
                    >
                      {sub.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Music / audio track ── */}
            <div
              className="absolute left-0 right-0 overflow-hidden"
              style={{ top: 100, height: 44 }}
            >
              <div className="absolute inset-0 flex items-center px-1 gap-px">
                {waveform.slice(0, Math.ceil(totalWidth / 4)).map((h, i) => (
                  <div
                    key={i}
                    className="shrink-0 rounded-sm"
                    style={{
                      width:      3,
                      height:     `${h * 80}%`,
                      background: "rgba(6,182,212,0.35)",
                    }}
                  />
                ))}
              </div>
              {/* Music label */}
              <div
                className="absolute inset-y-0 right-0 flex items-center px-2"
                style={{ background: "linear-gradient(to left,rgba(8,11,20,0.9),transparent)" }}
              >
                <span className="text-[9px] text-cyan-400/50 font-mono">
                  {state.selectedTrack.toUpperCase()}
                </span>
              </div>
            </div>

            {/* ── Playhead ── */}
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: playheadX }}
            >
              {/* Needle line */}
              <div
                className="absolute top-0 bottom-0 w-px"
                style={{ background: "rgba(251,146,60,0.9)", boxShadow: "0 0 4px rgba(251,146,60,0.7)" }}
              />
              {/* Triangle head */}
              <div
                className="absolute top-0 -translate-x-1/2"
                style={{
                  width:       0,
                  height:      0,
                  borderLeft:  "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop:   "9px solid rgba(251,146,60,0.9)",
                }}
              />
              {/* Time chip */}
              <div
                className="absolute top-1 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono whitespace-nowrap"
                style={{
                  background: "rgba(251,146,60,0.85)",
                  color:      "#fff",
                  left:       1,
                }}
              >
                {fmt(currentTime)}
              </div>
            </div>

          </div>{/* end total-width div */}
        </div>{/* end scroll area */}
      </div>{/* end flex row */}
    </div>
  );
}
