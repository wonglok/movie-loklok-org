import { create } from "zustand";

export interface Character {
  name: string;
  description: string;
  imageUrl: string | null;
}

export type ArtStyle =
  | "cartoon-3d"
  | "anime"
  | "realistic"
  | "oil-painting"
  | "stop-motion"
  | "noir";

export const ART_STYLES: { key: ArtStyle; label: string; emoji: string }[] = [
  { key: "cartoon-3d", label: "Cartoon 3D", emoji: "🧸" },
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
  activeTab: "characters" | "scenes";
  setStory: (story: string) => void;
  setArtStyle: (style: ArtStyle) => void;
  setCustomArtStyle: (style: string) => void;
  setCharacterImages: (images: string[]) => void;
  setSceneImages: (images: string[]) => void;
  setCharacters: (characters: Character[]) => void;
  updateCharacter: (index: number, updates: Partial<Character>) => void;
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
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
