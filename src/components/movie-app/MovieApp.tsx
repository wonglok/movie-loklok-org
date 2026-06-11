"use client";

import { useState } from "react";
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

  const [storyOpen, setStoryOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(true);

  const handleGenerate = async () => {
    if (!story.trim() || !apiKey) return;
    setIsGenerating(true);
    try {
      // TODO: wire up fal.ai API calls with the apiKey
    } catch {
      // handled by store
    } finally {
      setIsGenerating(false);
    }
  };

  const statusText = !apiKey
    ? "No API key configured"
    : isGenerating
      ? "Rendering..."
      : "Ready";

  return (
    <div className="w-full h-full flex flex-col bg-[#1a1a1a] text-[#e6e6e6]">
      {/* === Top Bar === */}
      <div className="shrink-0 flex items-center border-b border-[#3a3a3a] bg-[#232323]">
        <div className="flex">
          <button
            onClick={() => setActiveTab("characters")}
            className={`relative px-4 py-2 text-xs font-medium tracking-wide transition-colors ${
              activeTab === "characters"
                ? "text-[#e6e6e6] bg-[#2d2d2d]"
                : "text-[#969696] hover:text-[#c0c0c0]"
            }`}
          >
            Characters
            {activeTab === "characters" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e8812b]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("scenes")}
            className={`relative px-4 py-2 text-xs font-medium tracking-wide transition-colors ${
              activeTab === "scenes"
                ? "text-[#e6e6e6] bg-[#2d2d2d]"
                : "text-[#969696] hover:text-[#c0c0c0]"
            }`}
          >
            Scenes
            {activeTab === "scenes" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e8812b]" />
            )}
          </button>
        </div>

        <div className="ml-auto px-4 text-[11px] text-[#696969] tracking-widest uppercase select-none">
          Movie v0.1
        </div>
      </div>

      {/* === Main Content === */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* === Left: Properties Panel === */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col border-r border-[#3a3a3a] bg-[#1a1a1a] gap-px overflow-y-auto blender-scrollbar">
          {/* Story Section */}
          <SectionHeader
            label="Story"
            open={storyOpen}
            onToggle={() => setStoryOpen(!storyOpen)}
          />
          {storyOpen && (
            <div className="px-3 pb-3 bg-[#232323]">
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Write your movie story or script here..."
                rows={10}
                className="w-full resize-none bg-[#181818] border border-[#3a3a3a] focus:border-[#505050] px-3 py-2 text-[13px] text-[#e6e6e6] placeholder-[#555] outline-none transition-colors"
                style={{ borderRadius: 4 }}
              />
            </div>
          )}

          {/* Art Direction Section */}
          <SectionHeader
            label="Art Direction"
            open={styleOpen}
            onToggle={() => setStyleOpen(!styleOpen)}
          />
          {styleOpen && (
            <div className="px-3 pb-3 bg-[#232323]">
              <div className="grid grid-cols-2 gap-1">
                {ART_STYLES.map(({ key, label, emoji }) => (
                  <button
                    key={key}
                    onClick={() => setArtStyle(key)}
                    className={`flex items-center gap-2 px-2.5 py-2 text-[12px] font-medium transition-colors ${
                      artStyle === key
                        ? "bg-[#383838] text-[#e6e6e6] border border-[#505050]"
                        : "bg-[#232323] text-[#888] border border-transparent hover:bg-[#2a2a2a] hover:text-[#b0b0b0]"
                    }`}
                    style={{ borderRadius: 4 }}
                  >
                    <span className="text-base leading-none">{emoji}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1" />

          {/* Generate Button */}
          <div className="p-3 bg-[#232323]">
            <button
              onClick={handleGenerate}
              disabled={!story.trim() || isGenerating || !apiKey}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[13px] font-semibold tracking-wide transition-colors disabled:cursor-not-allowed"
              style={{
                borderRadius: 4,
                backgroundColor:
                  !story.trim() || !apiKey ? "#2a2a2a" : "#e8812b",
                color: !story.trim() || !apiKey ? "#555" : "#1a1a1a",
              }}
              onMouseEnter={(e) => {
                if (story.trim() && apiKey && !isGenerating) {
                  e.currentTarget.style.backgroundColor = "#f59a44";
                }
              }}
              onMouseLeave={(e) => {
                if (story.trim() && apiKey && !isGenerating) {
                  e.currentTarget.style.backgroundColor = "#e8812b";
                }
              }}
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-[#1a1a1a]/30 border-t-[#1a1a1a]" />
                  Rendering...
                </>
              ) : (
                <>Render Movie</>
              )}
            </button>
          </div>
        </div>

        {/* === Right: Viewport === */}
        <div className="flex-1 blender-viewport flex flex-col min-h-0">
          <div className="flex-1 overflow-auto blender-scrollbar p-4">
            {activeTab === "characters" ? (
              <ImageGrid
                images={characterImages}
                emptyLabel="No characters generated"
              />
            ) : (
              <ImageGrid
                images={sceneImages}
                emptyLabel="No scenes generated"
              />
            )}
          </div>

          {/* Status Bar */}
          <div className="shrink-0 flex items-center justify-between px-4 py-1.5 bg-[#232323] border-t border-[#3a3a3a] text-[11px] text-[#696969]">
            <span>
              {activeTab === "characters" ? "Characters" : "Scenes"} &mdash;{" "}
              {activeTab === "characters"
                ? characterImages.length
                : sceneImages.length}{" "}
              items
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    statusText === "Ready" ? "#5a9e5a" : "#e8812b",
                }}
              />
              {statusText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#969696] font-medium tracking-wide uppercase cursor-pointer hover:text-[#c0c0c0] transition-colors select-none"
      style={{
        background: "linear-gradient(180deg, #2d2d2d 0%, #282828 100%)",
        borderBottom: "1px solid #3a3a3a",
      }}
    >
      <span className="text-[10px] leading-none text-[#696969]">
        {open ? "▾" : "▸"}
      </span>
      {label}
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
        <div className="text-center select-none">
          <div
            className="w-14 h-14 mx-auto mb-3 flex items-center justify-center opacity-20"
            style={{ borderRadius: 4 }}
          >
            <svg
              className="w-7 h-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"
              />
            </svg>
          </div>
          <p className="text-[13px] text-[#555]">{emptyLabel}</p>
          <p className="text-[11px] text-[#3a3a3a] mt-1">
            Write a story and click Render to generate
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {images.map((src, i) => (
        <div
          key={i}
          className="relative group bg-[#232323] border border-[#3a3a3a]"
          style={{ borderRadius: 4, overflow: "hidden" }}
        >
          <img
            src={src}
            alt=""
            className="w-full aspect-[4/5] object-cover"
          />
          <div className="absolute inset-0 border border-transparent group-hover:border-[#e8812b]/40 transition-colors pointer-events-none" />
        </div>
      ))}
    </div>
  );
}
