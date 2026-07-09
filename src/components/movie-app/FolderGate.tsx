"use client";

import { ReactNode, useEffect, useState } from "react";
import { useFolderStore } from "@/stores/folder-store";

export function FolderGate({ children }: { children: ReactNode }) {
  const isConfigured = useFolderStore((s) => s.isConfigured);
  const isLoading = useFolderStore((s) => s.isLoading);
  const error = useFolderStore((s) => s.error);
  const loadFromStorage = useFolderStore((s) => s.loadFromStorage);
  const saveApiKey = useFolderStore((s) => s.saveApiKey);

  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!isConfigured) {
    // If OPFS not supported, show error
    if (error?.includes("OPFS")) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">
              Browser Not Supported
            </h1>
            <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
              This app requires the Origin Private File System API. Please use
              Safari 15.2+, Chrome 102+, Firefox 111+, or Edge 102+.
            </p>
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
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-white mb-2">
            Enter your API Key
          </h1>
          <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
            Your fal.ai API key will be stored securely in your browser. All
            project files are saved in private browser storage.
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

          {error && !error.includes("OPFS") && (
            <p className="text-red-400 text-sm mb-4 bg-red-400/10 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleSaveKey}
            disabled={!apiKey.trim() || saving}
            className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
