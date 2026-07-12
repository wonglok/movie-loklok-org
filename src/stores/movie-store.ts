import { create } from "zustand";

export interface Conversation {
  id: string;
  person: string;
  line: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  location: string;
  imageUrl: string | null;
  imageFilename: string | null;
  sourceUrl: string | null;
  videoUrl: string | null;
  videoFilename: string | null;
  videoDuration: number;
  videoResolution: "480p" | "720p" | "1080p" | string;
  videoAspect: "16:9" | "9:16" | "4:3" | "1:1" | "3:4" | string;
  videoReferenceIds: string[];
  conversations: Conversation[];
}

export const RESOLUTION_OPTIONS = ["480p", "720p", "1080p"] as const;
export const ASPECT_OPTIONS = ["16:9", "9:16", "4:3", "1:1", "3:4"] as const;

export interface Moment {
  id: string;
  sceneId: string;
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
  projectId: string | null;
  story: string;
  artStyle: ArtStyle;
  customArtStyle: string;
  language: string;
  isGenerating: boolean;
  characterImages: string[];
  sceneImages: string[];
  characters: Character[];
  scenes: Character[];
  moments: Moment[];
  videoInfo: VideoInfo | null;
  activeTab: "characters" | "scenes";
  setProjectId: (projectId: string | null) => void;
  setStory: (story: string) => void;
  setArtStyle: (style: ArtStyle) => void;
  setCustomArtStyle: (style: string) => void;
  setLanguage: (language: string) => void;
  setCharacterImages: (images: string[]) => void;
  setSceneImages: (images: string[]) => void;
  setCharacters: (characters: Character[]) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  setScenes: (scenes: Character[]) => void;
  updateScene: (id: string, updates: Partial<Character>) => void;
  setMoments: (moments: Moment[]) => void;
  updateMoment: (id: string, updates: Partial<Moment>) => void;
  setVideoInfo: (info: VideoInfo | null) => void;
  setIsGenerating: (generating: boolean) => void;
  setActiveTab: (tab: "characters" | "scenes") => void;
  resetProject: () => void;
}

const initialState = {
  projectId: null as string | null,
  story: "",
  artStyle: "cartoon-3d" as ArtStyle,
  customArtStyle: "",
  language: "English",
  isGenerating: false,
  characterImages: [] as string[],
  sceneImages: [] as string[],
  characters: [] as Character[],
  scenes: [] as Character[],
  moments: [] as Moment[],
  videoInfo: null as VideoInfo | null,
  activeTab: "characters" as "characters" | "scenes",
};

export const useMovieStore = create<MovieState>((set) => ({
  ...initialState,
  setProjectId: (projectId) => set({ projectId }),
  setStory: (story) => set({ story }),
  setArtStyle: (artStyle) => set({ artStyle }),
  setCustomArtStyle: (customArtStyle) => set({ customArtStyle }),
  setLanguage: (language) => set({ language }),
  setCharacterImages: (characterImages) => set({ characterImages }),
  setSceneImages: (sceneImages) => set({ sceneImages }),
  setCharacters: (characters) => set({ characters }),
  updateCharacter: (id, updates) =>
    set((state) => ({
      characters: state.characters.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    })),
  setScenes: (scenes) => set({ scenes }),
  updateScene: (id, updates) =>
    set((state) => ({
      scenes: state.scenes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
  setMoments: (moments) => set({ moments }),
  updateMoment: (id, updates) =>
    set((state) => ({
      moments: state.moments.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    })),
  setVideoInfo: (videoInfo) => set({ videoInfo }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setActiveTab: (activeTab) => set({ activeTab }),
  resetProject: () => set({ ...initialState }),
}));
