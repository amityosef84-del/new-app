"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Subtitle {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
}

interface Cut {
  id: string;
  startSec: number;
  endSec: number;
  label: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MUSIC_TRACKS = [
  { id: "t1", name: "Lo-Fi Chill Beats", genre: "Lo-Fi", bpm: 85 },
  { id: "t2", name: "Epic Motivational", genre: "Cinematic", bpm: 128 },
  { id: "t3", name: "Upbeat Pop Vibes", genre: "Pop", bpm: 110 },
  { id: "t4", name: "Deep Focus", genre: "Ambient", bpm: 70 },
];

function buildSubtitles(d: number): Subtitle[] {
  const dur = d > 0 ? d : 60;
  return [
    { id: "s1", startSec: dur * 0.03, endSec: dur * 0.14, text: "שלום וברוכים הבאים לערוץ שלי!" },
    { id: "s2", startSec: dur * 0.16, endSec: dur * 0.30, text: "היום נדבר על הנושא הכי מעניין של השנה" },
    { id: "s3", startSec: dur * 0.32, endSec: dur * 0.48, text: "זה חשוב מאוד לדעת כי זה ישנה את החיים שלכם" },
    { id: "s4", startSec: dur * 0.52, endSec: dur * 0.68, text: "בואו נצלול לתוך הפרטים" },
    { id: "s5", startSec: dur * 0.72, endSec: dur * 0.90, text: "תזכרו לעקוב ולשתף עם החברים!" },
  ];
}

function buildCuts(d: number): Cut[] {
  const dur = d > 0 ? d : 60;
  return [
    { id: "c1", startSec: 0,           endSec: dur * 0.15, label: "פתיחה" },
    { id: "c2", startSec: dur * 0.15,  endSec: dur * 0.38, label: "תוכן ראשי" },
    { id: "c3", startSec: dur * 0.38,  endSec: dur * 0.62, label: "חלק שני" },
    { id: "c4", startSec: dur * 0.62,  endSec: dur * 0.82, label: "סיכום" },
    { id: "c5", startSec: dur * 0.82,  endSec: dur,        label: "סיום" },
  ];
}

// ─── Web Audio Synth Hook ──────────────────────────────────────────────────────
// Creates a real-time sequencer per track using the Web Audio API.
// Music fades in/out with video play/pause; no external files needed.

function useMusicSynth(
  trackId: string,
  enabled: boolean,
  volume: number,
  isPlaying: boolean,
) {
  const ctxRef       = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const playGainRef  = useRef<GainNode | null>(null);

  // (Re-)create AudioContext whenever track selection or enabled state changes
  useEffect(() => {
    if (!enabled) {
      ctxRef.current?.close();
      ctxRef.current = null;
      masterGainRef.current = null;
      playGainRef.current = null;
      return;
    }

    let schedulerInterval: ReturnType<typeof setInterval>;

    try {
      const AudioCtx =
        window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext as typeof AudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;

      // Gain chain: sequencer → playGain (0 when paused) → masterGain → speakers
      const playGain = ctx.createGain();
      playGain.gain.value = 0; // starts silent; faded in via isPlaying effect

      const masterGain = ctx.createGain();
      masterGain.gain.value = (volume / 100) * 0.28;

      playGain.connect(masterGain);
      masterGain.connect(ctx.destination);
      playGainRef.current  = playGain;
      masterGainRef.current = masterGain;

      const track = MUSIC_TRACKS.find((t) => t.id === trackId) ?? MUSIC_TRACKS[0];
      const spb  = 60 / track.bpm;   // seconds per beat
      const s16  = spb / 4;           // one 16th note

      // Helper: schedule a pitched oscillator note
      function note(
        time: number,
        freq: number,
        dur: number,
        type: OscillatorType,
        amp: number,
      ) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(amp, time + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(env);
        env.connect(playGain);
        osc.start(time);
        osc.stop(time + dur + 0.02);
      }

      // Helper: schedule a noise burst (drums / hi-hats)
      function noise(time: number, dur: number, hiPass: number, amp: number) {
        const bufSize = Math.ceil(ctx.sampleRate * Math.min(dur, 0.5));
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const ch  = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) ch[i] = Math.random() * 2 - 1;

        const src = ctx.createBufferSource();
        src.buffer = buf;

        const flt = ctx.createBiquadFilter();
        flt.type = "highpass";
        flt.frequency.value = hiPass;

        const env = ctx.createGain();
        env.gain.setValueAtTime(amp, time);
        env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

        src.connect(flt);
        flt.connect(env);
        env.connect(playGain);
        src.start(time);
        src.stop(time + dur + 0.02);
      }

      // Per-track beat patterns (called once per 16th-note slot)
      const patterns: Record<string, (b: number, t: number) => void> = {
        // Lo-Fi: slow jazz-ish groove with soft pads
        t1: (b, t) => {
          if (b % 16 === 0)  note(t,  80, s16 * 3.5, "triangle", 0.9);
          if (b % 16 === 8)  note(t,  72, s16 * 2.0, "triangle", 0.7);
          if (b % 16 === 4)  noise(t, s16 * 0.35, 200, 0.55);
          if (b % 16 === 12) noise(t, s16 * 0.25, 200, 0.45);
          if (b % 2  === 0)  noise(t, s16 * 0.09, 8000, 0.18);
          if (b % 32 === 0)  { note(t, 220, spb * 8, "sine", 0.20); note(t, 277, spb * 8, "sine", 0.14); note(t, 330, spb * 8, "sine", 0.10); }
          if (b % 32 === 16) { note(t, 196, spb * 8, "sine", 0.20); note(t, 247, spb * 8, "sine", 0.14); note(t, 311, spb * 8, "sine", 0.10); }
        },
        // Epic Cinematic: heavy bass + orchestral swells
        t2: (b, t) => {
          if (b % 8 === 0) note(t,  65, spb * 1.9, "sawtooth", 0.70);
          if (b % 8 === 4) note(t,  73, spb * 1.9, "sawtooth", 0.60);
          if (b % 16 === 0)  noise(t, s16 * 1.0, 120, 0.80);
          if (b % 16 === 8)  noise(t, s16 * 0.6, 300, 0.60);
          if (b % 32 === 0)  { note(t, 196, spb * 4, "sine", 0.28); note(t, 247, spb * 4, "sine", 0.22); note(t, 330, spb * 4, "sine", 0.16); }
          if (b % 32 === 16) { note(t, 220, spb * 4, "sine", 0.28); note(t, 277, spb * 4, "sine", 0.22); note(t, 349, spb * 4, "sine", 0.16); }
        },
        // Upbeat Pop: four-on-floor with bright melody
        t3: (b, t) => {
          const mel = [523, 587, 659, 698, 784, 880, 988, 1047];
          if (b % 4  === 0) note(t,  80, s16 * 0.9, "sine",    1.0);
          if (b % 8  === 4) noise(t, s16 * 0.35, 300, 0.65);
          if (b % 2  === 0) noise(t, s16 * 0.06, 6000, 0.20);
          if (b % 4  === 2) note(t, mel[(Math.floor(b / 4)) % mel.length], s16 * 1.6, "triangle", 0.32);
        },
        // Deep Focus: slow evolving drones
        t4: (b, t) => {
          if (b % 64 === 0)  { note(t,  55, spb * 16, "sine", 0.50); note(t,  82, spb * 16, "sine", 0.35); note(t, 110, spb * 16, "sine", 0.22); }
          if (b % 64 === 32) { note(t,  65, spb * 16, "sine", 0.45); note(t,  98, spb * 16, "sine", 0.32); note(t, 130, spb * 16, "sine", 0.20); }
          if (b % 16 === 0)  noise(t, s16 * 0.5, 2000, 0.08);
        },
      };

      let beat     = 0;
      let nextTime = ctx.currentTime + 0.05;
      const LOOKAHEAD = 0.12;

      schedulerInterval = setInterval(() => {
        if (!ctxRef.current) return;
        while (nextTime < ctx.currentTime + LOOKAHEAD) {
          patterns[trackId]?.(beat, nextTime);
          beat++;
          nextTime += s16;
        }
      }, 20);
    } catch {
      // AudioContext blocked or unavailable — silently skip
    }

    return () => {
      clearInterval(schedulerInterval!);
      ctxRef.current?.close();
      ctxRef.current    = null;
      masterGainRef.current = null;
      playGainRef.current   = null;
    };
  // volume intentionally omitted — handled by separate effect below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, trackId]);

  // Smoothly fade music in/out when video play state changes
  useEffect(() => {
    if (!playGainRef.current || !ctxRef.current) return;
    playGainRef.current.gain.setTargetAtTime(
      isPlaying ? 1 : 0,
      ctxRef.current.currentTime,
      0.08,
    );
  }, [isPlaying]);

  // Adjust master volume without restarting the context
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = (volume / 100) * 0.28;
    }
  }, [volume]);
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface StepEditorProps {
  file: File | null;
  onNext: () => void;
}

