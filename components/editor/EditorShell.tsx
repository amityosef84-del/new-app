"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronRight, Scissors, Sparkles, Download, Loader2,
} from "lucide-react";
import { useEditor, generateClips, generateSubtitles, MUSIC_TRACKS } from "@/context/EditorContext";
import { runAutoCut } from "@/lib/autocut";
import VideoPreview from "./VideoPreview";
import Timeline from "./Timeline";
import SidebarPanel from "./SidebarPanel";

// ─── Web Audio helpers (module-level, no React deps) ─────────────────────────

function sNote(
  ctx: AudioContext, dest: AudioNode,
  t: number, freq: number, dur: number, type: OscillatorType, amp: number,
) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(amp, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env); env.connect(dest);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function sNoise(
  ctx: AudioContext, dest: AudioNode,
  t: number, dur: number, hp: number, amp: number,
) {
  const len = Math.ceil(ctx.sampleRate * Math.min(dur, 0.45));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const flt = ctx.createBiquadFilter(); flt.type = "highpass"; flt.frequency.value = hp;
  const env = ctx.createGain();
  env.gain.setValueAtTime(amp, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt); flt.connect(env); env.connect(dest);
  src.start(t); src.stop(t + dur + 0.02);
}

function beatPattern(
  id: string, ctx: AudioContext, dest: AudioNode,
  b: number, t: number, spb: number, s16: number,
) {
  if (id === "t1") {
    if (b % 16 === 0)  sNote(ctx, dest, t,  80, s16 * 3,   "triangle", 0.80);
    if (b % 16 === 8)  sNote(ctx, dest, t,  72, s16 * 2,   "triangle", 0.65);
    if (b % 16 === 4)  sNoise(ctx, dest, t, s16 * 0.30, 200,  0.50);
    if (b % 16 === 12) sNoise(ctx, dest, t, s16 * 0.20, 200,  0.40);
    if (b % 2  === 0)  sNoise(ctx, dest, t, s16 * 0.08, 8000, 0.15);
    if (b % 32 === 0)  { sNote(ctx, dest, t, 220, spb*8, "sine", 0.16); sNote(ctx, dest, t, 277, spb*8, "sine", 0.11); }
    if (b % 32 === 16) { sNote(ctx, dest, t, 196, spb*8, "sine", 0.16); sNote(ctx, dest, t, 247, spb*8, "sine", 0.11); }
  } else if (id === "t2") {
    if (b % 8 === 0) sNote(ctx, dest, t, 65, spb*1.8, "sawtooth", 0.65);
    if (b % 8 === 4) sNote(ctx, dest, t, 73, spb*1.8, "sawtooth", 0.55);
    if (b % 16 === 0)  sNoise(ctx, dest, t, s16,     120, 0.75);
    if (b % 16 === 8)  sNoise(ctx, dest, t, s16*0.5, 300, 0.55);
    if (b % 32 === 0)  { sNote(ctx, dest, t, 196, spb*4, "sine", 0.22); sNote(ctx, dest, t, 294, spb*4, "sine", 0.16); }
    if (b % 32 === 16) { sNote(ctx, dest, t, 220, spb*4, "sine", 0.22); sNote(ctx, dest, t, 330, spb*4, "sine", 0.16); }
  } else if (id === "t3") {
    const mel = [523, 587, 659, 698, 784, 880];
    if (b % 4 === 0)  sNote(ctx, dest, t, 80, s16*0.8, "sine", 0.90);
    if (b % 8 === 4)  sNoise(ctx, dest, t, s16*0.3, 300, 0.60);
    if (b % 2 === 0)  sNoise(ctx, dest, t, s16*0.05, 6000, 0.18);
    if (b % 4 === 2)  sNote(ctx, dest, t, mel[Math.floor(b/4) % mel.length], s16*1.5, "triangle", 0.28);
  } else {
    if (b % 64 === 0)  { sNote(ctx, dest, t, 55, spb*16, "sine", 0.45); sNote(ctx, dest, t, 82, spb*16, "sine", 0.30); }
    if (b % 64 === 32) { sNote(ctx, dest, t, 65, spb*16, "sine", 0.40); sNote(ctx, dest, t, 98, spb*16, "sine", 0.28); }
    if (b % 16 === 0)  sNoise(ctx, dest, t, s16*0.4, 2000, 0.07);
  }
}

