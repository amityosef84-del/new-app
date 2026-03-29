"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Scissors, Music, CheckCircle } from "lucide-react";

interface ProcessingTask {
  id: string;
  label: string;
  sublabel: string;
  duration: number;
  icon: React.ElementType;
  color: string;
}

const TASKS: ProcessingTask[] = [
  {
    id: "speech",
    label: "מזהה דיבור...",
    sublabel: "ניתוח אודיו וזיהוי שפה עברית",
    duration: 2800,
    icon: Cpu,
    color: "from-blue-500 to-cyan-400",
  },
  {
    id: "subtitles",
    label: "מייצר כתוביות בעברית...",
    sublabel: "תמלול אוטומטי מבוסס AI",
    duration: 3200,
    icon: Cpu,
    color: "from-cyan-500 to-teal-400",
  },
  {
    id: "cuts",
    label: "מבצע חיתוכים אוטומטיים...",
    sublabel: "מזהה שתיקות ורגעים לא רלוונטיים",
    duration: 2600,
    icon: Scissors,
    color: "from-purple-500 to-pink-400",
  },
  {
    id: "music",
    label: "מתאים מוזיקת רקע...",
    sublabel: "בוחר טראק טרנדי מהספרייה",
    duration: 2400,
    icon: Music,
    color: "from-pink-500 to-rose-400",
  },
];

interface StepProcessingProps {
  fileName?: string;
  onComplete: () => void;
}

export default function StepProcessing({ fileName, onComplete }: StepProcessingProps) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [taskProgress, setTaskProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (currentTaskIndex >= TASKS.length) {
      setIsDone(true);
      const timer = setTimeout(() => onComplete(), 1500);
      return () => clearTimeout(timer);
    }

    const task = TASKS[currentTaskIndex];
    setTaskProgress(0);

    const progressInterval = setInterval(() => {
      setTaskProgress((p) => {
        if (p >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return p + (100 / (task.duration / 80));
      });
    }, 80);

    const taskTimer = setTimeout(() => {
      setCompletedTasks((prev) => [...prev, task.id]);
      setCurrentTaskIndex((prev) => prev + 1);
    }, task.duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(taskTimer);
    };
  }, [currentTaskIndex, onComplete]);

  const overallProgress = ((completedTasks.length + (taskProgress / 100)) / TASKS.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center gap-10 w-full max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold gradient-text mb-2">עיבוד AI</h2>
        {fileName && (
          <p className="text-white/40 text-sm truncate max-w-xs mx-auto">{fileName}</p>
        )}
      </div>

      {/* Central AI Visualization */}
      <div className="relative flex items-center justify-center w-48 h-48">
        {/* Pulse rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-blue-500/30"
            style={{ width: 60 + i * 36, height: 60 + i * 36 }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.1, 0.6] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Rotating orbit */}
        <motion.div
          className="absolute w-40 h-40 rounded-full border border-dashed border-purple-500/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          <motion.div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-purple-500"
            style={{ boxShadow: "0 0 12px rgba(139,92,246,0.8)" }}
          />
        </motion.div>

        {/* Counter-rotating orbit */}
        <motion.div
          className="absolute w-28 h-28 rounded-full border border-dashed border-cyan-500/20"
          animate={{ rotate: -360 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        >
          <motion.div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400"
            style={{ boxShadow: "0 0 10px rgba(6,182,212,0.8)" }}
          />
        </motion.div>

        {/* Center icon */}
        <motion.div
          className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))",
            border: "1px solid rgba(139,92,246,0.4)",
            boxShadow: "0 0 30px rgba(139,92,246,0.2)",
          }}
          animate={isDone ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.4 }}
        >
          <AnimatePresence mode="wait">
            {isDone ? (
              <motion.div
                key="done"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
              >
                <CheckCircle size={28} className="text-green-400" />
              </motion.div>
            ) : (
              <motion.div
                key="processing"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Cpu size={28} className="text-blue-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Overall progress */}
      <div className="w-full max-w-md">
        <div className="flex justify-between text-xs text-white/40 mb-2">
          <span>התקדמות כללית</span>
          <span>{Math.round(overallProgress)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400"
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="w-full max-w-lg flex flex-col gap-3">
        {TASKS.map((task, index) => {
          const isCompleted = completedTasks.includes(task.id);
          const isActive = index === currentTaskIndex && !isDone;
          const Icon = task.icon;

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                glass rounded-2xl p-4 border transition-all duration-300
                ${isActive
                  ? "border-blue-500/30 bg-blue-500/5"
                  : isCompleted
                  ? "border-white/10 opacity-70"
                  : "border-white/5 opacity-40"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                  bg-gradient-to-br ${task.color} bg-opacity-20
                  ${isActive ? "opacity-100" : isCompleted ? "opacity-60" : "opacity-30"}
                `}
                  style={{ background: isCompleted || isActive ? undefined : "rgba(255,255,255,0.05)" }}
                >
                  {isCompleted ? (
                    <CheckCircle size={18} className="text-green-400" />
                  ) : (
                    <Icon
                      size={18}
                      className={isActive ? "text-white" : "text-white/30"}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${isActive ? "text-white" : isCompleted ? "text-white/50" : "text-white/25"}`}>
                    {task.label}
                  </p>
                  <p className={`text-xs ${isActive ? "text-white/40" : "text-white/20"}`}>
                    {task.sublabel}
                  </p>

                  {/* Task progress bar */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0 }}
                        className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden"
                      >
                        <motion.div
                          className={`h-full rounded-full bg-gradient-to-r ${task.color}`}
                          animate={{ width: `${taskProgress}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {isActive && (
                  <motion.div
                    className="w-2 h-2 rounded-full bg-blue-400"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Done state */}
      <AnimatePresence>
        {isDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400"
          >
            <CheckCircle size={18} />
            <span className="font-medium">העיבוד הושלם בהצלחה!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
