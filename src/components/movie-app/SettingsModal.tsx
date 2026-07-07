"use client";

import { useState, useEffect } from "react";

interface SettingsModalProps {
  folderName: string | null;
  pickerError: string | null;
  apiKey: string | null;
  onChangeFolder: () => void;
  onSaveApiKey: (key: string) => Promise<void>;
  onClose: () => void;
}

export function SettingsModal({
  folderName,
  pickerError,
  apiKey,
  onChangeFolder,
  onSaveApiKey,
  onClose,
}: SettingsModalProps) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    setKey(apiKey ?? "");
  }, [apiKey]);

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaving(true);
    setKeyError(null);
    try {
      await onSaveApiKey(key.trim());
    } catch {
      setKeyError("Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-white mb-2">Settings</h2>
        <p className="text-neutral-400 text-sm mb-6">
          Current workspace:{" "}
          <span className="text-neutral-300 font-mono">{folderName}</span>
        </p>

        {/* API Key */}
        <div className="mb-6">
          <label className="text-sm text-neutral-400 block mb-2">
            fal.ai API Key
          </label>
          <div className="relative mb-2">
            <input
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder="Paste your fal.ai API key..."
              className="w-full px-4 py-3 pr-10 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
              title={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
            </button>
          </div>
          {keyError && (
            <p className="text-red-400 text-xs mb-2">{keyError}</p>
          )}
          <a
            href="https://fal.ai/dashboard/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-4 py-2 bg-neutral-700 text-white text-center rounded-lg text-sm font-medium hover:bg-neutral-600 transition-colors mb-3"
          >
            Get FAL AI Key
          </a>
          <button
            onClick={handleSave}
            disabled={!key.trim() || saving}
            className="w-full px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save API Key"}
          </button>
        </div>

        {pickerError && (
          <p className="text-red-400 text-sm mb-4 bg-red-400/10 rounded-lg px-4 py-2">
            {pickerError}
          </p>
        )}

        <button
          onClick={onChangeFolder}
          className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 transition-colors mb-3"
        >
          Change Workspace Folder
        </button>

        <button
          onClick={onClose}
          className="w-full px-4 py-3 text-neutral-400 hover:text-white rounded-xl font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
