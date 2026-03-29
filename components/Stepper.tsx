"use client";

import { motion } from "framer-motion";
import { Upload, Cpu, Scissors, Image } from "lucide-react";

export const STEPS = [
  { id: 1, label: "העלאה", icon: Upload },
  { id: 2, label: "עיבוד AI", icon: Cpu },
  { id: 3, label: "עריכה ידנית", icon: Scissors },
  { id: 4, label: "טאבנייל וייצוא", icon: Image },
];

interface StepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export default function Stepper({ currentStep, onStepClick }: StepperProps) {
  return (
    <div className="relative w-full">
      {/* Connector line */}
      <div className="absolute top-6 right-[12.5%] left-[12.5%] h-px bg-white/10 hidden md:block" />
      <motion.div
        className="absolute top-6 right-[12.5%] h-px bg-gradient-to-l from-blue-500 to-purple-500 hidden md:block"
        initial={{ scaleX: 0 }}
        animate={{
          scaleX: Math.max(0, (currentStep - 1) / 3),
        }}
        style={{ left: "12.5%", transformOrigin: "right" }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />

      <div className="relative flex justify-between md:justify-around">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const isPending = step.id > currentStep;

          return (
            <button
              key={step.id}
              onClick={() => onStepClick?.(step.id)}
              disabled={isPending}
              className="flex flex-col items-center gap-2 group cursor-pointer disabled:cursor-not-allowed"
            >
              <div className="relative">
                {/* Outer glow ring for active */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)",
                    }}
                    animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}

                <motion.div
                  className={`
                    relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${isCompleted
                      ? "bg-gradient-to-br from-blue-500 to-purple-600 border-transparent shadow-lg shadow-blue-500/30"
                      : isActive
                      ? "glass border-blue-400/60 shadow-lg shadow-blue-500/20"
                      : "glass border-white/10"
                    }
                  `}
                  whileHover={!isPending ? { scale: 1.1 } : {}}
                  whileTap={!isPending ? { scale: 0.95 } : {}}
                >
                  {isCompleted ? (
                    <motion.svg
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="w-5 h-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </motion.svg>
                  ) : (
                    <Icon
                      size={18}
                      className={isActive ? "text-blue-400" : "text-white/30"}
                    />
                  )}
                </motion.div>
              </div>

              <span
                className={`text-xs font-medium transition-colors duration-300 hidden sm:block
                  ${isActive ? "text-blue-400" : isCompleted ? "text-white/60" : "text-white/25"}
                `}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
