"use client";

import React, { createContext, useContext, useReducer } from "react";

// ─── Shared types ───────────────────────────────────────────────────────────────

export interface Clip {
  id: string;
  startSec: number;
  endSec: number;
  label: string;
  transition: "none" | "fade" | "zoom";
  color: string;
}

export interface Subtitle {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
}

/** Word-level timestamp entry (Whisper / Deepgram format) */
export interface Word {
  id: string;
  text: string;
  start: number;  // seconds
  end: number;    // seconds
  confidence: number; // 0–1
}

// ─── Subtitle style ──────────────────────────────────────────────────────────────

export interface SubtitleStyle {
  fontFamily: string;
  scale: number;        // 0.6–1.8 multiplier on top of responsive base size
  textColor: string;
  activeColor: string;
  shadowColor: string;
  verticalPos: number;  // top % of video box (5–88)
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily:  "Heebo",
  scale:       1,
  textColor:   "rgba(255,255,255,0.92)",
  activeColor: "#ffe234",
  shadowColor: "#000000",
  verticalPos: 78,
};

// ─── State ──────────────────────────────────────────────────────────────────────

export interface EditorState {
  file: File | null;
  duration: number;
  clips: Clip[];
  subtitles: Subtitle[];
  transcript: Word[];
  subtitleStyle: SubtitleStyle;
  selectedTrack: string;
  videoVolume: number;
  musicVolume: number;
}

// ─── Actions ────────────────────────────────────────────────────────────────────

export type EditorAction =
  | { type: "SET_FILE"; file: File }
  | { type: "SET_DURATION"; duration: number }
  | { type: "INIT_CLIPS"; clips: Clip[] }
  | { type: "SET_CLIPS"; clips: Clip[] }
  | { type: "INIT_SUBTITLES"; subtitles: Subtitle[] }
  | { type: "SET_TRANSCRIPT"; words: Word[] }
  | { type: "SPLIT_CLIP"; atTime: number }
  | { type: "REMOVE_CLIP"; id: string }
  | { type: "UPDATE_SUBTITLE"; id: string; text: string }
  | { type: "UPDATE_WORD"; id: string; text: string }
  | { type: "SET_SUBTITLE_STYLE"; style: Partial<SubtitleStyle> }
  | { type: "SET_TRACK"; track: string }
  | { type: "SET_VIDEO_VOLUME"; v: number }
  | { type: "SET_MUSIC_VOLUME"; v: number }
  | { type: "RESET" };

// ─── Constants ──────────────────────────────────────────────────────────────────

export interface MusicTrack {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  category: "phonk" | "motivation" | "chill" | "sales";
  url: string;
  waveform: number[]; // 20 amplitude values 0–100
}

export const MUSIC_TRACKS: MusicTrack[] = [
  // ── Phonk / High Energy ──────────────────────────────────────────────────
  {
    id: "t1", name: "Dark Phonk", genre: "Phonk", bpm: 140, category: "phonk",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    waveform: [85,45,92,28,88,55,95,22,90,60,88,32,92,50,85,38,90,55,80,95],
  },
  {
    id: "t2", name: "Trap Energy", genre: "Trap", bpm: 150, category: "phonk",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    waveform: [90,28,88,45,95,22,82,60,92,32,88,50,90,38,85,55,92,28,85,95],
  },
  // ── Motivation / Epic ─────────────────────────────────────────────────────
  {
    id: "t3", name: "Rise Up", genre: "Cinematic", bpm: 128, category: "motivation",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    waveform: [70,75,80,78,85,82,88,86,90,88,92,85,88,82,85,80,78,82,85,88],
  },
  {
    id: "t4", name: "Power Move", genre: "Epic", bpm: 135, category: "motivation",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3",
    waveform: [65,72,78,82,88,85,90,88,92,88,85,82,88,85,90,88,85,82,88,92],
  },
  // ── Chill / Lo-Fi ────────────────────────────────────────────────────────
  {
    id: "t5", name: "Lo-Fi Afternoon", genre: "Lo-Fi", bpm: 85, category: "chill",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    waveform: [40,45,38,50,42,48,35,52,45,38,50,42,45,40,38,52,45,40,48,42],
  },
  {
    id: "t6", name: "Podcast Chill", genre: "Ambient", bpm: 72, category: "chill",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3",
    waveform: [30,35,38,32,40,35,28,42,35,30,38,32,35,30,38,32,40,35,28,42],
  },
  // ── Corporate / Sales ────────────────────────────────────────────────────
  {
    id: "t7", name: "Corporate Drive", genre: "Corporate", bpm: 120, category: "sales",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    waveform: [60,65,68,62,70,65,58,72,65,60,68,62,65,60,68,62,70,65,58,72],
  },
  {
    id: "t8", name: "Sales Momentum", genre: "Electronic", bpm: 125, category: "sales",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
    waveform: [65,70,72,68,75,70,62,78,70,65,72,68,70,65,72,68,75,70,62,78],
  },
];

export const CLIP_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
];

const CLIP_LABELS = ["פתיחה", "תוכן ראשי", "חלק שני", "שיא", "סיכום", "סיום"];

// ─── Word transcript generator ───────────────────────────────────────────────


