import { create } from "zustand";

export interface Conversation {
  person: string;
  line: string;
}

export interface Character {
  name: string;
  description: string;
  imageUrl: string | null;
  imageFilename: string | null;
  sourceUrl: string | null;
  videoUrl: string | null;
  videoDuration: number;
  videoCamera: string;
  videoResolution: "720p" | "1080p";
  videoAspect: "16:9" | "9:16" | "4:3" | "1:1" | "3:4";
  conversations: Conversation[];
}

export const RESOLUTION_OPTIONS = ["720p", "1080p"] as const;
export const ASPECT_OPTIONS = ["16:9", "9:16", "4:3", "1:1", "3:4"] as const;

export interface Moment {
  sceneIndex: number;
  name: string;
  description: string;
  duration: number;
  cameraAngle: string;
  cameraMovement: string;
}

export interface VideoInfo {
  title: string;
  genre: string;
  duration: string;
  format: string;
  resolution: string;
  framerate: string;
  description: string;
}

export type ArtStyle =
  | "cartoon-3d"
  | "anime"
  | "realistic"
  | "oil-painting"
  | "stop-motion"
  | "noir";

export const ART_STYLES: { key: ArtStyle; label: string; emoji: string }[] = [
  { key: "cartoon-3d", label: "Cartoon 3D movie, 3D model style", emoji: "🧸" },
  { key: "anime", label: "Anime", emoji: "🌸" },
  { key: "realistic", label: "Realistic", emoji: "🎬" },
  { key: "oil-painting", label: "Oil Painting", emoji: "🖌️" },
  { key: "stop-motion", label: "Stop Motion", emoji: "📸" },
  { key: "noir", label: "Noir", emoji: "🕶️" },
];

interface MovieState {
  story: string;
  artStyle: ArtStyle;
  customArtStyle: string;
  isGenerating: boolean;
  characterImages: string[];
  sceneImages: string[];
  characters: Character[];
  scenes: Character[];
  moments: Moment[];
  videoInfo: VideoInfo | null;
  activeTab: "characters" | "scenes";
  setStory: (story: string) => void;
  setArtStyle: (style: ArtStyle) => void;
  setCustomArtStyle: (style: string) => void;
  setCharacterImages: (images: string[]) => void;
  setSceneImages: (images: string[]) => void;
  setCharacters: (characters: Character[]) => void;
  updateCharacter: (index: number, updates: Partial<Character>) => void;
  setScenes: (scenes: Character[]) => void;
  updateScene: (index: number, updates: Partial<Character>) => void;
  setMoments: (moments: Moment[]) => void;
  updateMoment: (index: number, updates: Partial<Moment>) => void;
  setVideoInfo: (info: VideoInfo | null) => void;
  setIsGenerating: (generating: boolean) => void;
  setActiveTab: (tab: "characters" | "scenes") => void;
}

export const useMovieStore = create<MovieState>((set) => ({
  story: "",
  artStyle: "cartoon-3d",
  customArtStyle: "",
  isGenerating: false,
  characterImages: [],
  sceneImages: [],
  characters: [],
  scenes: [],
  moments: [],
  videoInfo: null,
  activeTab: "characters",
  setStory: (story) => set({ story }),
  setArtStyle: (artStyle) => set({ artStyle }),
  setCustomArtStyle: (customArtStyle) => set({ customArtStyle }),
  setCharacterImages: (characterImages) => set({ characterImages }),
  setSceneImages: (sceneImages) => set({ sceneImages }),
  setCharacters: (characters) => set({ characters }),
  updateCharacter: (index, updates) =>
    set((state) => {
      const characters = [...state.characters];
      characters[index] = { ...characters[index], ...updates };
      return { characters };
    }),
  setScenes: (scenes) => set({ scenes }),
  updateScene: (index, updates) =>
    set((state) => {
      const scenes = [...state.scenes];
      scenes[index] = { ...scenes[index], ...updates };
      return { scenes };
    }),
  setMoments: (moments) => set({ moments }),
  updateMoment: (index, updates) =>
    set((state) => {
      const moments = [...state.moments];
      moments[index] = { ...moments[index], ...updates };
      return { moments };
    }),
  setVideoInfo: (videoInfo) => set({ videoInfo }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
