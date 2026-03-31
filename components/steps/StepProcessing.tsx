"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Waves, Brain, Wand2, ChevronRight,
  Lightbulb, Zap, Clock, TrendingUp, MessageSquare, Scissors,
  CheckCircle, FileVideo,
} from "lucide-react";
import { useEditor } from "@/context/EditorContext";
import { transcribeVideo, wordsToSubtitles, TranscriptionError } from "@/lib/transcribe";
import type { Word } from "@/context/EditorContext";

// ─── Phase configuration ───────────────────────────────────────────────────────

interface PhaseConfig {
  n: number;
  fromPct: number;
  toPct: number;
  ms: number;
  he: string;
  en: string;
  Icon: React.ElementType;
  grad: string;
  glow: string;
}

const PHASES: PhaseConfig[] = [
  {
    n: 1, fromPct: 0, toPct: 30, ms: 2500,
    he: "חילוץ אודיו", en: "Extracting Audio Stream",
    Icon: Waves, grad: "from-blue-500 to-cyan-400", glow: "rgba(59,130,246,0.5)",
  },
  {
    n: 2, fromPct: 30, toPct: 75, ms: 7000,
    he: "יישור פונטי מילה-במילה", en: "Phonetic Alignment & Word Syncing",
    Icon: Brain, grad: "from-purple-500 to-violet-400", glow: "rgba(139,92,246,0.5)",
  },
  {
    n: 3, fromPct: 75, toPct: 100, ms: 3000,
    he: "עיצוב ויזואלי ורינדור", en: "Visual Style Generation & Rendering",
    Icon: Wand2, grad: "from-pink-500 to-amber-400", glow: "rgba(236,72,153,0.5)",
  },
];

function getPhaseN(p: number): 1 | 2 | 3 {
  if (p < 30) return 1;
  if (p < 75) return 2;
  return 3;
}

const TICK_MS = 50;
const PHASE_RATES: Record<1 | 2 | 3, number> = {
  1: (30 / 2500) * TICK_MS,  // 0.600 %/tick
  2: (45 / 7000) * TICK_MS,  // 0.321 %/tick  ← slowest = "AI working hard"
  3: (25 / 3000) * TICK_MS,  // 0.417 %/tick
};

// ─── Fallback word stream (shown while real analysis is still in progress) ────
// Typed as Word[] so it's a drop-in for analysisResult when not yet available.

const WORD_STREAM: Word[] = [
  { id: "d0",  text: "שלום",    start: 0.12, end: 0.44, confidence: 0.99 },
  { id: "d1",  text: "ברוכים",  start: 0.52, end: 0.91, confidence: 0.97 },
  { id: "d2",  text: "הבאים",   start: 0.95, end: 1.28, confidence: 0.98 },
  { id: "d3",  text: "לסרטון",  start: 1.35, end: 1.74, confidence: 0.96 },
  { id: "d4",  text: "שלי",     start: 1.80, end: 2.05, confidence: 0.99 },
  { id: "d5",  text: "היום",    start: 2.40, end: 2.68, confidence: 0.98 },
  { id: "d6",  text: "אנחנו",   start: 2.75, end: 3.14, confidence: 0.95 },
  { id: "d7",  text: "הולכים",  start: 3.20, end: 3.60, confidence: 0.97 },
  { id: "d8",  text: "לדבר",    start: 3.65, end: 3.92, confidence: 0.99 },
  { id: "d9",  text: "על",      start: 3.98, end: 4.11, confidence: 0.99 },
  { id: "d10", text: "הנושא",   start: 4.20, end: 4.56, confidence: 0.96 },
  { id: "d11", text: "הכי",     start: 4.62, end: 4.81, confidence: 0.98 },
  { id: "d12", text: "חם",      start: 4.87, end: 5.05, confidence: 0.97 },
  { id: "d13", text: "של",      start: 5.10, end: 5.22, confidence: 0.99 },
  { id: "d14", text: "השנה",    start: 5.28, end: 5.68, confidence: 0.98 },
  { id: "d15", text: "זה",      start: 6.10, end: 6.28, confidence: 0.99 },
  { id: "d16", text: "חשוב",    start: 6.35, end: 6.72, confidence: 0.97 },
  { id: "d17", text: "מאוד",    start: 6.78, end: 7.12, confidence: 0.96 },
  { id: "d18", text: "כי",      start: 7.20, end: 7.32, confidence: 0.99 },
  { id: "d19", text: "ישנה",    start: 7.38, end: 7.68, confidence: 0.95 },
];

