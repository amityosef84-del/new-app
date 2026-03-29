"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scissors,
  Music,
  Volume2,
  VolumeX,
  ChevronLeft,
  Play,
  Pause,
  AlignRight,
  Trash2,
  Plus,
  Check,
} from "lucide-react";

interface Cut {
  id: string;
  start: number;
  end: number;
  label: string;
}

interface Subtitle {
  id: string;
  startTime: string;
  text: string;
}

interface StepEditorProps {
  onNext: () => void;
}

const INITIAL_CUTS: Cut[] = [
  { id: "c1", start: 0, end: 12, label: "פתיחה" },
  { id: "c2", start: 12, end: 28, label: "תוכן ראשי" },
  { id: "c3", start: 35, end: 54, label: "חלק שני" },
  { id: "c4", start: 54, end: 72, label: "סיכום" },
  { id: "c5", start: 78, end: 90, label: "סיום" },
];

const INITIAL_SUBTITLES: Subtitle[] = [
  { id: "s1", startTime: "00:02", text: "שלום וברוכים הבאים לערוץ שלי!" },
  { id: "s2", startTime: "00:08", text: "היום נדבר על הנושא הכי מעניין של השנה" },
  { id: "s3", startTime: "00:18", text: "זה חשוב מאוד לדעת כי זה ישנה את החיים שלכם" },
  { id: "s4", startTime: "00:35", text: "בואו נצלול לתוך הפרטים" },
  { id: "s5", startTime: "00:55", text: "תזכרו לעקוב ולשתף עם החברים!" },
];

const MUSIC_TRACKS = [
  { id: "t1", name: "Lo-Fi Chill Beats", genre: "Lo-Fi", bpm: 85 },
  { id: "t2", name: "Epic Motivational", genre: "Cinematic", bpm: 128 },
  { id: "t3", name: "Upbeat Pop Vibes", genre: "Pop", bpm: 110 },
  { id: "t4", name: "Deep Focus", genre: "Ambient", bpm: 70 },
];

