"use client";

import { useMovieStore, ART_STYLES, type ArtStyle } from "@/stores/movie-store";
import { useFolderStore } from "@/stores/folder-store";

export function MovieApp() {
  const story = useMovieStore((s) => s.story);
  const artStyle = useMovieStore((s) => s.artStyle);
  const isGenerating = useMovieStore((s) => s.isGenerating);
  const characterImages = useMovieStore((s) => s.characterImages);
  const sceneImages = useMovieStore((s) => s.sceneImages);
  const activeTab = useMovieStore((s) => s.activeTab);
  const setStory = useMovieStore((s) => s.setStory);
  const setArtStyle = useMovieStore((s) => s.setArtStyle);
  const setActiveTab = useMovieStore((s) => s.setActiveTab);
  const setIsGenerating = useMovieStore((s) => s.setIsGenerating);
  const apiKey = useFolderStore((s) => s.apiKey);

  const handleGenerate = async () => {
    if (!story.trim() || !apiKey) return;
    setIsGenerating(true);
    try {
      // TODO: wire up fal.ai API calls with the apiKey
      // const response = await fetch("https://fal.run/...", {
      //   headers: { Authorization: `Key ${apiKey}` },
      //   body: JSON.stringify({ prompt: story, style: artStyle }),
      // });
    } catch {
      // handle error
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-6 p-6">
      {/* Left panel — inputs */}
      <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4">
        <StoryText story={story} onStoryChange={setStory} />
        <ArtDirection selected={artStyle} onSelect={setArtStyle} />
        <button
          onClick={handleGenerate}
          disabled={!story.trim() || isGenerating || !apiKey}
          className="w-full px-4 py-3 bg-white text-black rounded-xl font-semibold hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? "Generating..." : "Generate Movie"}
        </button>
      </div>

      {/* Right panel — results */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex gap-2 mb-4">
          <TabButton
            active={activeTab === "characters"}
            onClick={() => setActiveTab("characters")}
          >
            Characters
          </TabButton>
          <TabButton
            active={activeTab === "scenes"}
            onClick={() => setActiveTab("scenes")}
          >
            Scenes
          </TabButton>
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === "characters" ? (
            <ImageGrid
              images={characterImages}
              emptyLabel="No characters generated yet"
            />
          ) : (
            <ImageGrid
              images={sceneImages}
              emptyLabel="No scenes generated yet"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StoryText({
  story,
  onStoryChange,
}: {
  story: string;
  onStoryChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-white/80 text-sm font-medium">Story</label>
      <textarea
        value={story}
        onChange={(e) => onStoryChange(e.target.value)}
        placeholder="Write your movie story or script here..."
        rows={10}
        className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/30 transition-colors"
      />
    </div>
  );
}

function ArtDirection({
  selected,
  onSelect,
}: {
  selected: ArtStyle;
  onSelect: (style: ArtStyle) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-white/80 text-sm font-medium">
        Art Direction
      </label>
      <div className="grid grid-cols-3 gap-2">
        {ART_STYLES.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl text-xs font-medium transition-colors ${
              selected === key
                ? "bg-white/15 border border-white/30 text-white"
                : "bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70"
            }`}
          >
            <span className="text-lg">{emoji}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-white/10 text-white"
          : "text-white/40 hover:text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

function ImageGrid({
  images,
  emptyLabel,
}: {
  images: string[];
  emptyLabel: string;
}) {
  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white/20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>
          <p className="text-white/25 text-sm">{emptyLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className="rounded-xl border border-white/10 w-full aspect-[4/5] object-cover bg-white/5"
        />
      ))}
    </div>
  );
}
