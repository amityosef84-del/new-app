"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlignRight, Music, Sparkles,
  Volume2, VolumeX, Check, Zap,
} from "lucide-react";
import { useEditor, MUSIC_TRACKS } from "@/context/EditorContext";

interface Props {
  currentTime: number;
  isPlaying: boolean;
  onSeek: (t: number) => void;
}

type Tab = "subtitles" | "audio" | "effects";

const EFFECTS = [
  { id: "zoom",  label: "Zoom Punch",  icon: "🔍", desc: "הגדלה פתאומית" },
  { id: "blur",  label: "Blur Trans.", icon: "🌀", desc: "מעבר מטושטש"  },
  { id: "color", label: "Color Grade", icon: "🎨", desc: "עיבוד צבעים"  },
  { id: "speed", label: "Speed Ramp",  icon: "⚡", desc: "שינוי מהירות"  },
];

export default function SidebarPanel({ currentTime, isPlaying, onSeek }: Props) {
  const { state, dispatch } = useEditor();
  const { subtitles, selectedTrack, videoVolume, musicVolume } = state;

  const [activeTab,    setActiveTab]    = useState<Tab>("subtitles");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(true);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "subtitles", label: "כתוביות", icon: AlignRight },
    { id: "audio",     label: "אודיו",   icon: Music      },
    { id: "effects",   label: "אפקטים",  icon: Sparkles   },
  ];

  return (
    <div className="flex flex-col h-full">

      {/* ── Tab bar ── */}
      <div
        className="flex gap-1 p-1.5 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all duration-200"
            style={
              activeTab === id
                ? {
                    background:
                      "linear-gradient(135deg,rgba(59,130,246,0.4),rgba(139,92,246,0.4))",
                    border: "1px solid rgba(139,92,246,0.35)",
                    color: "#fff",
                  }
                : {
                    background: "transparent",
                    border: "1px solid transparent",
                    color: "rgba(255,255,255,0.35)",
                  }
            }
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">

          {/* ── Subtitles ── */}
          {activeTab === "subtitles" && (
            <motion.div
              key="subtitles"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col gap-2"
            >
              <p className="text-white/25 text-[11px] mb-1">
                לחץ על שורה לעריכה · לחץ על זמן לקפיצה
              </p>

              {subtitles.map((sub) => {
                const isActive =
                  currentTime >= sub.startSec && currentTime < sub.endSec;
                return (
                  <motion.div
                    key={sub.id}
                    layout
                    className="rounded-xl p-2.5 transition-colors duration-150"
                    style={{
                      background: isActive
                        ? "rgba(250,204,21,0.07)"
                        : "rgba(255,255,255,0.03)",
                      border: isActive
                        ? "1px solid rgba(250,204,21,0.35)"
                        : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {/* Timestamp — click to seek */}
                      <button
                        onClick={() => onSeek(sub.startSec)}
                        className="text-[10px] font-mono shrink-0 pt-0.5 transition-colors"
                        style={{
                          color: isActive
                            ? "rgba(250,204,21,0.8)"
                            : "rgba(255,255,255,0.2)",
                          width: 36,
                          textAlign: "right",
                        }}
                      >
                        {`${Math.floor(sub.startSec / 60)}:${Math.floor(sub.startSec % 60)
                          .toString()
                          .padStart(2, "0")}`}
                      </button>

                      {/* Text */}
                      <div className="flex-1">
                        {editingSubId === sub.id ? (
                          <div className="flex gap-1.5 items-start">
                            <textarea
                              autoFocus
                              value={sub.text}
                              onChange={(e) =>
                                dispatch({
                                  type: "UPDATE_SUBTITLE",
                                  id: sub.id,
                                  text: e.target.value,
                                })
                              }
                              onBlur={() => setEditingSubId(null)}
                              className="flex-1 bg-transparent text-white/80 text-xs resize-none outline-none border-b pb-0.5"
                              style={{ borderColor: "rgba(59,130,246,0.5)" }}
                              rows={2}
                              dir="rtl"
                            />
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setEditingSubId(null);
                              }}
                              className="text-green-400 shrink-0 mt-0.5"
                            >
                              <Check size={13} />
                            </button>
                          </div>
                        ) : (
                          <p
                            dir="rtl"
                            onClick={() => setEditingSubId(sub.id)}
                            className="text-xs cursor-text leading-relaxed transition-colors"
                            style={{
                              color: isActive
                                ? "#fde047"
                                : "rgba(255,255,255,0.55)",
                              fontWeight: isActive ? 600 : 400,
                            }}
                          >
                            {sub.text}
                          </p>
                        )}
                      </div>

                      {/* Active dot */}
                      {isActive && (
                        <motion.div
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                          style={{ background: "#fde047" }}
                        />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* ── Audio ── */}
          {activeTab === "audio" && (
            <motion.div
              key="audio"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col gap-3"
            >
              {/* Music on/off */}
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  {musicEnabled ? (
                    <Music size={16} className="text-purple-400" />
                  ) : (
                    <VolumeX size={16} className="text-white/25" />
                  )}
                  <div>
                    <p className="text-white/70 text-xs font-medium">מוזיקת רקע</p>
                    <p className="text-white/30 text-[10px]">
                      {musicEnabled ? "מנגן בתצוגה מקדימה" : "כבוי"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMusicEnabled((v) => !v)}
                  className="relative w-10 h-5 rounded-full transition-all duration-200 shrink-0"
                  style={{
                    background: musicEnabled
                      ? "linear-gradient(to right,#3b82f6,#8b5cf6)"
                      : "rgba(255,255,255,0.1)",
                  }}
                >
                  <motion.div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                    animate={musicEnabled ? { right: "2px" } : { left: "2px" }}
                    transition={{ duration: 0.2 }}
                  />
                </button>
              </div>

              {/* Volume mixer */}
              <div
                className="flex flex-col gap-3 p-3 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Volume2 size={10} /> מיקסר
                </p>

                {/* Video volume */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-white/50 text-[11px]">🎤 קול מקורי</span>
                    <span className="text-white/30 text-[10px] font-mono">{videoVolume}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} value={videoVolume}
                    onChange={(e) =>
                      dispatch({ type: "SET_VIDEO_VOLUME", v: Number(e.target.value) })
                    }
                    className="w-full"
                    style={{
                      background: `linear-gradient(to right,
                        rgba(59,130,246,0.7) ${videoVolume}%,
                        rgba(255,255,255,0.1) ${videoVolume}%)`,
                    }}
                  />
                </div>

                {/* Music volume */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-white/50 text-[11px]">🎵 מוזיקה</span>
                    <span className="text-white/30 text-[10px] font-mono">{musicVolume}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} value={musicVolume}
                    onChange={(e) =>
                      dispatch({ type: "SET_MUSIC_VOLUME", v: Number(e.target.value) })
                    }
                    className="w-full"
                    style={{
                      background: `linear-gradient(to right,
                        rgba(139,92,246,0.7) ${musicVolume}%,
                        rgba(255,255,255,0.1) ${musicVolume}%)`,
                    }}
                  />
                </div>
              </div>

              {/* Track picker */}
              <div className="flex flex-col gap-1.5">
                {MUSIC_TRACKS.map((track) => {
                  const active = selectedTrack === track.id;
                  return (
                    <button
                      key={track.id}
                      onClick={() => dispatch({ type: "SET_TRACK", track: track.id })}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl text-right transition-all"
                      style={{
                        background: active
                          ? "rgba(139,92,246,0.12)"
                          : "rgba(255,255,255,0.03)",
                        border: active
                          ? "1px solid rgba(139,92,246,0.4)"
                          : "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: active
                            ? "rgba(139,92,246,0.25)"
                            : "rgba(255,255,255,0.05)",
                        }}
                      >
                        {active && isPlaying ? (
                          <div className="flex gap-0.5 items-end h-4">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-0.5 rounded-full bg-purple-400"
                                animate={{ height: ["4px", "14px", "4px"] }}
                                transition={{
                                  duration: 0.5,
                                  repeat: Infinity,
                                  delay: i * 0.13,
                                }}
                              />
                            ))}
                          </div>
                        ) : (
                          <Music
                            size={13}
                            style={{ color: active ? "#a78bfa" : "rgba(255,255,255,0.25)" }}
                          />
                        )}
                      </div>
                      <div className="flex-1 text-right min-w-0">
                        <p
                          className="text-xs font-medium truncate"
                          style={{ color: active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)" }}
                        >
                          {track.name}
                        </p>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>
                          {track.genre} · {track.bpm} BPM
                        </p>
                      </div>
                      {active && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: "#8b5cf6" }}
                        >
                          <Check size={9} className="text-white" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Effects (placeholder) ── */}
          {activeTab === "effects" && (
            <motion.div
              key="effects"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col gap-2"
            >
              <p className="text-white/25 text-[11px] mb-1">
                אפקטים חכמים — בקרוב
              </p>
              <div className="grid grid-cols-2 gap-2">
                {EFFECTS.map((fx) => (
                  <motion.button
                    key={fx.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span className="text-2xl">{fx.icon}</span>
                    <div>
                      <p className="text-white/60 text-[11px] font-medium">{fx.label}</p>
                      <p className="text-white/25 text-[10px]">{fx.desc}</p>
                    </div>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{
                        background: "rgba(139,92,246,0.15)",
                        border: "1px solid rgba(139,92,246,0.3)",
                        color: "#a78bfa",
                      }}
                    >
                      <Zap size={7} className="inline ml-0.5" />
                      בקרוב
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
