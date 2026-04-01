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

/** Visual style applied to the subtitle overlay */
export interface SubtitleStyle {
  fontFamily: string;   // "Assistant" | "Heebo" | "Rubik"
  scale: number;        // multiplier on computed font size (0.6 – 1.8)
  textColor: string;    // CSS hex colour for normal words
  activeColor: string;  // CSS hex colour for the currently spoken word
  shadowColor: string;  // CSS hex for text-shadow / stroke
  verticalPos: number;  // top offset as % of video box height (10 – 88)
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
  transcriptionError: string | null;
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
  | { type: "INIT_SUBTITLES"; subtitles: Subtitle[] }
  | { type: "SET_TRANSCRIPT"; words: Word[] }
  | { type: "SET_TRANSCRIPTION_ERROR"; error: string }
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

export const MUSIC_TRACKS = [
  { id: "t1", name: "Lo-Fi Chill Beats",   genre: "Lo-Fi",     bpm: 85  },
  { id: "t2", name: "Epic Motivational",   genre: "Cinematic", bpm: 128 },
  { id: "t3", name: "Upbeat Pop Vibes",    genre: "Pop",       bpm: 110 },
  { id: "t4", name: "Deep Focus",          genre: "Ambient",   bpm: 70  },
] as const;

export const CLIP_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
];

const CLIP_LABELS = ["פתיחה", "תוכן ראשי", "חלק שני", "שיא", "סיכום", "סיום"];


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

// ─── Reducer ─────────────────────────────────────────────────────────────────────

const INITIAL: EditorState = {
  file: null,
  duration: 0,
  clips: [],
  subtitles: [],
  transcript: [],
  transcriptionError: null,
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
    case "INIT_SUBTITLES":
      return { ...state, subtitles: action.subtitles };
    case "SET_TRANSCRIPT":
      return { ...state, transcript: action.words };
    case "SET_TRANSCRIPTION_ERROR":
      return { ...state, transcriptionError: action.error };
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
      // Keep subtitles in sync: find the subtitle whose time range contains
      // this word and re-join the words that fall within it.
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