// ─── EditorShell ─────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onNext: () => void;
}

export default function EditorShell({ onBack, onNext }: Props) {
  const { state, dispatch } = useEditor();
  const { file, duration, clips, subtitles, transcript, selectedTrack, videoVolume, musicVolume } = state;

  // ── Object URL ──
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // ── Runtime playback state (high-frequency, stays local) ──
  const videoRef       = useRef<HTMLVideoElement>(null);
  const [currentTime,   setCurrentTime]   = useState(0);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [visData,       setVisData]       = useState<number[]>(Array(20).fill(3));

  // ── Auto-cut state ──
  const [autoCutRunning, setAutoCutRunning] = useState(false);
  const [removedSec,     setRemovedSec]     = useState<number | null>(null);

  // ── Audio refs ──
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const videoGainRef   = useRef<GainNode | null>(null);
  const musicGainRef   = useRef<GainNode | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const schedulerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef         = useRef<number>(0);

  // Stable ref for state (used inside stable callbacks)
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Cleanup ──
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    audioCtxRef.current?.close();
  }, []);

  // ── Video metadata ──
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    dispatch({ type: "SET_DURATION", duration: d });
    dispatch({ type: "INIT_CLIPS",     clips: generateClips(d) });
    dispatch({ type: "INIT_SUBTITLES", subtitles: generateSubtitles(d) });
  }, [dispatch]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    setCurrentTime(t);

    // Skip over silence gaps between clips (only during actual playback, not scrubbing)
    if (!video.paused) {
      const clips = stateRef.current.clips;
      for (let i = 0; i < clips.length - 1; i++) {
        const gapSize = clips[i + 1].startSec - clips[i].endSec;
        if (gapSize > 0.15 && t >= clips[i].endSec && t < clips[i + 1].startSec) {
          video.currentTime = clips[i + 1].startSec;
          break;
        }
      }
    }
  }, []);

  // ── Volume sync ──
  useEffect(() => { if (videoGainRef.current) videoGainRef.current.gain.value = videoVolume / 100; }, [videoVolume]);
  useEffect(() => { if (musicGainRef.current) musicGainRef.current.gain.value = (musicVolume / 100) * 0.28; }, [musicVolume]);

  // ── Restart music scheduler when track changes ──
  useEffect(() => {
    if (!audioUnlocked || !audioCtxRef.current || !musicGainRef.current) return;
    startScheduler(audioCtxRef.current, musicGainRef.current, selectedTrack);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrack, audioUnlocked]);

  function startScheduler(ctx: AudioContext, dest: AudioNode, trackId: string) {
    const track = MUSIC_TRACKS.find(t => t.id === trackId) ?? MUSIC_TRACKS[0];
    const spb = 60 / track.bpm;
    const s16 = spb / 4;
    let beat = 0;
    let nextTime = ctx.currentTime + 0.05;
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    schedulerRef.current = setInterval(() => {
      if (!audioCtxRef.current) return;
      while (nextTime < ctx.currentTime + 0.12) {
        beatPattern(trackId, ctx, dest, beat, nextTime, spb, s16);
        beat++;
        nextTime += s16;
      }
    }, 20);
  }

  function startVisualizer(analyser: AnalyserNode) {
    const bufLen = analyser.frequencyBinCount;
    const data   = new Uint8Array(bufLen);
    const step   = Math.max(1, Math.floor(bufLen / 20));
    let fc = 0;
    function draw() {
      if (fc++ % 3 === 0) {
        analyser.getByteFrequencyData(data);
        const bars: number[] = [];
        for (let i = 0; i < 20; i++) {
          bars.push(Math.max(3, (data[Math.min(i * step, bufLen - 1)] / 255) * 44));
        }
        setVisData(bars);
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
  }

  // ── THE KEY AUDIO UNLOCK (user gesture required by browsers) ──
  const handleUnlockAudio = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    cancelAnimationFrame(rafRef.current);
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    await audioCtxRef.current?.close();

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    // Build graph: video → videoGain → master → analyser → output
    //              music → musicGain ↗
    const masterGain = ctx.createGain(); masterGain.gain.value = 1;
    const analyser   = ctx.createAnalyser(); analyser.fftSize = 64;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
    analyserRef.current = analyser;

    const videoGain = ctx.createGain();
    videoGain.gain.value = stateRef.current.videoVolume / 100;
    videoGainRef.current = videoGain;
    ctx.createMediaElementSource(video).connect(videoGain);
    videoGain.connect(masterGain);

    const musicGain = ctx.createGain();
    musicGain.gain.value = (stateRef.current.musicVolume / 100) * 0.28;
    musicGainRef.current = musicGain;
    musicGain.connect(masterGain);

    // ── Critical: resume context + explicit unmute before play ──
    await ctx.resume();
    video.muted  = false;
    video.volume = 1;
    await video.play().catch(console.error);

    setIsPlaying(true);
    setAudioUnlocked(true);

    startScheduler(ctx, musicGain, stateRef.current.selectedTrack);
    startVisualizer(analyser);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    const ctx   = audioCtxRef.current;
    if (!video || !audioUnlocked) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (ctx?.state === "suspended") await ctx.resume();
      video.muted = false;
      await video.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isPlaying, audioUnlocked]);

  const handleSeek = useCallback((t: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(duration, t));
    video.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const handleSplit = useCallback(() => {
    dispatch({ type: "SPLIT_CLIP", atTime: currentTime });
  }, [currentTime, dispatch]);

  const handleAutoCut = useCallback(async () => {
    if (!file || duration === 0 || autoCutRunning) return;
    setAutoCutRunning(true);
    setRemovedSec(null);
    try {
      const result = await runAutoCut(file, duration);
      dispatch({ type: "SET_CLIPS", clips: result.clips });
      setRemovedSec(result.removedDuration);
    } catch (err) {
      console.error("[AutoCut] failed:", err);
    } finally {
      setAutoCutRunning(false);
    }
  }, [file, duration, autoCutRunning, dispatch]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#080b14]">

      {/* ── Topbar ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 shrink-0"
        style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors text-sm"
        >
          <ChevronRight size={16} />
          חזור
        </button>

        <div className="flex items-center gap-2">
          {/* Split clip */}
          <button
            onClick={handleSplit}
            disabled={clips.length === 0}
            title="חתוך בפלייהד"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-all text-xs font-medium disabled:opacity-30"
          >
            <Scissors size={13} />
            חתוך
          </button>

          {/* Magic Auto-Cut */}
          <button
            onClick={handleAutoCut}
            disabled={duration === 0 || autoCutRunning}
            title="הסר שתיקות אוטומטית"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
            style={{
              background: autoCutRunning
                ? "linear-gradient(135deg,rgba(234,179,8,.15),rgba(234,88,12,.15))"
                : "linear-gradient(135deg,rgba(234,179,8,.25),rgba(234,88,12,.25))",
              border: "1px solid rgba(234,179,8,.4)",
              color: autoCutRunning ? "rgba(253,224,71,.55)" : "#fde047",
            }}
          >
            {autoCutRunning
              ? <Loader2 size={13} className="animate-spin" />
              : <Sparkles size={13} />}
            {autoCutRunning ? "מנתח…" : "Magic Auto-Cut"}
          </button>

          {/* Removed-time badge */}
          {removedSec !== null && !autoCutRunning && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background: "rgba(234,179,8,.12)", color: "#fde047", border: "1px solid rgba(234,179,8,.25)" }}
            >
              −{removedSec.toFixed(1)}s
            </span>
          )}
        </div>

        <button
          onClick={onNext}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg,#3b82f6,#8b5cf6)",
            boxShadow: "0 0 20px rgba(59,130,246,.35)",
            color: "#fff",
          }}
        >
          ייצא
          <Download size={13} />
        </button>
      </div>

      {/* ── Main content: Video (left/top) + Sidebar (right/hidden-mobile) ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Video column */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <VideoPreview
            videoUrl={videoUrl}
            videoRef={videoRef}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            audioUnlocked={audioUnlocked}
            subtitles={subtitles}
            transcript={transcript}
            visData={visData}
            progress={progress}
            onUnlock={handleUnlockAudio}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            fmt={fmt}
          />
        </div>

        {/* Sidebar — hidden on mobile, 320px on desktop */}
        <div className="hidden lg:flex flex-col w-80 shrink-0 border-l border-white/8 overflow-y-auto">
          <SidebarPanel currentTime={currentTime} isPlaying={isPlaying} onSeek={handleSeek} />
        </div>
      </div>

      {/* ── Timeline ── */}
      <Timeline
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={handleSeek}
        fmt={fmt}
      />
    </div>
  );
}