const SUBTITLE_PHRASES = [
  "שלום!",
  "ברוכים הבאים לערוץ שלי",
  "היום נדבר על",
  "הנושא הכי חם של השנה",
  "זה חשוב מאוד",
  "כי זה ישנה את החיים שלכם",
  "בואו נצלול לתוך הפרטים",
  "לא תאמינו כמה זה מדהים",
  "אל תפספסו את זה",
  "תעשו לייק ותעקבו לתוכן נוסף!",
];

// ─── Generator helpers ───────────────────────────────────────────────────────────

export function generateClips(d: number): Clip[] {
  const dur = d > 0 ? d : 60;
  const count = Math.max(3, Math.min(6, Math.ceil(dur / 12)));
  const seg = dur / count;
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    startSec: i * seg,
    endSec: (i + 1) * seg,
    label: CLIP_LABELS[i] ?? `קטע ${i + 1}`,
    transition: (i > 0 ? (i % 2 === 0 ? "fade" : "zoom") : "none") as Clip["transition"],
    color: CLIP_COLORS[i % CLIP_COLORS.length],
  }));
}

export function generateAutoJumpCuts(d: number): Clip[] {
  const clips: Clip[] = [];
  let t = 0;
  let i = 0;
  while (t < d) {
    const seg = 2 + Math.random() * 1.5;
    const end = Math.min(t + seg, d);
    clips.push({
      id: `ac${i}`,
      startSec: t,
      endSec: end,
      label: `קטע ${i + 1}`,
      transition: (i > 0 ? (Math.random() > 0.5 ? "fade" : "zoom") : "none") as Clip["transition"],
      color: CLIP_COLORS[i % CLIP_COLORS.length],
    });
    t = end;
    i++;
  }
  return clips;
}

export function generateSubtitles(d: number): Subtitle[] {
  const dur = d > 0 ? d : 60;
  const seg = dur / SUBTITLE_PHRASES.length;
  return SUBTITLE_PHRASES.map((text, i) => ({
    id: `s${i}`,
    startSec: i * seg + 0.05,
    endSec: (i + 1) * seg - 0.1,
    text,
  }));
}

// ─── Reducer ─────────────────────────────────────────────────────────────────────

const INITIAL: EditorState = {
  file: null,
  duration: 0,
  clips: [],
  subtitles: [],
  transcript: [],
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  selectedTrack: "t1",
  videoVolume: 80,
  musicVolume: 40,
};

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_FILE":
      return { ...INITIAL, file: action.file };
    case "SET_DURATION":
      return { ...state, duration: action.duration };
    case "INIT_CLIPS":
      return state.clips.length > 0 ? state : { ...state, clips: action.clips };
    case "SET_CLIPS":
      return { ...state, clips: action.clips };
    case "INIT_SUBTITLES":
      return state.subtitles.length > 0 ? state : { ...state, subtitles: action.subtitles };
    case "SET_TRANSCRIPT":
      return { ...state, transcript: action.words };
    case "SPLIT_CLIP": {
      const t = action.atTime;
      const idx = state.clips.findIndex(c => t > c.startSec + 0.15 && t < c.endSec - 0.15);
      if (idx === -1) return state;
      const c = state.clips[idx];
      const nextColor = CLIP_COLORS[(idx + 1) % CLIP_COLORS.length];
      return {
        ...state,
        clips: [
          ...state.clips.slice(0, idx),
          { ...c, id: c.id + "a", endSec: t },
          { ...c, id: c.id + "b", startSec: t, label: c.label + " ב", transition: "zoom", color: nextColor },
          ...state.clips.slice(idx + 1),
        ],
      };
    }
    case "REMOVE_CLIP":
      return { ...state, clips: state.clips.filter(c => c.id !== action.id) };
    case "UPDATE_SUBTITLE":
      return {
        ...state,
        subtitles: state.subtitles.map(s =>
          s.id === action.id ? { ...s, text: action.text } : s
        ),
      };
    case "UPDATE_WORD": {
      const newTranscript = state.transcript.map(w =>
        w.id === action.id ? { ...w, text: action.text } : w
      );
      // Re-join the subtitle that contains this word
      const newSubtitles = state.subtitles.map(sub => {
        const wordsInSub = newTranscript.filter(
          w => w.start >= sub.startSec - 0.01 && w.end <= sub.endSec + 0.01
        );
        if (!wordsInSub.some(w => w.id === action.id)) return sub;
        return { ...sub, text: wordsInSub.map(w => w.text).join(" ") };
      });
      return { ...state, transcript: newTranscript, subtitles: newSubtitles };
    }
    case "SET_SUBTITLE_STYLE":
      return { ...state, subtitleStyle: { ...state.subtitleStyle, ...action.style } };
    case "SET_TRACK":
      return { ...state, selectedTrack: action.track };
    case "SET_VIDEO_VOLUME":
      return { ...state, videoVolume: action.v };
    case "SET_MUSIC_VOLUME":
      return { ...state, musicVolume: action.v };
    case "RESET":
      return INITIAL;
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────────

interface CtxValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

const EditorContext = createContext<CtxValue | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  return (
    <EditorContext.Provider value={{ state, dispatch }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
