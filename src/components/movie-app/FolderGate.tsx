"use client";

import { ReactNode, useEffect, useState } from "react";
import { useFolderStore } from "@/stores/folder-store";

type Step = "folder" | "key";

export function FolderGate({ children }: { children: ReactNode }) {
  const isConfigured = useFolderStore((s) => s.isConfigured);
  const isLoading = useFolderStore((s) => s.isLoading);
  const error = useFolderStore((s) => s.error);
  const folderName = useFolderStore((s) => s.folderName);
  const loadFromStorage = useFolderStore((s) => s.loadFromStorage);
  const setFolder = useFolderStore((s) => s.setFolder);
  const saveApiKey = useFolderStore((s) => s.saveApiKey);

  const [step, setStep] = useState<Step>("folder");
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [browserSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return "showDirectoryPicker" in window;
  });

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const handleSelectFolder = async () => {
    setPickerError(null);
    try {
      const handle = await window.showDirectoryPicker();
      setFolder(handle);
      setStep("key");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPickerError(
        err instanceof Error ? err.message : "Failed to select folder",
      );
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await saveApiKey(apiKey.trim());
    } catch {
      // error is set in the store
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setStep("folder");
    setPickerError(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!isConfigured) {
    const displayError = pickerError || error;

    if (step === "key") {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                />
              </svg>
            </div>

            <h1 className="text-xl font-semibold text-white mb-2">
              Enter your API Key
            </h1>
            <p className="text-neutral-400 text-sm mb-2">
              Your fal.ai API key will be saved to
            </p>
            <p className="text-neutral-300 text-sm font-mono bg-neutral-800 rounded-lg px-3 py-1.5 mb-6 inline-block">
              {folderName}
            </p>

            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveKey();
              }}
              placeholder="Paste your fal.ai API key..."
              autoFocus
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors mb-3"
            />

            <a
              href="https://fal.ai/dashboard/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors mb-6"
            >
              Get a key from fal.ai &rarr;
            </a>

            {displayError && (
              <p className="text-red-400 text-sm mb-4 bg-red-400/10 rounded-lg px-4 py-2">
                {displayError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleBack}
                disabled={saving}
                className="px-4 py-3 text-neutral-400 hover:text-white rounded-xl font-medium transition-colors disabled:opacity-40"
              >
                Back
              </button>
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim() || saving}
                className="flex-1 px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Save & Continue"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-500/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-white mb-2">
            Select API Keys Folder
          </h1>
          <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
            Choose a folder on your computer to store your fal.ai API keys. The
            keys will be read directly from this folder when making API calls.
          </p>

          {!browserSupported && (
            <p className="text-amber-400 text-sm mb-4 bg-amber-400/10 rounded-lg px-4 py-2">
              Your browser does not support the File System Access API. Please
              use Chrome, Edge, or Opera.
            </p>
          )}

          {displayError && (
            <p className="text-red-400 text-sm mb-4 bg-red-400/10 rounded-lg px-4 py-2">
              {displayError}
            </p>
          )}

          <button
            onClick={handleSelectFolder}
            disabled={!browserSupported}
            className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Choose Folder
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
