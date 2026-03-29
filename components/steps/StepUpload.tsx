"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Film, AlertCircle, CheckCircle, X } from "lucide-react";

interface StepUploadProps {
  onNext: (file: File) => void;
}

export default function StepUpload({ onNext }: StepUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_DURATION_SECONDS = 120;

  const validateAndSet = useCallback((f: File) => {
    setError(null);

    if (!f.type.startsWith("video/")) {
      setError("אנא העלה קובץ וידאו בלבד (MP4, MOV, AVI...)");
      return;
    }

    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(videoEl.src);
      if (videoEl.duration > MAX_DURATION_SECONDS) {
        setError(`אורך הווידאו חייב להיות עד ${MAX_DURATION_SECONDS / 60} דקות. הווידאו שלך: ${Math.ceil(videoEl.duration / 60)} דקות.`);
        return;
      }
      setFile(f);
    };
    videoEl.src = URL.createObjectURL(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  }, [validateAndSet]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) validateAndSet(selected);
  };

  const handleUpload = () => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => onNext(file), 400);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 200);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center gap-8"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold gradient-text mb-2">העלאת וידאו</h2>
        <p className="text-white/50 text-sm">תומך ב-MP4, MOV, AVI | עד 2 דקות</p>
      </div>

      {/* Drop Zone */}
      <motion.div
        onClick={() => !file && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        animate={{
          borderColor: isDragging
            ? "rgba(59,130,246,0.8)"
            : file
            ? "rgba(139,92,246,0.6)"
            : "rgba(255,255,255,0.1)",
          scale: isDragging ? 1.01 : 1,
        }}
        transition={{ duration: 0.2 }}
        className={`
          relative w-full max-w-2xl rounded-3xl border-2 border-dashed
          glass transition-all duration-200 overflow-hidden
          ${!file ? "cursor-pointer hover:border-blue-400/40 hover:bg-white/5" : ""}
        `}
        style={{ minHeight: 280 }}
      >
        {/* Animated background on drag */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 70%)",
              }}
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 flex flex-col items-center justify-center p-10 gap-5">
          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-5"
              >
                <motion.div
                  className="w-20 h-20 rounded-2xl glass-strong flex items-center justify-center"
                  animate={isDragging ? { rotate: [0, -5, 5, 0] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <Upload size={32} className={isDragging ? "text-blue-400" : "text-white/40"} />
                </motion.div>

                <div className="text-center">
                  <p className="text-white/70 text-lg font-medium mb-1">
                    {isDragging ? "שחרר כאן!" : "גרור וידאו לכאן"}
                  </p>
                  <p className="text-white/30 text-sm">או לחץ לבחירת קובץ</p>
                </div>

                <div className="flex gap-3">
                  {["MP4", "MOV", "AVI", "WEBM"].map((fmt) => (
                    <span
                      key={fmt}
                      className="px-3 py-1 rounded-full text-xs font-medium glass border border-white/10 text-white/40"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="file"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4 w-full"
              >
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
                  <Film size={32} className="text-purple-400" />
                </div>

                <div className="text-center">
                  <p className="text-white/80 font-semibold text-lg truncate max-w-xs">{file.name}</p>
                  <p className="text-white/40 text-sm">{formatFileSize(file.size)}</p>
                </div>

                {/* Progress bar */}
                <AnimatePresence>
                  {isUploading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm"
                    >
                      <div className="flex justify-between text-xs text-white/40 mb-2">
                        <span>מעלה...</span>
                        <span>{Math.min(100, Math.round(uploadProgress))}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                          animate={{ width: `${Math.min(100, uploadProgress)}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!isUploading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setError(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                    הסר קובץ
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-lg w-full"
          >
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA */}
      <motion.button
        onClick={handleUpload}
        disabled={!file || isUploading}
        whileHover={file && !isUploading ? { scale: 1.03 } : {}}
        whileTap={file && !isUploading ? { scale: 0.97 } : {}}
        className={`
          relative px-10 py-4 rounded-2xl font-semibold text-base transition-all duration-300
          ${file && !isUploading
            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:shadow-xl cursor-pointer"
            : "glass border border-white/10 text-white/30 cursor-not-allowed"
          }
        `}
      >
        {isUploading ? (
          <span className="flex items-center gap-2">
            <motion.div
              className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            מעלה...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <CheckCircle size={18} />
            המשך לעיבוד AI
          </span>
        )}
      </motion.button>
    </motion.div>
  );
}