export default function StepEditor({ onNext }: StepEditorProps) {
  const [cuts, setCuts] = useState<Cut[]>(INITIAL_CUTS);
  const [subtitles, setSubtitles] = useState<Subtitle[]>(INITIAL_SUBTITLES);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [volume, setVolume] = useState(65);
  const [selectedTrack, setSelectedTrack] = useState("t1");
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "subtitles" | "music">("timeline");

  const totalDuration = 90;

  const removeCut = (id: string) => {
    setCuts((prev) => prev.filter((c) => c.id !== id));
  };

  const updateSubtitle = (id: string, text: string) => {
    setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  };

  const TABS = [
    { id: "timeline", label: "ציר זמן", icon: Scissors },
    { id: "subtitles", label: "כתוביות", icon: AlignRight },
    { id: "music", label: "מוזיקה", icon: Music },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col gap-8 w-full max-w-3xl mx-auto"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold gradient-text mb-2">עריכה ידנית</h2>
        <p className="text-white/40 text-sm">ערוך חיתוכים, כתוביות ומוזיקה לפי רצונך</p>
      </div>

      {/* Video Preview Bar */}
      <div className="glass rounded-2xl p-4 border border-white/8">
        <div className="flex items-center gap-4">
          <motion.button
            onClick={() => setIsPlaying(!isPlaying)}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center"
          >
            {isPlaying ? (
              <Pause size={16} className="text-white" />
            ) : (
              <Play size={16} className="text-white mr-[-2px]" />
            )}
          </motion.button>

          {/* Waveform / Timeline preview */}
          <div className="flex-1 h-10 rounded-xl bg-white/5 overflow-hidden relative flex items-center px-3 gap-0.5">
            {Array.from({ length: 60 }).map((_, i) => {
              const height = 20 + Math.sin(i * 0.7) * 10 + Math.random() * 15;
              const isCutRegion = !cuts.some(
                (c) => (i / 60) * totalDuration >= c.start && (i / 60) * totalDuration <= c.end
              );
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full shrink-0 ${isCutRegion ? "bg-red-500/30" : "bg-blue-400/50"}`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>

          <span className="text-white/30 text-xs font-mono">1:30</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 glass rounded-2xl border border-white/8">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
              text-sm font-medium transition-all duration-200
              ${activeTab === id
                ? "bg-gradient-to-r from-blue-600/70 to-purple-600/70 text-white shadow-lg shadow-blue-500/20"
                : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }
            `}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "timeline" && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3"
          >
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-white/60 text-sm font-medium">קטעי וידאו ({cuts.length} חיתוכים)</h3>
              <span className="text-white/30 text-xs">
                {cuts.reduce((acc, c) => acc + (c.end - c.start), 0)}s מתוך {totalDuration}s
              </span>
            </div>

            {/* Timeline ruler */}
            <div className="relative h-8 glass rounded-xl border border-white/8 overflow-hidden">
              {cuts.map((cut) => (
                <motion.div
                  key={cut.id}
                  className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500/30 to-purple-500/20 border-l border-r border-blue-500/40"
                  style={{
                    left: `${(cut.start / totalDuration) * 100}%`,
                    width: `${((cut.end - cut.start) / totalDuration) * 100}%`,
                  }}
                  whileHover={{ opacity: 0.8 }}
                />
              ))}
              {/* Time markers */}
              {[0, 25, 50, 75, 100].map((pct) => (
                <div
                  key={pct}
                  className="absolute top-0 bottom-0 flex items-center"
                  style={{ left: `${pct}%` }}
                >
                  <div className="w-px h-full bg-white/10" />
                  <span className="absolute text-[10px] text-white/20 -translate-x-1/2 top-1">
                    {Math.round((pct / 100) * totalDuration)}s
                  </span>
                </div>
              ))}
            </div>

            {/* Cut segments */}
            <div className="flex flex-col gap-2 mt-1">
              {cuts.map((cut, index) => (
                <motion.div
                  key={cut.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  className="glass rounded-xl p-3 border border-white/8 flex items-center gap-3"
                >
                  <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-xs text-white/60 font-mono shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-sm font-medium">{cut.label}</p>
                    <p className="text-white/30 text-xs font-mono">{cut.start}s — {cut.end}s ({cut.end - cut.start}s)</p>
                  </div>
                  {/* Mini bar */}
                  <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      style={{ width: `${((cut.end - cut.start) / totalDuration) * 100 * 3}%` }}
                    />
                  </div>
                  <button
                    onClick={() => removeCut(cut.id)}
                    className="text-white/20 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="glass rounded-xl p-3 border border-dashed border-white/10 flex items-center justify-center gap-2 text-white/30 hover:text-white/50 hover:border-white/20 transition-all"
              >
                <Plus size={14} />
                <span className="text-sm">הוסף חיתוך</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {activeTab === "subtitles" && (
          <motion.div
            key="subtitles"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3"
          >
            <h3 className="text-white/60 text-sm font-medium mb-1">
              כתוביות עבריות ({subtitles.length} שורות)
            </h3>
            {subtitles.map((sub) => (
              <motion.div
                key={sub.id}
                layout
                className="glass rounded-xl p-3 border border-white/8"
              >
                <div className="flex items-start gap-3">
                  <span className="text-white/25 text-xs font-mono pt-1 shrink-0">{sub.startTime}</span>
                  <div className="flex-1">
                    {editingSubId === sub.id ? (
                      <div className="flex items-center gap-2">
                        <textarea
                          autoFocus
                          value={sub.text}
                          onChange={(e) => updateSubtitle(sub.id, e.target.value)}
                          className="flex-1 bg-transparent text-white/80 text-sm resize-none outline-none border-b border-blue-400/40 pb-1"
                          rows={2}
                          dir="rtl"
                        />
                        <button
                          onClick={() => setEditingSubId(null)}
                          className="text-green-400 hover:text-green-300 transition-colors"
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    ) : (
                      <p
                        className="text-white/70 text-sm leading-relaxed cursor-text hover:text-white/90 transition-colors"
                        dir="rtl"
                        onClick={() => setEditingSubId(sub.id)}
                      >
                        {sub.text}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === "music" && (
          <motion.div
            key="music"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-5"
          >
            {/* Music toggle */}
            <div className="glass rounded-2xl p-4 border border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {musicEnabled ? (
                  <Music size={20} className="text-purple-400" />
                ) : (
                  <VolumeX size={20} className="text-white/30" />
                )}
                <div>
                  <p className="text-white/70 font-medium text-sm">מוזיקת רקע</p>
                  <p className="text-white/30 text-xs">{musicEnabled ? "פעיל" : "כבוי"}</p>
                </div>
              </div>
              <motion.button
                onClick={() => setMusicEnabled(!musicEnabled)}
                whileTap={{ scale: 0.95 }}
                className={`
                  relative w-12 h-6 rounded-full transition-all duration-300
                  ${musicEnabled
                    ? "bg-gradient-to-r from-blue-500 to-purple-500"
                    : "bg-white/10"
                  }
                `}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  animate={{ right: musicEnabled ? "4px" : undefined, left: musicEnabled ? undefined : "4px" }}
                  transition={{ duration: 0.2 }}
                />
              </motion.button>
            </div>

            {/* Volume slider */}
            <AnimatePresence>
              {musicEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="glass rounded-2xl p-4 border border-white/8"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Volume2 size={16} className="text-white/40 shrink-0" />
                    <span className="text-white/50 text-sm">עוצמת קול</span>
                    <span className="text-white/30 text-xs mr-auto font-mono">{volume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full"
                    style={{
                      background: `linear-gradient(to left, rgba(255,255,255,0.1) ${100 - volume}%, rgba(139,92,246,0.6) ${100 - volume}%)`,
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Track selection */}
            <AnimatePresence>
              {musicEnabled && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-2"
                >
                  <h4 className="text-white/40 text-xs font-medium">בחר טראק</h4>
                  {MUSIC_TRACKS.map((track) => (
                    <motion.button
                      key={track.id}
                      onClick={() => setSelectedTrack(track.id)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`
                        glass rounded-xl p-3 border flex items-center gap-3 text-right transition-all
                        ${selectedTrack === track.id
                          ? "border-purple-500/40 bg-purple-500/5"
                          : "border-white/8 hover:border-white/15"
                        }
                      `}
                    >
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                        ${selectedTrack === track.id
                          ? "bg-gradient-to-br from-purple-500/30 to-blue-500/30"
                          : "bg-white/5"
                        }
                      `}>
                        <Music size={16} className={selectedTrack === track.id ? "text-purple-400" : "text-white/30"} />
                      </div>
                      <div className="flex-1 text-right">
                        <p className={`text-sm font-medium ${selectedTrack === track.id ? "text-white/80" : "text-white/50"}`}>
                          {track.name}
                        </p>
                        <p className="text-white/25 text-xs">{track.genre} • {track.bpm} BPM</p>
                      </div>
                      {selectedTrack === track.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center"
                        >
                          <Check size={10} className="text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next button */}
      <motion.button
        onClick={onNext}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-base shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
      >
        <span>המשך לטאבנייל וייצוא</span>
        <ChevronLeft size={18} />
      </motion.button>
    </motion.div>
  );
}