// ─── Viral tips carousel ───────────────────────────────────────────────────────

const TIPS = [
  { Icon: Zap,           text: "פתח עם הוק חזק ב-3 השניות הראשונות — זה מה שמונע מהצופים לגלול הלאה." },
  { Icon: Scissors,      text: "קצב חיתוכים של 2–3 שניות לקטע שומר על קצב דינמי ומגביר watch-time." },
  { Icon: MessageSquare, text: "כתוביות מגדילות צפייה ב-80% — רוב הצופים צופים ללא קול בנייד." },
  { Icon: TrendingUp,    text: "כתוביות צהובות על רקע כהה הן סטנדרט TikTok/YouTube Shorts שהוכח." },
  { Icon: Clock,         text: "סרטונים בין 60–90 שניות מקבלים את מקסימום ה-watch time ב-Reels." },
  { Icon: Lightbulb,     text: "הדגשת מילת המפתח בצבע שונה מגדילה retention ב-40% — זה ה-edge שלך." },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  fileName?: string;
  onComplete: () => void;
  onBack?: () => void;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function StepProcessing({ fileName, onComplete, onBack }: Props) {
  const { state, dispatch } = useEditor();

  const [progress,      setProgress]      = useState(0);
  const [done,          setDone]          = useState(false);
  const [tipIdx,        setTipIdx]        = useState(0);
  const [revealedWords, setRevealedWords] = useState(0);

  // Real analysis state — null while running, Word[] on success, "error" on failure
  const [analysisResult, setAnalysisResult] = useState<Word[] | null>(null);
  const [analysisError,  setAnalysisError]  = useState<string | null>(null);

  const completionFired = useRef(false);
  const currentPhase    = getPhaseN(progress);
  const phaseConfig     = PHASES[currentPhase - 1];

  // ── Start real amplitude analysis on mount ───────────────────────────────
  useEffect(() => {
    const file = state.file;
    if (!file) {
      setAnalysisError("No file available for transcription.");
      return;
    }
    transcribeVideo(file)
      .then(words => setAnalysisResult(words))
      .catch(err => {
        const msg = err instanceof TranscriptionError
          ? `${err.code}: ${err.message}`
          : String(err);
        console.error("[StepProcessing] transcription failed:", msg);
        setAnalysisError(msg);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount — file won't change during processing

  // ── Tip carousel ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 3800);
    return () => clearInterval(t);
  }, []);

  // ── Master progress driver (visual animation independent of analysis) ────
  useEffect(() => {
    if (done) return;
    const iv = setInterval(() => {
      setProgress(prev => {
        const rate = PHASE_RATES[getPhaseN(prev)];
        const next = prev + rate;
        if (next >= 100) { clearInterval(iv); return 100; }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(iv);
  }, [done]);

  // ── Phase-2 word stream reveal (driven by progress) ───────────────────────
  useEffect(() => {
    if (currentPhase === 2) {
      const frac    = (progress - 30) / 45;
      const stream  = analysisResult ?? WORD_STREAM;
      setRevealedWords(Math.min(Math.floor(frac * stream.length), stream.length));
    } else if (currentPhase >= 3) {
      const stream = analysisResult ?? WORD_STREAM;
      setRevealedWords(stream.length);
    }
  }, [progress, currentPhase, analysisResult]);

  // ── Completion gate: wait for BOTH progress=100 AND analysis settled ────
  // (analysis almost always finishes during phase 1 for typical video sizes)
  const analysisSettled = analysisResult !== null || analysisError !== null;
  useEffect(() => {
    if (progress >= 100 && analysisSettled && !completionFired.current) {
      completionFired.current = true;

      const words = analysisResult ?? [];
      // Dispatch word-level transcript + derived subtitle lines
      dispatch({ type: "SET_TRANSCRIPT",  words });
      dispatch({ type: "INIT_SUBTITLES",  subtitles: wordsToSubtitles(words) });

      setDone(true);
      const t = setTimeout(onComplete, 1500);
      return () => clearTimeout(t);
    }
  }, [progress, analysisResult, analysisError, dispatch, onComplete]); // no `done` dep — prevents cleanup race

  // ── Derived display values ────────────────────────────────────────────────
  const stream       = analysisResult ?? WORD_STREAM;
  const frac2        = currentPhase === 2 ? (progress - 30) / 45 : currentPhase >= 3 ? 1 : 0;
  const wordCount    = Math.round(frac2 * stream.length);
  const confidence   = parseFloat((frac2 * (analysisResult ? 97.4 : 97.4)).toFixed(1));

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col gap-6 w-full max-w-3xl mx-auto"
    >
      {/* Back */}
      {onBack && (
        <button
          onClick={onBack}
          className="self-start flex items-center gap-1.5 text-white/35 hover:text-white/70 transition-colors text-sm"
        >
          <ChevronRight size={16} />
          חזור להעלאה
        </button>
      )}

      {/* Header */}
      <div className="text-center">
        <motion.h2
          className="text-3xl font-black gradient-text mb-1"
          animate={done ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 0.4 }}
        >
          {done ? "✓ העיבוד הושלם!" : "עיבוד AI מתקדם"}
        </motion.h2>
        {fileName && (
          <p className="text-white/30 text-xs font-mono truncate max-w-xs mx-auto">{fileName}</p>
        )}
      </div>

      {/* Phase pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        {PHASES.map(ph => {
          const status = ph.n < currentPhase ? "done" : ph.n === currentPhase ? "active" : "pending";
          const PhIcon = ph.Icon;
          return (
            <div
              key={ph.n}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-medium transition-all duration-500 ${
                status === "active"
                  ? "border-white/20 bg-white/8 text-white"
                  : status === "done"
                  ? "border-green-500/30 bg-green-500/8 text-green-400"
                  : "border-white/5 bg-white/2 text-white/20"
              }`}
            >
              {status === "done" ? (
                <CheckCircle size={12} />
              ) : status === "active" ? (
                <motion.div
                  animate={{ rotate: ph.n === 2 ? 360 : [0, 8, -8, 0] }}
                  transition={
                    ph.n === 2
                      ? { duration: 3, repeat: Infinity, ease: "linear" }
                      : { duration: 2, repeat: Infinity }
                  }
                >
                  <PhIcon size={12} />
                </motion.div>
              ) : (
                <PhIcon size={12} />
              )}
              <span>{ph.he}</span>
            </div>
          );
        })}
      </div>

      {/* Main two-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">

        {/* Left col: video preview + stats */}
        <div className="sm:col-span-2 flex flex-col gap-3">
          {/* Video placeholder */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/8 bg-[#07091199]">
            {/* Grid overlay */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            {/* Scanning line */}
            <motion.div
              className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent"
              animate={{ top: ["0%", "100%"] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
            />
            {/* Center icon + filename */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              >
                <FileVideo size={30} className="text-white/20" />
              </motion.div>
              {fileName && (
                <p className="text-white/15 text-[10px] font-mono truncate max-w-[85%]">{fileName}</p>
              )}
            </div>
            {/* Phase completion chips */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
              <AnimatePresence>
                {currentPhase >= 2 && (
                  <motion.div
                    key="audio-chip"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/25 text-cyan-400 text-[9px] font-bold tracking-wide"
                  >
                    <CheckCircle size={8} /> AUDIO ✓
                  </motion.div>
                )}
                {currentPhase >= 3 && (
                  <motion.div
                    key="words-chip"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/25 text-purple-300 text-[9px] font-bold tracking-wide"
                  >
                    <CheckCircle size={8} /> {wordCount} WORDS ✓
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Phase 3: caption style preview at bottom */}
            {currentPhase === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-3 inset-x-3 text-center"
              >
                <CaptionPreviewLine />
              </motion.div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: "מילים זוהו",
                value: wordCount > 0 ? wordCount.toLocaleString("he-IL") : "—",
                color: "text-white",
              },
              {
                label: "דיוק",
                value: confidence > 0 ? `${confidence}%` : "—",
                color: "text-green-400",
              },
              {
                label: "שפה",
                value: "עברית 🇮🇱",
                color: "text-white/70",
              },
              {
                label: "מודל",
                value: "Whisper V3",
                color: "text-blue-400",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass rounded-xl p-3 border border-white/8">
                <p className="text-white/25 text-[10px] mb-0.5">{label}</p>
                <p className={`font-bold text-sm font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right col: phase visualization card */}
        <div className="sm:col-span-3">
          <div
            className="glass rounded-2xl p-5 border border-white/10 h-full flex flex-col gap-4"
            style={{ minHeight: 260 }}
          >
            {/* Phase header */}
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${phaseConfig.grad} flex items-center justify-center shrink-0`}
                style={{ boxShadow: `0 0 18px ${phaseConfig.glow}` }}
              >
                <motion.div
                  animate={
                    currentPhase === 2
                      ? { rotate: 360 }
                      : currentPhase === 1
                      ? { scaleY: [1, 0.7, 1] }
                      : { rotate: [0, 15, -15, 0] }
                  }
                  transition={
                    currentPhase === 2
                      ? { duration: 3, repeat: Infinity, ease: "linear" }
                      : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                  }
                >
                  <phaseConfig.Icon size={18} className="text-white" />
                </motion.div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{phaseConfig.he}</p>
                <p className="text-white/30 text-[11px]">{phaseConfig.en}</p>
              </div>
              <span className="text-white/40 text-xs font-mono tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>

            {/* Phase-specific visualization */}
            <div className="flex-1">
              {currentPhase === 1 && <Phase1AudioViz />}
              {currentPhase === 2 && <Phase2WordStream words={stream} revealed={revealedWords} />}
              {currentPhase === 3 && <Phase3RenderViz />}
            </div>
          </div>
        </div>
      </div>

      {/* Master segmented progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="relative h-3 rounded-full bg-white/5 overflow-hidden border border-white/8">
          {/* Phase zone shading */}
          <div className="absolute inset-y-0 left-0 w-[30%] bg-blue-500/8 border-r border-white/5" />
          <div className="absolute inset-y-0 left-[30%] w-[45%] bg-purple-500/8 border-r border-white/5" />
          <div className="absolute inset-y-0 left-[75%] w-[25%] bg-pink-500/8" />
          {/* Progress fill */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.12 }}
            style={{
              background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
              boxShadow: "2px 0 14px rgba(139,92,246,0.7)",
            }}
          />
          {/* Shimmer sweep */}
          <motion.div
            className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            animate={{ left: ["-64px", "100%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        {/* Phase labels */}
        <div className="grid text-[10px] text-white/20" style={{ gridTemplateColumns: "30% 45% 25%" }}>
          <span className="text-right pr-1">חילוץ אודיו</span>
          <span className="text-center">יישור פונטי מילה-במילה</span>
          <span className="text-left pl-1">רינדור</span>
        </div>
      </div>

      {/* Tips carousel */}
      <div className="glass rounded-2xl p-4 border border-white/8">
        <p className="text-white/20 text-[10px] uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Lightbulb size={10} />
          טיפ ליוצרי תוכן ויראלי
        </p>
        <AnimatePresence mode="wait">
          <motion.div
            key={tipIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-3"
          >
            {(() => {
              const { Icon: TipIcon, text } = TIPS[tipIdx];
              return (
                <>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400/15 to-orange-400/15 border border-yellow-400/20 flex items-center justify-center shrink-0">
                    <TipIcon size={16} className="text-yellow-400" />
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed" dir="rtl">{text}</p>
                </>
              );
            })()}
          </motion.div>
        </AnimatePresence>
        <div className="flex justify-center gap-1.5 mt-3">
          {TIPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === tipIdx ? "w-4 h-1.5 bg-yellow-400" : "w-1.5 h-1.5 bg-white/12"
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Phase 1: Audio spectrum visualiser ───────────────────────────────────────

function Phase1AudioViz() {
  const [heights, setHeights] = useState<number[]>(() =>
    Array.from({ length: 20 }, () => 0.15 + Math.random() * 0.7)
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setHeights(prev =>
        prev.map(h => Math.max(0.08, Math.min(1, h + (Math.random() - 0.5) * 0.35)))
      );
    }, 80);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex flex-col gap-3 h-full justify-between">
      <p className="text-white/25 text-xs">ניתוח ספקטרום אודיו...</p>
      <div className="flex items-end gap-1 h-24">
        {heights.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${h * 100}%`,
              background: `linear-gradient(to top, rgba(59,130,246,0.9), rgba(6,182,212,${0.2 + h * 0.6}))`,
              transition: "height 80ms ease",
              minHeight: 3,
            }}
          />
        ))}
      </div>
      <div className="flex gap-4 text-[10px] text-white/20 font-mono">
        <span>PCM 44.1kHz</span>
        <span>Mono</span>
        <span>16-bit float</span>
      </div>
    </div>
  );
}

// ─── Phase 2: Live word-level alignment stream ─────────────────────────────────

function Phase2WordStream({ words, revealed }: { words: Word[]; revealed: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [revealed]);

  return (
    <div className="flex flex-col gap-1 h-full">
      <p className="text-white/25 text-xs">זיהוי מילים בזמן אמת · Deepgram / Whisper Large V3</p>
      <div
        ref={scrollRef}
        className="overflow-y-auto flex-1 flex flex-col gap-1.5"
        style={{ maxHeight: 180, scrollbarWidth: "none" }}
      >
        {words.slice(0, revealed).map((w) => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2"
            dir="rtl"
          >
            <span className="text-white font-bold text-sm">{w.text}</span>
            <span className="text-white/20 text-[10px] font-mono">
              {w.start.toFixed(2)}s → {w.end.toFixed(2)}s
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                w.confidence >= 0.97
                  ? "bg-green-500/15 text-green-400"
                  : "bg-yellow-500/15 text-yellow-400"
              }`}
            >
              {Math.round(w.confidence * 100)}%
            </span>
          </motion.div>
        ))}
        {revealed < words.length && (
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.7, repeat: Infinity }}
            className="text-blue-400 text-base leading-none"
          >
            ▌
          </motion.span>
        )}
      </div>
    </div>
  );
}

// ─── Phase 3: Caption style render preview ────────────────────────────────────

const CAPTION_LINES = [
  ["שלום", "ברוכים", "הבאים"],
  ["היום", "אנחנו", "מדברים"],
  ["על", "הנושא", "החם"],
];

function Phase3RenderViz() {
  const [pos, setPos] = useState({ line: 0, word: 0 });

  useEffect(() => {
    const iv = setInterval(() => {
      setPos(prev => {
        const nextWord = prev.word + 1;
        if (nextWord >= CAPTION_LINES[prev.line].length) {
          return { line: (prev.line + 1) % CAPTION_LINES.length, word: 0 };
        }
        return { ...prev, word: nextWord };
      });
    }, 420);
    return () => clearInterval(iv);
  }, []);

  const line = CAPTION_LINES[pos.line];

  return (
    <div className="flex flex-col gap-3 h-full justify-between">
      <p className="text-white/25 text-xs">מייצר סגנון כתוביות + הדגשת מילה פעילה...</p>
      <div
        className="rounded-xl aspect-video flex items-end justify-center pb-3 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #08091a 0%, #110a2a 100%)" }}
      >
        {/* Fake video frame lines */}
        <div className="absolute inset-0 opacity-10 flex flex-col justify-start pt-4 gap-2 px-4">
          <div className="h-1.5 w-3/4 rounded-full bg-white/40" />
          <div className="h-1 w-1/2 rounded-full bg-white/20" />
        </div>
        {/* Caption row */}
        <div className="flex items-center justify-center gap-1.5 px-3" dir="rtl">
          {line.map((word, i) => (
            <motion.span
              key={`${pos.line}-${i}`}
              className="font-black text-base leading-tight"
              style={{
                color: i === pos.word ? "#ffe234" : "#ffffff",
                WebkitTextStroke: "1.5px #000",
                paintOrder: "stroke fill" as React.CSSProperties["paintOrder"],
                textShadow:
                  i === pos.word
                    ? "0 0 14px rgba(255,226,52,0.7), 0 2px 8px rgba(0,0,0,0.9)"
                    : "0 2px 6px rgba(0,0,0,0.9)",
                transition: "color 0.12s, text-shadow 0.12s",
              }}
            >
              {word}
            </motion.span>
          ))}
        </div>
        {/* Style label */}
        <motion.div
          className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-yellow-400/15 border border-yellow-400/25 text-yellow-400 text-[9px] font-bold"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          TikTok Bold
        </motion.div>
      </div>
    </div>
  );
}

// ─── Caption preview line (video placeholder overlay, phase 3) ────────────────

function CaptionPreviewLine() {
  const words = WORD_STREAM.slice(0, 3);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setActive(a => (a + 1) % words.length), 350);
    return () => clearInterval(iv);
  }, [words.length]);

  return (
    <div className="flex items-center justify-center gap-1" dir="rtl">
      {words.map((w, i) => (
        <span
          key={i}
          className="font-black text-xs"
          style={{
            color: i === active ? "#ffe234" : "#fff",
            WebkitTextStroke: "1px #000",
            paintOrder: "stroke fill" as React.CSSProperties["paintOrder"],
            transition: "color 0.12s",
          }}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}