export default function StepEditor({ file, onNext }: StepEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Create object URL once per file, revoke on cleanup
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setVideoUrl(null);
    };
  }, [file]);

  const [duration,    setDuration]    = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [subtitles,   setSubtitles]   = useState<Subtitle[]>(() => buildSubtitles(0));
  const [cuts,        setCuts]        = useState<Cut[]>(() => buildCuts(0));
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [volume,       setVolume]       = useState(65);
  const [selectedTrack, setSelectedTrack] = useState("t1");
  const [activeTab,    setActiveTab]   = useState<"timeline" | "subtitles" | "music">("timeline");

  // Jump-cut simulation state
  const [videoScale,    setVideoScale]    = useState(1);
  const [jumpFlash,     setJumpFlash]     = useState(false);
  const lastCutIdRef = useRef<string | null>(null);

  useMusicSynth(selectedTrack, musicEnabled, volume, isPlaying);

  // Rebuild subtitles/cuts once we know the real duration
  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return;
    const d = videoRef.current.duration;
    setDuration(d);
    setSubtitles(buildSubtitles(d));
    setCuts(buildCuts(d));
    lastCutIdRef.current = null;
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  }, []);

  // Detect when playhead crosses a cut boundary → simulate jump cut
  useEffect(() => {
    if (!isPlaying || cuts.length === 0) return;
    const active = cuts.find(
      (c) => currentTime >= c.startSec && currentTime < c.endSec,
    );
    if (!active || active.id === lastCutIdRef.current) return;
    lastCutIdRef.current = active.id;
    setVideoScale(1.055);
    setJumpFlash(true);
    setTimeout(() => {
      setVideoScale(1);
      setJumpFlash(false);
    }, 360);
  }, [currentTime, cuts, isPlaying]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const t = Number(e.target.value);
    videoRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  // Active subtitle: read from the same `subtitles` state that the editor mutates
  const activeSubtitle = subtitles.find(
    (s) => currentTime >= s.startSec && currentTime < s.endSec,
  );

  const updateSubtitle = useCallback((id: string, text: string) => {
    setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  }, []);

  const removeCut = useCallback((id: string) => {
    setCuts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const TABS = [
    { id: "timeline"  as const, label: "ציר זמן",  icon: Scissors },
    { id: "subtitles" as const, label: "כתוביות",  icon: AlignRight },
    { id: "music"     as const, label: "מוזיקה",    icon: Music },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col gap-5 w-full max-w-3xl mx-auto"
    >
      {/* Title */}
      <div className="text-center">
        <h2 className="text-3xl font-bold gradient-text mb-2">עריכה ידנית</h2>
        <p className="text-white/40 text-sm">ערוך חיתוכים, כתוביות ומוזיקה לפי רצונך</p>
      </div>

      {/* ── Video Player ── */}
      <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl shadow-black/60">
        {videoUrl ? (
          <>
            {/* Video element — scale changes simulate jump cuts */}
            <motion.video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              animate={{ scale: videoScale }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            />

            {/* Hebrew subtitle overlay — updates in real-time as user edits */}
            <AnimatePresence>
              {activeSubtitle && (
                <motion.div
                  key={activeSubtitle.id + activeSubtitle.text}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
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
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.36 }}
                  className="absolute inset-0 bg-white pointer-events-none"
                />
              )}
            </AnimatePresence>

            {/* Centre play button (fades away when playing) */}
            <motion.button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center"
              animate={{ opacity: isPlaying ? 0 : 1 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Play size={26} className="text-white ml-1" />
              </div>
            </motion.button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
              <Play size={22} className="text-white/20 ml-0.5" />
            </div>
            <p className="text-white/25 text-sm">לא הועלה וידאו — חזור לשלב הראשון</p>
          </div>
        )}
      </div>

      {/* ── Scrubber ── */}
      <div className="flex items-center gap-3 px-1">
        <button
          onClick={togglePlay}
          className="text-white/50 hover:text-white transition-colors shrink-0"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="text-white/30 text-xs font-mono w-10 shrink-0">{fmt(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1"
          style={{
            background: `linear-gradient(to right, rgba(139,92,246,0.7) ${progress}%, rgba(255,255,255,0.1) ${progress}%)`,
          }}
        />
        <span className="text-white/30 text-xs font-mono w-10 shrink-0 text-left">{fmt(duration)}</span>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1.5 p-1 glass rounded-2xl border border-white/8">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl
              text-sm font-medium transition-all duration-200
              ${activeTab === id
                ? "bg-gradient-to-r from-blue-600/70 to-purple-600/70 text-white shadow-lg shadow-blue-500/20"
                : "text-white/40 hover:text-white/60 hover:bg-white/5"}
            `}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">

        {/* Timeline */}
        {activeTab === "timeline" && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-3"
          >
            {/* Ruler with playhead */}
            <div className="relative h-8 glass rounded-xl border border-white/8 overflow-hidden">
              {cuts.map((cut) => (
                <div
                  key={cut.id}
                  className="absolute inset-y-0 bg-gradient-to-r from-blue-500/25 to-purple-500/20 border-x border-blue-500/30"
                  style={{
                    left:  `${(cut.startSec / (duration || 60)) * 100}%`,
                    width: `${((cut.endSec - cut.startSec) / (duration || 60)) * 100}%`,
                  }}
                />
              ))}
              <div
                className="absolute inset-y-0 w-0.5 bg-blue-400/90 z-10 transition-none"
                style={{ left: `${progress}%` }}
              />
              {[0, 25, 50, 75, 100].map((pct) => (
                <div
                  key={pct}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${pct}%` }}
                >
                  <div className="w-px h-full bg-white/8" />
                  <span className="absolute text-[9px] text-white/20 top-1" style={{ left: 3 }}>
                    {fmt((pct / 100) * (duration || 60))}
                  </span>
                </div>
              ))}
            </div>

            {/* Cut cards */}
            {cuts.map((cut, i) => (
              <motion.div
                key={cut.id}
                layout
                exit={{ opacity: 0, height: 0 }}
                className="glass rounded-xl p-3 border border-white/8 flex items-center gap-3"
              >
                <span className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-xs text-white/40 font-mono shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-sm font-medium">{cut.label}</p>
                  <p className="text-white/30 text-xs font-mono">
                    {fmt(cut.startSec)} — {fmt(cut.endSec)} ({Math.round(cut.endSec - cut.startSec)}s)
                  </p>
                </div>
                <button
                  onClick={() => removeCut(cut.id)}
                  className="text-white/20 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}
            <button className="glass rounded-xl p-3 border border-dashed border-white/10 flex items-center justify-center gap-2 text-white/30 hover:text-white/50 transition-colors">
              <Plus size={14} />
              <span className="text-sm">הוסף חיתוך</span>
            </button>
          </motion.div>
        )}

        {/* Subtitles */}
        {activeTab === "subtitles" && (
          <motion.div
            key="subtitles"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-2.5"
          >
            <p className="text-white/25 text-xs mb-1">
              לחץ על כיתוב לעריכה — השינויים יופיעו בזמן אמת על הוידאו
            </p>
            {subtitles.map((sub) => {
              const isActive = currentTime >= sub.startSec && currentTime < sub.endSec;
              return (
                <motion.div
                  key={sub.id}
                  className={`glass rounded-xl p-3 border transition-colors duration-200 ${
                    isActive ? "border-yellow-400/40 bg-yellow-400/5" : "border-white/8"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-white/20 text-xs font-mono pt-0.5 shrink-0 w-10">
                      {fmt(sub.startSec)}
                    </span>
                    <div className="flex-1">
                      {editingSubId === sub.id ? (
                        <div className="flex gap-2 items-start">
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
                            className="text-green-400 hover:text-green-300 mt-0.5"
                          >
                            <Check size={15} />
                          </button>
                        </div>
                      ) : (
                        <p
                          dir="rtl"
                          onClick={() => setEditingSubId(sub.id)}
                          className={`text-sm cursor-text hover:text-white/90 transition-colors leading-relaxed ${
                            isActive ? "text-yellow-300 font-semibold" : "text-white/60"
                          }`}
                        >
                          {sub.text}
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 shrink-0"
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Music */}
        {activeTab === "music" && (
          <motion.div
            key="music"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-4"
          >
            {/* On/Off toggle */}
            <div className="glass rounded-2xl p-4 border border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {musicEnabled
                  ? <Music size={18} className="text-purple-400" />
                  : <VolumeX size={18} className="text-white/30" />
                }
                <div>
                  <p className="text-white/70 text-sm font-medium">מוזיקת רקע</p>
                  <p className="text-white/30 text-xs">
                    {musicEnabled ? "מנגן בזמן תצוגה מקדימה (Web Audio)" : "כבוי"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMusicEnabled((v) => !v)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                  musicEnabled ? "bg-gradient-to-r from-blue-500 to-purple-500" : "bg-white/10"
                }`}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  animate={musicEnabled ? { right: "4px" } : { left: "4px" }}
                  transition={{ duration: 0.2 }}
                />
              </button>
            </div>

            <AnimatePresence>
              {musicEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-3"
                >
                  {/* Volume */}
                  <div className="glass rounded-2xl p-4 border border-white/8">
                    <div className="flex items-center gap-3 mb-3">
                      <Volume2 size={15} className="text-white/40 shrink-0" />
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
                  </div>

                  {/* Track list */}
                  {MUSIC_TRACKS.map((track) => (
                    <motion.button
                      key={track.id}
                      onClick={() => setSelectedTrack(track.id)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`glass rounded-xl p-3 border flex items-center gap-3 text-right transition-all ${
                        selectedTrack === track.id
                          ? "border-purple-500/40 bg-purple-500/5"
                          : "border-white/8 hover:border-white/15"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          selectedTrack === track.id
                            ? "bg-gradient-to-br from-purple-500/30 to-blue-500/30"
                            : "bg-white/5"
                        }`}
                      >
                        {selectedTrack === track.id && isPlaying ? (
                          <motion.div className="flex gap-0.5 items-end h-5">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-1 bg-purple-400 rounded-full"
                                animate={{ height: ["7px", "18px", "7px"] }}
                                transition={{ duration: 0.55, repeat: Infinity, delay: i * 0.15 }}
                              />
                            ))}
                          </motion.div>
                        ) : (
                          <Music
                            size={15}
                            className={selectedTrack === track.id ? "text-purple-400" : "text-white/30"}
                          />
                        )}
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
                          className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center shrink-0"
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

      {/* Next */}
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
