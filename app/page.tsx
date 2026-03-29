"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Stepper from "@/components/Stepper";
import StepUpload from "@/components/steps/StepUpload";
import StepProcessing from "@/components/steps/StepProcessing";
import StepEditor from "@/components/steps/StepEditor";
import StepExport from "@/components/steps/StepExport";
import { Sparkles } from "lucide-react";

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleUploadComplete = useCallback((file: File) => {
    setUploadedFile(file);
    setCurrentStep(2);
  }, []);

  const handleProcessingComplete = useCallback(() => {
    setCurrentStep(3);
  }, []);

  const handleEditorNext = useCallback(() => {
    setCurrentStep(4);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentStep(1);
    setUploadedFile(null);
  }, []);

  return (
    <main className="relative min-h-screen flex flex-col">
      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-blue-400/30"
            style={{
              right: `${15 + i * 15}%`,
              top: `${20 + i * 10}%`,
            }}
            animate={{
              y: [-20, 20, -20],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center">
            <Sparkles size={14} className="text-blue-400" />
          </div>
          <span className="text-white/60 text-sm font-medium">AI Video Editor</span>
        </div>

        <div
          className="text-center"
          style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}
        >
          <h1 className="text-xl font-bold gradient-text">עורך וידאו AI</h1>
        </div>

        <div className="px-3 py-1.5 rounded-full glass border border-white/10 text-xs text-white/30 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          בטא
        </div>
      </header>

      {/* Stepper */}
      <div className="relative z-10 px-6 py-6 border-b border-white/5 max-w-2xl mx-auto w-full">
        <Stepper currentStep={currentStep} />
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 px-4 sm:px-6 py-8 pb-16 max-w-3xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div key="step1">
              <StepUpload onNext={handleUploadComplete} />
            </motion.div>
          )}
          {currentStep === 2 && (
            <motion.div key="step2">
              <StepProcessing
                fileName={uploadedFile?.name}
                onComplete={handleProcessingComplete}
              />
            </motion.div>
          )}
          {currentStep === 3 && (
            <motion.div key="step3">
              <StepEditor onNext={handleEditorNext} />
            </motion.div>
          )}
          {currentStep === 4 && (
            <motion.div key="step4">
              <StepExport onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 border-t border-white/5">
        <p className="text-white/15 text-xs">עורך וידאו AI • מבוסס בינה מלאכותית</p>
      </footer>
    </main>
  );
}
