"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image,
  Sparkles,
  Download,
  RotateCcw,
  Zap,
  CheckCircle,
  Loader,
  Send,
  ChevronRight,
} from "lucide-react";

interface StepExportProps {
  onReset: () => void;
  onBack?: () => void;
}

type ThumbnailState = "idle" | "generating" | "done";
type ExportState = "idle" | "exporting" | "done";

const THUMBNAIL_SUGGESTIONS = [
  "פרצוף מופתע עם טקסט גדול בעברית",
  "תמונה עם אפקט זוהר וצבעים כחול-סגול",
  "קולאז' דינמי עם חצים ואמוג'ים",
  "רקע כהה עם כותרת בולטת",
];

export default function StepExport({ onReset, onBack }: StepExportProps) {
  const [prompt, setPrompt] = useState("");
  const [thumbnailState, setThumbnailState] = useState<ThumbnailState>("idle");
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);

  const generateThumbnail = () => {
    if (!prompt.trim()) return;
    setThumbnailState("generating");
    setTimeout(() => setThumbnailState("done"), 3500);
  };

  const handleExport = () => {
    setExportState("exporting");
    setTimeout(() => setExportState("done"), 3000);
  };

  const handleSuggestion = (text: string, idx: number) => {
    setPrompt(text);
    setSelectedSuggestion(idx);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col gap-8 w-full max-w-2xl mx-auto"
    >
      {/* Back button */}
      {onBack && (
        <div className="self-start">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/35 hover:text-white/70 transition-colors text-sm"
          >
            <ChevronRight size={16} />
            חזור לעריכה
          </button>
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold gradient-text mb-2">טאבנייל וייצוא</h2>
        <p className="text-white/40 text-sm">צור תמונה ממוזערת וייצא את הוידאו הסופי</p>
      </div>

      {/* Nano Banana Pro Integration Block */}
      <div className="glass rounded-3xl p-6 border border-white/10">
        {/* Provider badge */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400/20 to-orange-400/20 border border-yellow-400/30 flex items-center justify-center">
              <span className="text-lg">🍌</span>
            </div>
            <div>
              <p className="text-white/80 font-semibold text-sm">Nano Banana Pro</p>
              <p className="text-white/30 text-xs">AI Thumbnail Generator</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            מחובר
          </span>
        </div>

        {/* Prompt input */}
        <div className="flex flex-col gap-3">
          <label className="text-white/50 text-sm font-medium">תיאור לתמונה הממוזערת</label>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            {THUMBNAIL_SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestion(sug, idx)}
                className={`
                  px-3 py-1.5 rounded-xl text-xs transition-all duration-200
                  ${selectedSuggestion === idx
                    ? "bg-purple-500/20 border border-purple-500/40 text-purple-300"
                    : "glass border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20"
                  }
                `}
              >
                {sug}
              </button>
            ))}
          </div>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setSelectedSuggestion(null);
                if (thumbnailState === "done") setThumbnailState("idle");
              }}
              placeholder="תאר את התמונה הממוזערת שאתה רוצה לייצר..."
              dir="rtl"
              rows={3}
              className="w-full glass rounded-2xl border border-white/10 p-4 text-white/70 text-sm placeholder:text-white/20 outline-none resize-none focus:border-purple-400/40 transition-colors"
            />
            <div className="absolute bottom-3 left-3 text-white/20 text-xs">{prompt.length}/200</div>
          </div>

          <motion.button
            onClick={generateThumbnail}
            disabled={!prompt.trim() || thumbnailState === "generating"}
            whileHover={prompt.trim() && thumbnailState !== "generating" ? { scale: 1.02 } : {}}
            whileTap={prompt.trim() && thumbnailState !== "generating" ? { scale: 0.98 } : {}}
            className={`
              flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-medium text-sm transition-all duration-300
              ${prompt.trim() && thumbnailState !== "generating"
                ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 text-yellow-300 hover:border-yellow-400/50"
                : "glass border border-white/8 text-white/25 cursor-not-allowed"
              }
            `}
          >
            {thumbnailState === "generating" ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader size={15} />
                </motion.div>
                מייצר טאבנייל...
              </>
            ) : thumbnailState === "done" ? (
              <>
                <CheckCircle size={15} />
                טאבנייל נוצר!
              </>
            ) : (
              <>
                <Sparkles size={15} />
                צור טאבנייל עם AI
              </>
            )}
          </motion.button>
        </div>

        {/* Thumbnail preview */}
        <AnimatePresence>
          {thumbnailState !== "idle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5"
            >
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                {thumbnailState === "generating" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    {/* Scan line */}
                    <motion.div
                      className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-purple-400/60 to-transparent"
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    {/* Pixel grid forming */}
                    <div className="grid grid-cols-8 gap-1 opacity-40">
                      {Array.from({ length: 32 }).map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-5 h-5 rounded"
                          animate={{
                            backgroundColor: [
                              "rgba(139,92,246,0.2)",
                              "rgba(59,130,246,0.5)",
                              "rgba(139,92,246,0.2)",
                            ],
                          }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: (i * 0.05) % 1 }}
                        />
                      ))}
                    </div>
                    <p className="text-white/40 text-sm">מייצר טאבנייל...</p>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #1a0533 0%, #0a1a3d 50%, #001030 100%)",
                    }}
                  >
                    {/* Simulated thumbnail */}
                    <div className="text-center px-8">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-3xl font-black text-white mb-2 leading-tight"
                        style={{ textShadow: "0 0 30px rgba(59,130,246,0.8)" }}
                        dir="rtl"
                      >
                        {prompt.slice(0, 20)}...
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex justify-center gap-2 mt-3"
                      >
                        {["🔥", "✨", "💎"].map((emoji, i) => (
                          <span key={i} className="text-2xl">{emoji}</span>
                        ))}
                      </motion.div>
                    </div>
                    <motion.div
                      className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium flex items-center gap-1"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      <CheckCircle size={10} />
                      נוצר
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Export section */}
      <div className="glass rounded-3xl p-6 border border-white/10">
        <h3 className="text-white/70 font-semibold mb-4 flex items-center gap-2">
          <Zap size={18} className="text-blue-400" />
          ייצוא הוידאו הסופי
        </h3>

        {/* Export stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "רזולוציה", value: "1080p" },
            { label: "פורמט", value: "MP4" },
            { label: "איכות", value: "גבוהה" },
          ].map(({ label, value }) => (
            <div key={label} className="glass rounded-xl p-3 border border-white/8 text-center">
              <p className="text-white/70 font-semibold text-sm">{value}</p>
              <p className="text-white/30 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Export progress */}
        <AnimatePresence>
          {exportState === "exporting" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <ExportProgressBar />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Download button */}
        <motion.button
          onClick={exportState === "idle" ? handleExport : undefined}
          disabled={exportState === "exporting"}
          whileHover={exportState === "idle" ? { scale: 1.02 } : {}}
          whileTap={exportState === "idle" ? { scale: 0.98 } : {}}
          className={`
            relative w-full py-4 rounded-2xl font-bold text-base transition-all duration-300 overflow-hidden
            flex items-center justify-center gap-3
            ${exportState === "idle"
              ? "cursor-pointer"
              : exportState === "exporting"
              ? "cursor-not-allowed opacity-80"
              : ""
            }
          `}
          style={
            exportState !== "done"
              ? {
                  background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                  boxShadow: exportState === "idle"
                    ? "0 0 30px rgba(59,130,246,0.4), 0 0 60px rgba(139,92,246,0.2)"
                    : "none",
                }
              : {
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  boxShadow: "0 0 30px rgba(22,163,74,0.4)",
                }
          }
        >
          {/* Animated glow overlay for idle */}
          {exportState === "idle" && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{
                background: [
                  "radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 60%)",
                  "radial-gradient(ellipse at 80% 50%, rgba(255,255,255,0.08) 0%, transparent 60%)",
                  "radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 60%)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          {exportState === "exporting" ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader size={20} className="text-white" />
              </motion.div>
              <span className="text-white">מייצא וידאו...</span>
            </>
          ) : exportState === "done" ? (
            <>
              <CheckCircle size={20} className="text-white" />
              <span className="text-white">הווידאו מוכן! לחץ להורדה</span>
              <Download size={18} className="text-white" />
            </>
          ) : (
            <>
              <Download size={20} className="text-white" />
              <span className="text-white">הורד וידאו סופי</span>
              <Sparkles size={16} className="text-white/70" />
            </>
          )}
        </motion.button>
      </div>

      {/* Start over */}
      <button
        onClick={onReset}
        className="flex items-center justify-center gap-2 text-white/25 hover:text-white/50 transition-colors text-sm py-2"
      >
        <RotateCcw size={14} />
        התחל מחדש
      </button>
    </motion.div>
  );
}

function ExportProgressBar() {
  const [progress, setProgress] = useState(0);

  useState(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + 2;
      });
    }, 60);
    return () => clearInterval(interval);
  });

  const stages = [
    { label: "מקמפל חיתוכים", threshold: 25 },
    { label: "מטמיע כתוביות", threshold: 55 },
    { label: "מסנכרן מוזיקה", threshold: 80 },
    { label: "מייצר קובץ סופי", threshold: 100 },
  ];

  const currentStage = stages.find((s) => progress <= s.threshold)?.label ?? "מסיים...";

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-white/40">
        <span>{currentStage}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 relative overflow-hidden"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </div>
  );
}
